/* script.js — IvieAI with conversation history and uniform colors */

// ── State ──────────────────────────────────────────
let currentSessionId = null;
let isStreaming = false;
let currentStreamingMessageDiv = null;
let conversationHistory = [];

// ── DOM refs ───────────────────────────────────────
const conversationContainer = document.getElementById('conversationContainer');
const conversationHistoryDiv = document.getElementById('conversationHistory');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sessionIdEl = document.getElementById('sessionId');
const interactionCountEl = document.getElementById('interactionCount');
const serverStatusEl = document.getElementById('serverStatus');
const historyModal = document.getElementById('historyModal');
const sessionsList = document.getElementById('sessionsList');
const toast = document.getElementById('toast');

// ── Utility: auto-grow textarea ───────────────────
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

// ── Utility: Enter to send ────────────────────────
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// ── Toast helper ──────────────────────────────────
function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className = 'toast' + (type ? ' ' + type : '');
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Add message to conversation UI ─────────────────
function addMessageToUI(role, content, isStreaming = false) {
    if (role === 'ai' && isStreaming) {
        // Create a new message bubble for streaming AI response
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-bubble ai';
        messageDiv.innerHTML = `
            <div class="message-content">
                <span class="message-sender">🤖 IvieAI</span>
                <div class="message-text" id="streamingMessage"></div>
            </div>
        `;
        conversationHistoryDiv.appendChild(messageDiv);
        currentStreamingMessageDiv = messageDiv.querySelector('.message-text');
        
        // Scroll to bottom
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
        return currentStreamingMessageDiv;
    } else if (role === 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-bubble user';
        messageDiv.innerHTML = `
            <div class="message-content">
                <span class="message-sender">👤 You</span>
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
        `;
        conversationHistoryDiv.appendChild(messageDiv);
        
        // Scroll to bottom
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
    } else if (role === 'ai' && !isStreaming) {
        // Replace streaming message with final version or add new one
        if (currentStreamingMessageDiv) {
            currentStreamingMessageDiv.innerHTML = formatAIMessage(content);
            currentStreamingMessageDiv = null;
        } else {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-bubble ai';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <span class="message-sender">🤖 IvieAI</span>
                    <div class="message-text">${formatAIMessage(content)}</div>
                </div>
            `;
            conversationHistoryDiv.appendChild(messageDiv);
        }
        
        // Scroll to bottom
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
    }
    
    // Remove empty state if needed
    const emptyDiv = conversationHistoryDiv.querySelector('.empty-conversation');
    if (emptyDiv) {
        emptyDiv.remove();
    }
}

// Format AI message (simple paragraph formatting)
function formatAIMessage(text) {
    // Split into sentences and join with spaces (no special coloring)
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.map(sentence => sentence.trim()).join(' ');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Show/hide typing indicator ────────────────────
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message-bubble ai';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-content">
            <span class="message-sender">🤖 IvieAI</span>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    conversationHistoryDiv.appendChild(indicator);
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ── Load full conversation history from server ────
async function loadConversationHistory(sessionId) {
    try {
        const response = await fetch(`/session/${sessionId}`);
        const data = await response.json();
        
        if (data.history && data.history.length > 0) {
            // Clear current conversation
            conversationHistoryDiv.innerHTML = '';
            currentStreamingMessageDiv = null;
            
            // Add all historical messages
            data.history.forEach(interaction => {
                // Add user message
                addMessageToUI('user', interaction.trigger);
                // Add AI response
                addMessageToUI('ai', interaction.reply);
            });
            
            // Update counts
            interactionCountEl.textContent = data.total_interactions;
        } else {
            // Empty conversation
            conversationHistoryDiv.innerHTML = '<div class="empty-conversation">🌸 No messages yet. Start a conversation above! 🌸</div>';
            interactionCountEl.textContent = '0';
        }
    } catch (error) {
        console.error('Failed to load conversation:', error);
    }
}

// ── Core: send via SSE /chat/stream ──────────────
function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isStreaming) return;

    // Add user message to UI immediately
    addMessageToUI('user', text);
    
    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';
    setStreaming(true);
    
    // Show typing indicator
    showTypingIndicator();
    
    // Prepare streaming
    const params = new URLSearchParams({ message: text });
    if (currentSessionId) params.append('session_id', currentSessionId);
    
    let sentenceIndex = 0;
    let accumulatedResponse = '';
    let streamingDiv = null;
    
    const evtSrc = new EventSource(`/chat/stream?${params.toString()}`);
    
    evtSrc.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        
        switch (data.type) {
            case 'thinking':
                // Session confirmed — update UI badge
                if (data.session_id !== currentSessionId) {
                    currentSessionId = data.session_id;
                    sessionIdEl.textContent = data.session_id.slice(-10);
                    // Load existing conversation for this session
                    loadConversationHistory(currentSessionId);
                }
                break;
                
            case 'sentence':
                // Remove typing indicator on first sentence
                if (sentenceIndex === 0) {
                    hideTypingIndicator();
                    // Create streaming message container
                    streamingDiv = addMessageToUI('ai', '', true);
                }
                // Append sentence to accumulated response
                if (streamingDiv) {
                    accumulatedResponse += (accumulatedResponse ? ' ' : '') + data.text;
                    // Update with accumulated text
                    streamingDiv.innerHTML = formatAIMessage(accumulatedResponse);
                }
                sentenceIndex++;
                conversationContainer.scrollTop = conversationContainer.scrollHeight;
                break;
                
            case 'done':
                // Finalize the AI message
                if (streamingDiv && accumulatedResponse) {
                    streamingDiv.innerHTML = formatAIMessage(accumulatedResponse);
                }
                streamingDiv = null;
                accumulatedResponse = '';
                interactionCountEl.textContent = data.interaction_count;
                setStreaming(false);
                evtSrc.close();
                break;
                
            case 'error':
                hideTypingIndicator();
                addMessageToUI('ai', `⚠️ Error: ${escapeHtml(data.message || 'Something went wrong.')}`);
                setStreaming(false);
                evtSrc.close();
                showToast('Error from server', 'error');
                break;
        }
    };
    
    evtSrc.onerror = () => {
        hideTypingIndicator();
        if (sentenceIndex === 0) {
            addMessageToUI('ai', '⚠️ Connection error. Please try again.');
        }
        setStreaming(false);
        evtSrc.close();
        serverStatusEl.textContent = '● Server: Disconnected';
        serverStatusEl.className = 'server-status error';
    };
}

function setStreaming(active) {
    isStreaming = active;
    sendBtn.disabled = active;
    userInput.disabled = active;
    if (!active) userInput.focus();
}

// ── New session ───────────────────────────────────
document.getElementById('newSessionBtn').addEventListener('click', async () => {
    if (isStreaming) return;
    try {
        const res = await fetch('/session/new', { method: 'POST' });
        const data = await res.json();
        currentSessionId = data.session_id;
        sessionIdEl.textContent = data.session_id.slice(-10);
        interactionCountEl.textContent = '0';
        // Clear conversation UI
        conversationHistoryDiv.innerHTML = '<div class="empty-conversation">🌸 New session started! Ask me anything. 🌸</div>';
        currentStreamingMessageDiv = null;
        showToast('New session started!', 'success');
    } catch {
        showToast('Could not create new session', 'error');
    }
});

// ── Export helpers ────────────────────────────────
document.getElementById('exportTextBtn').addEventListener('click', () => exportSession('text'));
document.getElementById('exportJsonBtn').addEventListener('click', () => exportSession('json'));

function exportSession(format) {
    if (!currentSessionId) {
        showToast('No active session to export', 'error');
        return;
    }
    const link = document.createElement('a');
    link.href = `/export/${currentSessionId}/${format}`;
    link.click();
    showToast(`Exporting as ${format.toUpperCase()}…`, 'success');
}

// ── History modal ─────────────────────────────────
document.getElementById('viewHistoryBtn').addEventListener('click', openHistory);
document.getElementById('closeHistoryBtn').addEventListener('click', closeHistory);
document.querySelector('.close-modal').addEventListener('click', closeHistory);

historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistory();
});

function openHistory() {
    historyModal.classList.add('open');
    loadSessions();
}

function closeHistory() {
    historyModal.classList.remove('open');
}

async function loadSessions() {
    sessionsList.innerHTML = '<div class="loading-message">Loading sessions…</div>';
    try {
        const res = await fetch('/sessions');
        const data = await res.json();
        
        if (!data.sessions || data.sessions.length === 0) {
            sessionsList.innerHTML = '<div class="loading-message">No sessions found.</div>';
            return;
        }
        
        sessionsList.innerHTML = '';
        data.sessions.forEach(s => {
            const item = document.createElement('div');
            item.className = 'session-item';
            item.innerHTML = `
                <div class="session-item-info">
                    <strong>${escapeHtml(s.session_id)}</strong>
                    ${s.total_interactions} message${s.total_interactions !== 1 ? 's' : ''} ·
                    ${new Date(s.last_updated).toLocaleString()}
                </div>
                <div class="session-item-actions">
                    <button class="btn-sm btn-view" data-id="${escapeHtml(s.session_id)}">Load</button>
                    <button class="btn-sm btn-delete" data-id="${escapeHtml(s.session_id)}">Delete</button>
                </div>
            `;
            sessionsList.appendChild(item);
        });
        
        // Bind buttons
        sessionsList.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => loadSession(btn.dataset.id));
        });
        sessionsList.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteSession(btn.dataset.id));
        });
        
    } catch {
        sessionsList.innerHTML = '<div class="loading-message">Failed to load sessions.</div>';
    }
}

async function loadSession(sessionId) {
    try {
        const res = await fetch(`/session/${sessionId}`);
        const data = await res.json();
        
        currentSessionId = data.session_id;
        sessionIdEl.textContent = data.session_id.slice(-10);
        interactionCountEl.textContent = data.total_interactions;
        
        // Load the conversation history
        await loadConversationHistory(sessionId);
        
        closeHistory();
        showToast('Session loaded!', 'success');
    } catch {
        showToast('Could not load session', 'error');
    }
}

async function deleteSession(sessionId) {
    if (!confirm('Delete this session?')) return;
    try {
        await fetch(`/session/${sessionId}/delete`, { method: 'DELETE' });
        showToast('Session deleted', 'success');
        loadSessions();
        if (currentSessionId === sessionId) {
            currentSessionId = null;
            sessionIdEl.textContent = 'None';
            interactionCountEl.textContent = '0';
            conversationHistoryDiv.innerHTML = '<div class="empty-conversation">🌸 Session deleted. Start a new chat! 🌸</div>';
        }
    } catch {
        showToast('Could not delete session', 'error');
    }
}

// ── Init: fetch current session on load ──────────
(async function init() {
    try {
        const res = await fetch('/session/current');
        if (res.ok) {
            const data = await res.json();
            currentSessionId = data.session_id;
            sessionIdEl.textContent = data.session_id.slice(-10);
            interactionCountEl.textContent = data.total_interactions;
            // Load the conversation history for current session
            await loadConversationHistory(currentSessionId);
        } else {
            sessionIdEl.textContent = 'New';
            conversationHistoryDiv.innerHTML = '<div class="empty-conversation">🌸 Hi there! Ask me anything — I\'m here to chat! 🌸</div>';
        }
        serverStatusEl.textContent = '● Server: Connected';
        serverStatusEl.className = 'server-status';
    } catch {
        serverStatusEl.textContent = '● Server: Disconnected';
        serverStatusEl.className = 'server-status error';
        sessionIdEl.textContent = 'N/A';
    }
})();
