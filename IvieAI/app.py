# ===/IvieAI/app.py ===

from flask import Flask, render_template, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import re
import os
import json
import io
import time
from datetime import datetime
from dotenv import load_dotenv
import os.path

load_dotenv()

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Create Flask app with explicit template and static folder paths
app = Flask(__name__,
           template_folder=os.path.join(BASE_DIR, 'templates'),
           static_folder=os.path.join(BASE_DIR, 'static'),
           static_url_path='/static')

CORS(app)

MODEL_ID = "GeorgeUwaifo/ivie_gpt2_new01c_results"
TOKEN = os.getenv('HF_TOKEN')

# For Hugging Face token - if HF_TOKEN doesn't work, try HF_API_TOKEN
if not TOKEN:
    TOKEN = os.getenv('HF_API_TOKEN')

# Global variables for model and chat history
model = None
tokenizer = None
chat_sessions = {}  # Store sessions by session_id
current_session_id = None

class ChatSession:
    """Class to manage a single chat session"""
    def __init__(self, session_id=None):
        self.session_id = session_id or datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        self.history = []  # List of {"trigger": user_msg, "reply": ai_msg}
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
    
    def add_interaction(self, user_message, ai_response):
        """Add a new interaction to the history"""
        self.history.append({
            "trigger": user_message,
            "reply": ai_response
        })
        self.last_updated = datetime.now()
    
    def to_json(self):
        """Export session as JSON structure"""
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "total_interactions": len(self.history),
            "history": self.history
        }
    
    def to_text(self):
        """Export session as plain text"""
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
    """Load the model once at startup"""
    global model, tokenizer
    print(f"Loading model: {MODEL_ID}")
    print(f"Base directory: {BASE_DIR}")
    
    try:
        # Check if token is available
        if not TOKEN:
            print("⚠️ Warning: No Hugging Face token found. Set HF_TOKEN or HF_API_TOKEN in .env file")
        
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID,
            token=TOKEN,
            trust_remote_code=True
        )
        
        # Set pad token if not set
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # Set padding side to left for better generation
        tokenizer.padding_side = "left"
        
        # Determine device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")
        
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            token=TOKEN,
            trust_remote_code=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True
        )
        
        # Move to GPU if available
        if torch.cuda.is_available():
            model = model.cuda()
            print("✅ Model moved to GPU")
        
        # Set model to evaluation mode
        model.eval()
        
        print("✅ Model loaded successfully!")
        return True
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False

def ensure_period_termination(text):
    """Ensure the response ends with a period (.)"""
    if not text:
        return text
    
    text = text.rstrip()
    
    if text and text[-1] in '.!?"\':':
        return text
    
    return text + '.'

def get_complete_sentences_up_to_limit(text, max_tokens=150):
    """Extract complete sentences while respecting token limits"""
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
    """Extract, clean, and format response with proper termination."""
    
    # First, remove the user message from the beginning if present
    ai_response = full_response[len(user_message):].strip()
    
    # Remove common prefixes that the model might add
    prefixes_to_remove = [
        "### Response:",
        "### Response",
        "Response:",
        "AI:",
        "Assistant:",
        "Bot:",
        "Answer:",
        "### Answer:",
        "\nResponse:",
        "\n### Response:"
    ]
    
    for prefix in prefixes_to_remove:
        if ai_response.startswith(prefix):
            ai_response = ai_response[len(prefix):].strip()
        # Also check with different capitalization
        if ai_response.lower().startswith(prefix.lower()):
            ai_response = ai_response[len(prefix):].strip()
    
    # Also check if the prefix appears with a newline
    if "### Response:" in ai_response:
        parts = ai_response.split("### Response:", 1)
        if len(parts) > 1:
            ai_response = parts[1].strip()
    
    # If still empty or invalid, try to find the first sentence after any colon
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
    
    # Remove any question sentences
    raw_sentences = re.split(r'(?<=[.!?])\s+', ai_response.strip())
    filtered_sentences = [
        s.strip()
        for s in raw_sentences
        if s.strip() and not s.strip().endswith('?')
    ]
    
    if not filtered_sentences:
        return "I'm here to chat! Could you rephrase that?"
    
    ai_response = ' '.join(filtered_sentences)
    
    # Complete sentences extraction
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
    
    # Ensure proper termination
    ai_response = ensure_period_termination(ai_response)
    
    # Capitalize first letter
    if ai_response and ai_response[0].isalpha():
        ai_response = ai_response[0].upper() + ai_response[1:]
    
    # Clean up extra spaces and duplicate punctuation
    ai_response = re.sub(r'\.\.+', '.', ai_response)
    ai_response = re.sub(r'\s+', ' ', ai_response)
    
    # Final check for validity
    if len(ai_response) < 5:
        return "I'm here to chat! Could you rephrase that?"
    
    return ai_response

