# app_local.py
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import re
import os
import json
import io
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
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_ID,
            token=TOKEN,
            trust_remote_code=True
        )
        
        # Set pad token if not set
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            token=TOKEN,
            trust_remote_code=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        )
        
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
    
    if text and text[-1] in '.!?":':
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
    """Extract, clean, and format response with proper termination"""
    
    ai_response = full_response[len(user_message):].strip()
    
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
    ai_response = re.sub(r'\s+', ' ', ai_response)
    
    if len(ai_response) < 5:
        return "I'm here to chat! Could you rephrase that?"
    
    return ai_response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    global model, tokenizer, current_session_id, chat_sessions
    
    if model is None:
        return jsonify({'error': 'Model not loaded. Please check server logs.'}), 500
    
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        session_id = data.get('session_id', None)
        
        if not user_message:
            return jsonify({'error': 'Please enter a message'}), 400
        
        # Get or create session
        if session_id and session_id in chat_sessions:
            session = chat_sessions[session_id]
        else:
            session = ChatSession()
            chat_sessions[session.session_id] = session
        
        current_session_id = session.session_id
        
        print(f"📝 Processing: {user_message[:50]}... (Session: {session.session_id})")
        
        # Tokenize input with padding
        inputs = tokenizer(user_message, return_tensors="pt", padding=True)
        
        # Generate response
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
        ai_response = clean_and_format_response(full_response, user_message)
        
        # Add to chat history
        session.add_interaction(user_message, ai_response)
        
        print(f"🤖 Response: {ai_response}")
        return jsonify({
            'response': ai_response,
            'session_id': session.session_id,
            'interaction_count': len(session.history)
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)[:150]}), 500

@app.route('/sessions', methods=['GET'])
def list_sessions():
    """List all available chat sessions"""
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
    """Get a specific chat session"""
    if session_id not in chat_sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session = chat_sessions[session_id]
    return jsonify(session.to_json())

@app.route('/export/<session_id>/<format>', methods=['GET'])
def export_session(session_id, format):
    """Export a chat session in specified format (text or json)"""
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
    """Get the current active session"""
    if not current_session_id or current_session_id not in chat_sessions:
        return jsonify({'error': 'No active session'}), 404
    
    session = chat_sessions[current_session_id]
    return jsonify(session.to_json())

@app.route('/session/new', methods=['POST'])
def new_session():
    """Create a new chat session"""
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
    """Delete a chat session"""
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
    print("✨ Responses will always terminate with proper punctuation (.)")
    print("💾 Chat history is now enabled with export capabilities")
    
    if load_model():
        print("\n✅ Server ready! Visit: http://localhost:5000")
        app.run(debug=True, host='0.0.0.0', port=5000)
    else:
        print("\n❌ Failed to load model. Please check your token and model access.")
