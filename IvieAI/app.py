from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import re
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

MODEL_ID = "GeorgeUwaifo/ivie_gpt2_new01c_results"
TOKEN = os.getenv('HF_TOKEN')

# Global variables for model and chat history
model = None
tokenizer = None
chat_sessions = {}
current_session_id = None


class ChatSession:
    """Class to manage a single chat session"""
    def __init__(self, session_id=None):
        self.session_id = session_id or datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        self.history = []
        self.created_at = datetime.now()
        self.last_updated = datetime.now()

    def add_interaction(self, user_message, ai_response):
        self.history.append({"trigger": user_message, "reply": ai_response})
        self.last_updated = datetime.now()

    def to_json(self):
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "total_interactions": len(self.history),
            "history": self.history
        }

    def to_text(self):
        lines = [
            "=" * 60,
            f"Chat Session: {self.session_id}",
            f"Created: {self.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Last Updated: {self.last_updated.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Interactions: {len(self.history)}",
            "=" * 60,
            ""
        ]
        for i, interaction in enumerate(self.history, 1):
            lines.append(f"[{i}] User: {interaction['trigger']}")
            lines.append(f"[{i}] AI: {interaction['reply']}")
            lines.append("-" * 40)
        return "\n".join(lines)


def load_model():
    """Load the model (called once on first request or at startup)."""
    global model, tokenizer
    print(f"Loading model: {MODEL_ID}")
    try:
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID, token=TOKEN, trust_remote_code=True
        )
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            token=TOKEN,
            trust_remote_code=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True
        )
        if torch.cuda.is_available():
            model = model.cuda()
            print("✅ Model moved to GPU")
        model.eval()
        print("✅ Model loaded successfully!")
        return True
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False


def ensure_model_loaded():
    """Lazy-load the model on first use (compatible with gunicorn)."""
    global model, tokenizer
    if model is None:
        load_model()


def ensure_period_termination(text):
    if not text:
        return text
    text = text.rstrip()
    if text and text[-1] in '.!?":':
        return text
    return text + '.'


def get_complete_sentences_up_to_limit(text, max_tokens=150):
    if not text:
        return ""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    complete_sentences = []
    for sentence in sentences:
        if sentence and sentence.strip():
            test_text = ' '.join(complete_sentences + [sentence.strip()])
            estimated_tokens = len(test_text.split()) * 1.3
            if estimated_tokens <= max_tokens:
                complete_sentences.append(sentence.strip())
            else:
                break
    return ' '.join(complete_sentences)


def clean_and_format_response(full_response, user_message):
    ai_response = full_response[len(user_message):].strip()

    prefixes_to_remove = [
        "### Response:", "### Response", "Response:", "AI:",
        "Assistant:", "Bot:", "Answer:", "### Answer:",
        "\nResponse:", "\n### Response:"
    ]
    for prefix in prefixes_to_remove:
        if ai_response.lower().startswith(prefix.lower()):
            ai_response = ai_response[len(prefix):].strip()

    if "### Response:" in ai_response:
        parts = ai_response.split("### Response:", 1)
        if len(parts) > 1:
            ai_response = parts[1].strip()

    if not ai_response or len(ai_response) < 3:
        colon_patterns = [
            r'### Response:\s*(.+?)(?=\n\n|$)',
            r'Response:\s*(.+?)(?=\n\n|$)',
            r'AI:\s*(.+?)(?=\n\n|$)',
            r'Assistant:\s*(.+?)(?=\n\n|$)'
        ]
        for pattern in colon_patterns:
            match = re.search(pattern, full_response, re.DOTALL | re.IGNORECASE)
            if match:
                ai_response = match.group(1).strip()
                break

    if not ai_response:
        return "I'm here to chat! Could you rephrase that?"

    complete_text = get_complete_sentences_up_to_limit(ai_response, max_tokens=150)
    if complete_text:
        ai_response = complete_text
    else:
        last_punct = max(
            ai_response.rfind('.'),
            ai_response.rfind('!'),
            ai_response.rfind('?')
        )
        if last_punct > 0:
            ai_response = ai_response[:last_punct + 1].strip()
        else:
            ai_response = ai_response.rstrip() + '.'

    ai_response = ensure_period_termination(ai_response)
    if ai_response and ai_response[0].isalpha():
        ai_response = ai_response[0].upper() + ai_response[1:]
    ai_response = re.sub(r'\.\.+', '.', ai_response)
    ai_response = re.sub(r'\s+', ' ', ai_response).strip()

    if len(ai_response) < 5:
        return "I'm here to chat! Could you rephrase that?"
    return ai_response


def split_into_sentences(text):
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]


