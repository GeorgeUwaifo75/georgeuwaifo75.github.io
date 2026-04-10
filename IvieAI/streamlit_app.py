# streamlit_app.py
import streamlit as st
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import re
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd
from io import StringIO

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="IvieAI - Friendly Chat Assistant",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS with three theme colors (Green, White, Blue)
st.markdown("""
<style>
    /* Main background with gradient using Green, White, Blue */
    .stApp {
        background: linear-gradient(135deg, #0d6e2e 0%, #ffffff 50%, #1565c0 100%);
    }
    
    /* Header styling */
    .main-header {
        text-align: center;
        padding: 1.5rem;
        background: linear-gradient(135deg, #0d6e2e 0%, #ffffff 50%, #1565c0 100%);
        border-radius: 15px;
        margin-bottom: 2rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    
    .main-header h1 {
        color: #0d6e2e;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        margin: 0;
    }
    
    .main-header p {
        color: #1565c0;
        margin-top: 0.5rem;
        font-weight: 500;
    }
    
    /* Chat message styling */
    .chat-message {
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
    }
    
    .user-message {
        background: linear-gradient(135deg, #0d6e2e 0%, #1b8c3a 100%);
        border-left: 4px solid #1565c0;
        color: white;
    }
    
    .assistant-message {
        background: linear-gradient(135deg, #1565c0 0%, #1e88e5 100%);
        border-left: 4px solid #0d6e2e;
        color: white;
    }
    
    /* Button styling */
    .stButton button {
        width: 100%;
        background: linear-gradient(135deg, #0d6e2e 0%, #1565c0 100%);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        transition: all 0.3s ease;
        font-weight: 500;
    }
    
    .stButton button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        background: linear-gradient(135deg, #0b5e25 0%, #0d47a1 100%);
    }
    
    /* Session card styling */
    .session-card {
        background: linear-gradient(135deg, rgba(13,110,46,0.05) 0%, rgba(255,255,255,0.9) 50%, rgba(21,101,192,0.05) 100%);
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
        border: 1px solid #0d6e2e;
        transition: all 0.3s ease;
    }
    
    .session-card:hover {
        transform: translateX(5px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border-color: #1565c0;
    }
    
    /* Export buttons container */
    .export-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
    }
    
    /* Metric card styling */
    .metric-card {
        background: linear-gradient(135deg, #0d6e2e 0%, #1565c0 100%);
        color: white;
        padding: 1rem;
        border-radius: 0.5rem;
        text-align: center;
    }
    
    /* Status indicators */
    .status-indicator {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 0.5rem;
    }
    
    .status-online {
        background-color: #0d6e2e;
        box-shadow: 0 0 5px #0d6e2e;
    }
    
    .status-offline {
        background-color: #1565c0;
    }
    
    /* Sidebar styling */
    .css-1d391kg, .css-12oz5g7 {
        background: linear-gradient(180deg, rgba(13,110,46,0.05) 0%, rgba(255,255,255,0.95) 50%, rgba(21,101,192,0.05) 100%);
    }
    
    /* Chat input styling */
    .stChatInputContainer {
        border-radius: 10px;
        border: 2px solid #0d6e2e;
    }
    
    .stChatInputContainer:focus-within {
        border-color: #1565c0;
        box-shadow: 0 0 5px rgba(21,101,192,0.3);
    }
    
    /* Info box styling */
    .stAlert {
        background: linear-gradient(135deg, rgba(13,110,46,0.1) 0%, rgba(255,255,255,0.9) 50%, rgba(21,101,192,0.1) 100%);
        border-left: 4px solid #0d6e2e;
        color: #0d6e2e;
    }
    
    /* Divider styling */
    hr {
        border-color: #1565c0;
        border-width: 2px;
    }
    
    /* Selectbox styling */
    .stSelectbox label {
        color: #0d6e2e;
        font-weight: 500;
    }
    
    /* Headers in sidebar */
    .sidebar-header {
        color: #1565c0;
        font-weight: bold;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }
    
    /* Session info bar */
    .session-info {
        background: linear-gradient(135deg, rgba(13,110,46,0.1) 0%, rgba(255,255,255,0.95) 50%, rgba(21,101,192,0.1) 100%);
        padding: 0.5rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        border-left: 4px solid #0d6e2e;
    }
    
    .session-info small {
        color: #0d6e2e;
    }
    
    /* Welcome message styling */
    .welcome-card {
        background: linear-gradient(135deg, rgba(13,110,46,0.05) 0%, rgba(255,255,255,0.95) 50%, rgba(21,101,192,0.05) 100%);
        padding: 2rem;
        border-radius: 15px;
        text-align: center;
        border: 1px solid #0d6e2e;
    }
    
    .welcome-card h3 {
        color: #0d6e2e;
    }
    
    .welcome-card ul {
        color: #1565c0;
        list-style-type: none;
        padding: 0;
    }
    
    .welcome-card li {
        margin: 0.5rem 0;
    }
    
    /* Tabs styling */
    .stTabs [data-baseweb="tab-list"] button [data-testid="stMarkdownContainer"] p {
        color: #0d6e2e;
    }
    
    .stTabs [data-baseweb="tab-list"] button[aria-selected="true"] {
        border-bottom-color: #1565c0;
    }
    
    /* Streamlit chat message custom styling */
    [data-testid="stChatMessage"] {
        background: transparent !important;
    }
    
    /* Spinner styling */
    .stSpinner > div {
        border-top-color: #0d6e2e !important;
        border-right-color: #1565c0 !important;
        border-bottom-color: #0d6e2e !important;
        border-left-color: #1565c0 !important;
    }
    
    /* Success message styling */
    .stSuccess {
        background: linear-gradient(135deg, rgba(13,110,46,0.1) 0%, rgba(255,255,255,0.9) 50%, rgba(21,101,192,0.1) 100%);
        border-left: 4px solid #0d6e2e;
    }
    
    /* Error message styling */
    .stError {
        background: linear-gradient(135deg, rgba(13,110,46,0.1) 0%, rgba(255,255,255,0.9) 50%, rgba(21,101,192,0.1) 100%);
        border-left: 4px solid #1565c0;
    }
    
    /* Download button styling */
    .stDownloadButton button {
        background: linear-gradient(135deg, #0d6e2e 0%, #1565c0 100%);
        color: white;
    }
    
    .stDownloadButton button:hover {
        background: linear-gradient(135deg, #0b5e25 0%, #0d47a1 100%);
    }
</style>
""", unsafe_allow_html=True)

