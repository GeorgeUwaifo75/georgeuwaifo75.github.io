// DOM Elements
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendBtn');
const aiMessageDiv = document.getElementById('aiMessage');
const serverStatusSpan = document.getElementById('serverStatus');

// Auto-resize textarea
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(110, userInput.scrollHeight) + 'px';
}

userInput.addEventListener('input', autoResizeTextarea);

// Helper: Set loading state
function setLoading(isLoading) {
    if (isLoading) {
        aiMessageDiv.innerHTML = `
            <div class="loading-dots" style="display: inline-flex; gap: 6px; align-items: center;">
                <span></span><span></span><span></span>
            </div>
            <span style="margin-left: 6px; color:#b87b4a;">Ivie is thinking...</span>
        `;
    }
}

// Helper: Set response text
function setResponseText(text) {
    if (!text || text.trim() === "") {
        aiMessageDiv.innerHTML = `<span class="placeholder-message">🤗 Hmm, I didn't catch that — ask me something else?</span>`;
        return;
    }
    // Escape HTML and preserve line breaks
    const safeText = escapeHtml(text);
    aiMessageDiv.innerHTML = safeText.replace(/\n/g, '<br>');
}

// Helper: Set error message
function setError(errorMsg) {
    aiMessageDiv.innerHTML = `
        <span style="color:#d14b2a;">⚠️ ${escapeHtml(errorMsg)}</span>
        <br>
        <span class="placeholder-message" style="font-size:0.85rem;">💡 Try again in a moment!</span>
    `;
}

// Helper: Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Update server status
function updateServerStatus(connected) {
    if (connected) {
        serverStatusSpan.innerHTML = '● Server: Connected';
        serverStatusSpan.style.color = '#4caf50';
    } else {
        serverStatusSpan.innerHTML = '○ Server: Disconnected';
        serverStatusSpan.style.color = '#f44336';
    }
}

// Send message to backend
async function sendMessage() {
    const userText = userInput.value.trim();
    
    if (!userText) {
        setResponseText("💭 Type something and I'll reply! Ask me about anything — life, ideas, stories.");
        return;
    }
    
    // Disable input and button while processing
    sendButton.disabled = true;
    userInput.disabled = true;
    setLoading(true);
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userText })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.response) {
            setResponseText(data.response);
            updateServerStatus(true);
        } else {
            throw new Error('No response from AI');
        }
        
    } catch (error) {
        console.error('Error:', error);
        updateServerStatus(false);
        
        let errorMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server. Make sure the Flask app is running on port 5000.';
        } else if (error.message.includes('401')) {
            errorMessage = 'Invalid API token. Please check your Hugging Face token in the .env file.';
        } else if (error.message.includes('503')) {
            errorMessage = 'Model is loading. Please wait a moment and try again.';
        }
        
        setError(errorMessage);
    } finally {
        sendButton.disabled = false;
        userInput.disabled = false;
        userInput.value = '';
        autoResizeTextarea();
        userInput.focus();
    }
}

// Handle Enter key (Shift+Enter for new line)
function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
            sendMessage();
        }
    }
}

// Event listeners
userInput.addEventListener('keydown', handleKeydown);
sendButton.addEventListener('click', sendMessage);

// Check server connection on load
async function checkServer() {
    try {
        const response = await fetch('/');
        if (response.ok) {
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        updateServerStatus(false);
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    userInput.focus();
    checkServer();
    autoResizeTextarea();
});