def generate_ai_response(user_message):
    inputs = tokenizer(user_message, return_tensors="pt", padding=True)
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=150,
            temperature=0.85,
            top_p=0.9,
            do_sample=True,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
            early_stopping=True
        )
    full_response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return clean_and_format_response(full_response, user_message)


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/chat/stream', methods=['GET'])
def chat_stream():
    global current_session_id, chat_sessions

    ensure_model_loaded()

    if model is None:
        def error_stream():
            yield f"data: {json.dumps({'error': 'Model not loaded'})}\n\n"
        return Response(stream_with_context(error_stream()), mimetype='text/event-stream')

    user_message = request.args.get('message', '').strip()
    session_id   = request.args.get('session_id', None)

    if not user_message:
        def empty_stream():
            yield f"data: {json.dumps({'error': 'Empty message'})}\n\n"
        return Response(stream_with_context(empty_stream()), mimetype='text/event-stream')

    if session_id and session_id in chat_sessions:
        session = chat_sessions[session_id]
    else:
        session = ChatSession()
        chat_sessions[session.session_id] = session

    current_session_id = session.session_id

    def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'thinking', 'session_id': session.session_id})}\n\n"
            ai_response = generate_ai_response(user_message)
            sentences = split_into_sentences(ai_response)
            for idx, sentence in enumerate(sentences):
                payload = {
                    'type': 'sentence',
                    'index': idx,
                    'text': sentence,
                    'is_last': idx == len(sentences) - 1,
                    'session_id': session.session_id
                }
                yield f"data: {json.dumps(payload)}\n\n"
                time.sleep(0.35)
            session.add_interaction(user_message, ai_response)
            yield f"data: {json.dumps({'type': 'done', 'session_id': session.session_id, 'interaction_count': len(session.history)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)[:150]})}\n\n"

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@app.route('/chat', methods=['POST'])
def chat():
    global current_session_id, chat_sessions
    ensure_model_loaded()
    if model is None:
        return jsonify({'error': 'Model not loaded. Please check server logs.'}), 500
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        session_id = data.get('session_id', None)
        if not user_message:
            return jsonify({'error': 'Please enter a message'}), 400
        if session_id and session_id in chat_sessions:
            session = chat_sessions[session_id]
        else:
            session = ChatSession()
            chat_sessions[session.session_id] = session
        current_session_id = session.session_id
        ai_response = generate_ai_response(user_message)
        session.add_interaction(user_message, ai_response)
        return jsonify({
            'response': ai_response,
            'session_id': session.session_id,
            'interaction_count': len(session.history)
        })
    except Exception as e:
        return jsonify({'error': str(e)[:150]}), 500


@app.route('/sessions', methods=['GET'])
def list_sessions():
    sessions_list = [
        {
            'session_id': s.session_id,
            'created_at': s.created_at.isoformat(),
            'last_updated': s.last_updated.isoformat(),
            'total_interactions': len(s.history)
        }
        for s in chat_sessions.values()
    ]
    sessions_list.sort(key=lambda x: x['last_updated'], reverse=True)
    return jsonify({'sessions': sessions_list})


@app.route('/session/<session_id>', methods=['GET'])
def get_session(session_id):
    if session_id not in chat_sessions:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify(chat_sessions[session_id].to_json())


@app.route('/export/<session_id>/<fmt>', methods=['GET'])
def export_session(session_id, fmt):
    if session_id not in chat_sessions:
        return jsonify({'error': 'Session not found'}), 404
    session = chat_sessions[session_id]
    if fmt == 'json':
        resp = app.response_class(
            response=json.dumps(session.to_json(), indent=2),
            status=200, mimetype='application/json'
        )
        resp.headers['Content-Disposition'] = f'attachment; filename=chat_{session_id}.json'
        return resp
    elif fmt == 'text':
        resp = app.response_class(
            response=session.to_text(), status=200, mimetype='text/plain'
        )
        resp.headers['Content-Disposition'] = f'attachment; filename=chat_{session_id}.txt'
        return resp
    return jsonify({'error': 'Invalid format. Use "json" or "text"'}), 400


@app.route('/session/current', methods=['GET'])
def get_current_session():
    if not current_session_id or current_session_id not in chat_sessions:
        return jsonify({'error': 'No active session'}), 404
    return jsonify(chat_sessions[current_session_id].to_json())


@app.route('/session/new', methods=['POST'])
def new_session():
    global current_session_id
    session = ChatSession()
    chat_sessions[session.session_id] = session
    current_session_id = session.session_id
    return jsonify({
        'message': 'New session created',
        'session_id': session.session_id,
        'session': session.to_json()
    })


@app.route('/session/<session_id>/delete', methods=['DELETE'])
def delete_session(session_id):
    global current_session_id
    if session_id not in chat_sessions:
        return jsonify({'error': 'Session not found'}), 404
    if current_session_id == session_id:
        current_session_id = None
    del chat_sessions[session_id]
    return jsonify({'message': f'Session {session_id} deleted successfully'})


# ── Entrypoint (local dev only — gunicorn ignores this block) ──
if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Starting IvieAI server (local dev mode)...")
    print(f"   Model : {MODEL_ID}")
    print("   Visit : http://localhost:5000")
    print("=" * 60)
    load_model()
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