def split_into_sentences(text):
    """Split response text into individual sentences for streaming."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]

def generate_ai_response(user_message):
    """Run model inference and return cleaned response string."""
    # Tokenize input with proper attention mask and device placement
    inputs = tokenizer(user_message, return_tensors="pt", padding=True, truncation=True, max_length=512)
    
    # Move inputs to same device as model
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=150,
            temperature=0.75,
            top_p=0.92,
            top_k=50,
            do_sample=True,
            repetition_penalty=1.15,
            no_repeat_ngram_size=3,
            length_penalty=1.0,
            early_stopping=True,
            num_beams=2,
            use_cache=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
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
    """
    Server-Sent Events endpoint.
    Streams the AI response sentence-by-sentence.
    """
    global model, tokenizer, current_session_id, chat_sessions

    if model is None:
        def error_stream():
            yield f"data: {json.dumps({'error': 'Model not loaded'})}\n\n"
        return Response(stream_with_context(error_stream()),
                        mimetype='text/event-stream')

    user_message = request.args.get('message', '').strip()
    session_id   = request.args.get('session_id', None)

    if not user_message:
        def empty_stream():
            yield f"data: {json.dumps({'error': 'Empty message'})}\n\n"
        return Response(stream_with_context(empty_stream()),
                        mimetype='text/event-stream')

    # Resolve / create session
    if session_id and session_id in chat_sessions:
        session = chat_sessions[session_id]
    else:
        session = ChatSession()
        chat_sessions[session.session_id] = session

    current_session_id = session.session_id

    def event_stream():
        try:
            # 1. Yield a "thinking" signal so the UI can show a loader
            yield f"data: {json.dumps({'type': 'thinking', 'session_id': session.session_id})}\n\n"

            # 2. Run inference
            ai_response = generate_ai_response(user_message)

            # 3. Split into sentences and stream each one
            sentences = split_into_sentences(ai_response)
            for idx, sentence in enumerate(sentences):
                payload = {
                    'type':      'sentence',
                    'index':     idx,
                    'text':      sentence,
                    'is_last':   idx == len(sentences) - 1,
                    'session_id': session.session_id
                }
                yield f"data: {json.dumps(payload)}\n\n"
                # Small delay between sentences
                time.sleep(0.35)

            # 4. Save to history & send a "done" event
            session.add_interaction(user_message, ai_response)
            yield f"data: {json.dumps({'type': 'done', 'session_id': session.session_id, 'interaction_count': len(session.history)})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)[:150]})}\n\n"

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )


@app.route('/chat', methods=['POST'])
def chat():
    """Legacy non-streaming endpoint (kept for backward compatibility)."""
    global model, tokenizer, current_session_id, chat_sessions
    
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
    sessions_list = []
    for session_id, session in chat_sessions.items():
        sessions_list.append({
            'session_id': session.session_id,
            'created_at': session.created_at.isoformat(),
            'last_updated': session.last_updated.isoformat(),
            'total_interactions': len(session.history)
        })
    sessions_list.sort(key=lambda x: x['last_updated'], reverse=True)
    return jsonify({'sessions': sessions_list})


@app.route('/session/<session_id>', methods=['GET'])
def get_session(session_id):
    if session_id not in chat_sessions:
        return jsonify({'error': 'Session not found'}), 404
    session = chat_sessions[session_id]
    return jsonify(session.to_json())


@app.route('/export/<session_id>/<format>', methods=['GET'])
def export_session(session_id, format):
    if session_id not in chat_sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session = chat_sessions[session_id]
    
    if format == 'json':
        data = session.to_json()
        response = app.response_class(
            response=json.dumps(data, indent=2),
            status=200,
            mimetype='application/json'
        )
        response.headers['Content-Disposition'] = f'attachment; filename=chat_{session_id}.json'
        return response
    
    elif format == 'text':
        text_content = session.to_text()
        response = app.response_class(
            response=text_content,
            status=200,
            mimetype='text/plain'
        )
        response.headers['Content-Disposition'] = f'attachment; filename=chat_{session_id}.txt'
        return response
    
    else:
        return jsonify({'error': 'Invalid format. Use "json" or "text"'}), 400


@app.route('/session/current', methods=['GET'])
def get_current_session():
    if not current_session_id or current_session_id not in chat_sessions:
        return jsonify({'error': 'No active session'}), 404
    session = chat_sessions[current_session_id]
    return jsonify(session.to_json())


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


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Starting IvieAI server with local model...")
    print(f"Model: {MODEL_ID}")
    print(f"Base Directory: {BASE_DIR}")
    print(f"Templates Folder: {os.path.join(BASE_DIR, 'templates')}")
    print(f"Static Folder: {os.path.join(BASE_DIR, 'static')}")
    print("✨ Responses stream sentence-by-sentence")
    print("💾 Chat history is enabled with export capabilities")
    
    if load_model():
        print("\n✅ Server ready!")
        print("📍 Visit: http://localhost:5000")
        print("📍 Or: http://127.0.0.1:5000")
        app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
    else:
        print("\n❌ Failed to load model. Please check your token and model access.")