# Model configuration
MODEL_ID = os.getenv('MODEL_ID', "GeorgeUwaifo/ivie_gpt2_new01c_results")
TOKEN = os.getenv('HF_TOKEN')

# Initialize session state
if 'initialized' not in st.session_state:
    st.session_state.initialized = False
    st.session_state.model = None
    st.session_state.tokenizer = None
    st.session_state.chat_sessions = {}
    st.session_state.current_session_id = None
    st.session_state.messages = []
    st.session_state.model_loaded = False

class ChatSession:
    """Class to manage chat sessions"""
    def __init__(self, session_id=None):
        self.session_id = session_id or datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        self.history = []
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
    
    def add_interaction(self, user_message, ai_response):
        self.history.append({
            "trigger": user_message,
            "reply": ai_response
        })
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
    
    def to_dataframe(self):
        """Convert history to pandas DataFrame"""
        return pd.DataFrame(self.history)

@st.cache_resource
def load_model():
    """Load the model with caching"""
    try:
        if not TOKEN:
            st.error("HF_TOKEN not found. Please set it in environment variables.")
            return None, None
        
        with st.spinner("Loading IvieAI model... This may take a few moments..."):
            tokenizer = AutoTokenizer.from_pretrained(
                MODEL_ID,
                token=TOKEN,
                trust_remote_code=True
            )
            
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
            
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID,
                token=TOKEN,
                trust_remote_code=True,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
            )
            
            # Move to GPU if available
            if torch.cuda.is_available():
                model = model.cuda()
            
            return model, tokenizer
            
    except Exception as e:
        st.error(f"Failed to load model: {str(e)}")
        return None, None

