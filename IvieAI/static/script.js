// script.js
let currentSessionId = null;
let isProcessing = false;

// DOM Elements
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const aiMessageDiv = document.getElementById('aiMessage');
const serverStatus = document.getElementById('serverStatus');
const sessionIdSpan = document.getElementById('sessionId');
const interactionCountSpan = document.getElementById('interactionCount');
const newSessionBtn = document.getElementById('newSessionBtn');
const exportTextBtn = document.getElementById('exportTextBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');

// Modal Elements
const historyModal = document.getElementById('historyModal');
const sessionsList = document.getElementById('sessionsList');
const closeModal = document.querySelector('.close-modal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Update session info in UI
function updateSessionInfo(sessionId, interactionCount) {
    if (sessionId) {
        currentSessionId = sessionId;
        sessionIdSpan.textContent = sessionId.substring(0, 12) + '...';
        sessionIdSpan.title = sessionId;
    }
    if (interactionCount !== undefined) {
        interactionCountSpan.textContent = interactionCount;
    }
}

// Send message to server
async function sendMessage() {
    if (isProcessing) {
        showToast('Please wait, processing your request...', 'info');
        return;
    }
    
    const message = userInput.value.trim();
    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }
    
    isProcessing = true;
    aiMessageDiv.innerHTML = '<span class="loading-message">🤔 Thinking...</span>';
    sendBtn.disabled = true;
    userInput.disabled = true;
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                session_id: currentSessionId 
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        aiMessageDiv.innerHTML = `<span class="ai-response">${escapeHtml(data.response)}</span>`;
        
        if (data.session_id) {
            updateSessionInfo(data.session_id, data.interaction_count);
        }
        
        userInput.value = '';
        userInput.style.height = 'auto';
        
    } catch (error) {
        console.error('Error:', error);
        aiMessageDiv.innerHTML = `<span class="error-message">❌ Error: ${error.message}. Please try again.</span>`;
        showToast('Failed to get response: ' + error.message, 'error');
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

// Create new session
async function createNewSession() {
    try {
        const response = await fetch('/session/new', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to create new session');
        }
        
        const data = await response.json();
        updateSessionInfo(data.session_id, 0);
        aiMessageDiv.innerHTML = '<span class="placeholder-message">🌸 New conversation started! Ask me anything 🌸</span>';
        showToast('New session created successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating session:', error);
        showToast('Failed to create new session', 'error');
    }
}

// Export current session
async function exportCurrentSession(format) {
    if (!currentSessionId) {
        showToast('No active session to export', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/export/${currentSessionId}/${format}`);
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${currentSessionId}.${format === 'json' ? 'json' : 'txt'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast(`Session exported as ${format.toUpperCase()}!`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export session', 'error');
    }
}

// Load sessions list
async function loadSessionsList() {
    sessionsList.innerHTML = '<div class="loading-message">📂 Loading sessions...</div>';
    
    try {
        const response = await fetch('/sessions');
        
        if (!response.ok) {
            throw new Error('Failed to load sessions');
        }
        
        const data = await response.json();
        
        if (!data.sessions || data.sessions.length === 0) {
            sessionsList.innerHTML = '<div class="empty-message">✨ No sessions found. Start a new chat to create one!</div>';
            return;
        }
        
        sessionsList.innerHTML = '';
        
        for (const session of data.sessions) {
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-item';
            
            const createdDate = new Date(session.created_at);
            const updatedDate = new Date(session.last_updated);
            
            sessionDiv.innerHTML = `
                <div class="session-header">
                    <span class="session-id">${escapeHtml(session.session_id)}</span>
                    <span class="session-date">Created: ${createdDate.toLocaleString()}</span>
                </div>
                <div class="session-stats">
                    <span>💬 ${session.total_interactions} messages</span>
                    <span>🕐 Updated: ${updatedDate.toLocaleString()}</span>
                </div>
                <div class="session-actions">
                    <button class="session-btn load" data-session-id="${session.session_id}">📂 Load</button>
                    <button class="session-btn export-text" data-session-id="${session.session_id}">📄 Export Text</button>
                    <button class="session-btn export-json" data-session-id="${session.session_id}">📊 Export JSON</button>
                    <button class="session-btn delete" data-session-id="${session.session_id}">🗑️ Delete</button>
                </div>
            `;
            
            sessionsList.appendChild(sessionDiv);
        }
        
        // Add event listeners to buttons
        document.querySelectorAll('.session-btn.load').forEach(btn => {
            btn.addEventListener('click', () => loadSession(btn.dataset.sessionId));
        });
        
        document.querySelectorAll('.session-btn.export-text').forEach(btn => {
            btn.addEventListener('click', () => exportSpecificSession(btn.dataset.sessionId, 'text'));
        });
        
        document.querySelectorAll('.session-btn.export-json').forEach(btn => {
            btn.addEventListener('click', () => exportSpecificSession(btn.dataset.sessionId, 'json'));
        });
        
        document.querySelectorAll('.session-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteSession(btn.dataset.sessionId));
        });
        
    } catch (error) {
        console.error('Error loading sessions:', error);
        sessionsList.innerHTML = '<div class="empty-message">❌ Failed to load sessions. Please try again.</div>';
    }
}

// Load a specific session
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/session/${sessionId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load session');
        }
        
        const session = await response.json();
        
        currentSessionId = session.session_id;
        updateSessionInfo(session.session_id, session.total_interactions);
        
        if (session.history && session.history.length > 0) {
            const lastInteraction = session.history[session.history.length - 1];
            aiMessageDiv.innerHTML = `<span class="ai-response">${escapeHtml(lastInteraction.reply)}</span>`;
            userInput.value = lastInteraction.trigger;
        } else {
            aiMessageDiv.innerHTML = '<span class="placeholder-message">🌸 Session loaded! Ask me anything 🌸</span>';
        }
        
        showToast(`Session loaded successfully!`, 'success');
        closeHistoryModal();
        
    } catch (error) {
        console.error('Error loading session:', error);
        showToast('Failed to load session', 'error');
    }
}

// Export a specific session
async function exportSpecificSession(sessionId, format) {
    try {
        const response = await fetch(`/export/${sessionId}/${format}`);
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${sessionId}.${format === 'json' ? 'json' : 'txt'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast(`Session exported as ${format.toUpperCase()}!`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export session', 'error');
    }
}

// Delete a session
async function deleteSession(sessionId) {
    if (!confirm(`Are you sure you want to delete this session? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/session/${sessionId}/delete`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete session');
        }
        
        showToast('Session deleted successfully!', 'success');
        
        await loadSessionsList();
        
        if (currentSessionId === sessionId) {
            await createNewSession();
        }
        
    } catch (error) {
        console.error('Error deleting session:', error);
        showToast('Failed to delete session', 'error');
    }
}

// Open history modal
function openHistoryModal() {
    historyModal.style.display = 'block';
    loadSessionsList();
}

// Close history modal
function closeHistoryModal() {
    historyModal.style.display = 'none';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-resize textarea
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

// Check server status
async function checkServerStatus() {
    try {
        const response = await fetch('/sessions');
        if (response.ok) {
            serverStatus.innerHTML = '✅ Server: Connected';
            serverStatus.style.color = '#28a745';
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        serverStatus.innerHTML = '❌ Server: Disconnected';
        serverStatus.style.color = '#dc3545';
    }
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
newSessionBtn.addEventListener('click', createNewSession);
exportTextBtn.addEventListener('click', () => exportCurrentSession('text'));
exportJsonBtn.addEventListener('click', () => exportCurrentSession('json'));
viewHistoryBtn.addEventListener('click', openHistoryModal);
closeModal.addEventListener('click', closeHistoryModal);
closeHistoryBtn.addEventListener('click', closeHistoryModal);

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === historyModal) {
        closeHistoryModal();
    }
});

// Handle Enter key
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
userInput.addEventListener('input', autoResizeTextarea);

// Initial setup
autoResizeTextarea();
checkServerStatus();
setInterval(checkServerStatus, 30000);

// Initialize a new session on page load
createNewSession();