def ensure_period_termination(text):
    """Ensure the response ends with proper punctuation"""
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
    """Clean and format the AI response"""
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

def generate_response(user_message):
    """Generate response from the model"""
    if st.session_state.model is None or st.session_state.tokenizer is None:
        return "Model not loaded. Please check the configuration."
    
    try:
        # Tokenize input
        inputs = st.session_state.tokenizer(user_message, return_tensors="pt", padding=True)
        
        # Move to GPU if available
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        # Generate response
        with torch.no_grad():
            outputs = st.session_state.model.generate(
                **inputs,
                max_new_tokens=150,
                temperature=0.85,
                top_p=0.9,
                do_sample=True,
                repetition_penalty=1.1,
                pad_token_id=st.session_state.tokenizer.pad_token_id,
                eos_token_id=st.session_state.tokenizer.eos_token_id,
                early_stopping=True
            )
        
        # Decode response
        full_response = st.session_state.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Clean and format
        ai_response = clean_and_format_response(full_response, user_message)
        
        return ai_response
        
    except Exception as e:
        return f"Error generating response: {str(e)}"

def create_new_session():
    """Create a new chat session"""
    session = ChatSession()
    st.session_state.chat_sessions[session.session_id] = session
    st.session_state.current_session_id = session.session_id
    st.session_state.messages = []
    return session

def switch_session(session_id):
    """Switch to a different chat session"""
    if session_id in st.session_state.chat_sessions:
        st.session_state.current_session_id = session_id
        session = st.session_state.chat_sessions[session_id]
        # Convert history to messages format
        st.session_state.messages = []
        for interaction in session.history:
            st.session_state.messages.append({"role": "user", "content": interaction["trigger"]})
            st.session_state.messages.append({"role": "assistant", "content": interaction["reply"]})

def export_session(session_id, format_type):
    """Export a session in specified format"""
    if session_id not in st.session_state.chat_sessions:
        return None
    
    session = st.session_state.chat_sessions[session_id]
    
    if format_type == "json":
        return json.dumps(session.to_json(), indent=2)
    elif format_type == "text":
        return session.to_text()
    elif format_type == "csv":
        df = session.to_dataframe()
        return df.to_csv(index=False)
    return None

# Main application
def main():
    # Header
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div class="main-header">
            <h1>✨ IvieAI ✨</h1>
            <p>Your Friendly AI Chat Assistant</p>
        </div>
        """, unsafe_allow_html=True)
    
    # Sidebar
    with st.sidebar:
        st.markdown("### 🤖 IvieAI Controls")
        
        # Model status
        if st.session_state.model_loaded:
            st.markdown(f"""
            <div class="metric-card">
                <span class="status-indicator status-online"></span>
                <strong>Model Status:</strong> Online<br>
                <small>{MODEL_ID}</small>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="metric-card">
                <span class="status-indicator status-offline"></span>
                <strong>Model Status:</strong> Loading...<br>
                <small>{MODEL_ID}</small>
            </div>
            """, unsafe_allow_html=True)
        
        st.divider()
        
        # Model loading button
        if not st.session_state.model_loaded:
            if st.button("🚀 Load Model", use_container_width=True):
                with st.spinner("Loading model..."):
                    model, tokenizer = load_model()
                    if model and tokenizer:
                        st.session_state.model = model
                        st.session_state.tokenizer = tokenizer
                        st.session_state.model_loaded = True
                        st.session_state.initialized = True
                        st.rerun()
        
        st.divider()
        
        # Session management
        st.markdown("### 💬 Chat Sessions")
        
        # New session button
        if st.button("🆕 New Conversation", use_container_width=True):
            new_session = create_new_session()
            st.rerun()
        
        # List sessions
        if st.session_state.chat_sessions:
            st.markdown("#### Recent Sessions")
            for session_id, session in sorted(
                st.session_state.chat_sessions.items(),
                key=lambda x: x[1].last_updated,
                reverse=True
            )[:10]:
                col1, col2 = st.columns([4, 1])
                with col1:
                    if st.button(
                        f"💬 {session_id[:12]}... ({len(session.history)} msgs)",
                        key=f"session_{session_id}",
                        use_container_width=True
                    ):
                        switch_session(session_id)
                        st.rerun()
                with col2:
                    if st.button("🗑️", key=f"delete_{session_id}"):
                        if session_id in st.session_state.chat_sessions:
                            del st.session_state.chat_sessions[session_id]
                            if st.session_state.current_session_id == session_id:
                                create_new_session()
                            st.rerun()
        
        st.divider()
        
        # Export controls
        st.markdown("### 📤 Export Options")
        
        if st.session_state.current_session_id:
            current_session = st.session_state.chat_sessions.get(st.session_state.current_session_id)
            if current_session:
                # Export format selection
                export_format = st.selectbox(
                    "Export Format",
                    ["text", "json", "csv"],
                    help="Choose the format for exporting your conversation"
                )
                
                # Export button
                if st.button("📥 Export Current Session", use_container_width=True):
                    export_data = export_session(st.session_state.current_session_id, export_format)
                    if export_data:
                        file_extension = export_format
                        if export_format == "csv":
                            mime_type = "text/csv"
                        elif export_format == "json":
                            mime_type = "application/json"
                        else:
                            mime_type = "text/plain"
                        
                        st.download_button(
                            label="💾 Download File",
                            data=export_data,
                            file_name=f"ivieai_chat_{st.session_state.current_session_id}.{file_extension}",
                            mime=mime_type,
                            use_container_width=True
                        )
        
        st.divider()
        
        # Stats
        if st.session_state.chat_sessions:
            total_messages = sum(len(session.history) for session in st.session_state.chat_sessions.values())
            st.markdown(f"""
            <div class="metric-card">
                <strong>📊 Statistics</strong><br>
                Total Sessions: {len(st.session_state.chat_sessions)}<br>
                Total Messages: {total_messages}
            </div>
            """, unsafe_allow_html=True)
    
    # Main chat area
    if not st.session_state.model_loaded:
        st.markdown("""
        <div class="welcome-card">
            <h3>👋 Welcome to IvieAI!</h3>
            <p>Click 'Load Model' in the sidebar to start chatting.</p>
            <h3>✨ Features:</h3>
            <ul>
                <li>💬 Natural conversations</li>
                <li>📚 Multiple chat sessions</li>
                <li>📤 Export chats as text, JSON, or CSV</li>
                <li>🎨 Beautiful, responsive interface</li>
                <li>⚡ Fast responses with proper formatting</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)
    else:
        # Ensure current session exists
        if not st.session_state.current_session_id or st.session_state.current_session_id not in st.session_state.chat_sessions:
            create_new_session()
        
        # Display current session info
        current_session = st.session_state.chat_sessions[st.session_state.current_session_id]
        st.markdown(f"""
        <div class="session-info">
            <small>
                <strong>Current Session:</strong> {current_session.session_id[:20]}... | 
                <strong>Messages:</strong> {len(current_session.history)} | 
                <strong>Last Updated:</strong> {current_session.last_updated.strftime('%H:%M:%S')}
            </small>
        </div>
        """, unsafe_allow_html=True)
        
        # Chat container
        chat_container = st.container()
        
        with chat_container:
            # Display chat messages
            for message in st.session_state.messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
        
        # Chat input
        if prompt := st.chat_input("Type your message here..."):
            # Add user message
            st.session_state.messages.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)
            
            # Generate response
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    response = generate_response(prompt)
                    st.markdown(response)
            
            # Add assistant message
            st.session_state.messages.append({"role": "assistant", "content": response})
            
            # Save to session history
            current_session.add_interaction(prompt, response)

if __name__ == "__main__":
    main()
