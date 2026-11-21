import { useRef, useState, useEffect, useCallback } from 'react';
import { useChat } from './hooks/useChat.js';
import { MessageList } from './components/MessageList.jsx';

const SUGGESTIONS = [
  'What is the capital of France?',
  'Explain quantum computing in one sentence',
  'Write a short motivational haiku',
];

export default function App() {
  const { messages, isLoading, sendMessage, sessionId } = useChat();
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  const handleSend = useCallback((overrideText) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if (!textToSend.trim() || isLoading) return;
    sendMessage(textToSend, systemPrompt);
    setInput('');
  }, [input, systemPrompt, isLoading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetSession = () => {
    window.location.reload();
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">⚡</div>
          <div>
            <div className="header-title-row">
              <h1>Lyftr AI Chatbot</h1>
              <span className="online-pill">
                <span className="dot" /> Online
              </span>
            </div>
            <div className="header-sub">
              Session: <code>{sessionId}</code>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={`tool-btn ${showSystemPrompt ? 'active' : ''}`}
            onClick={() => setShowSystemPrompt((v) => !v)}
            title="Configure System Prompt"
          >
            ⚙️ System Prompt {showSystemPrompt ? '▲' : '▼'}
          </button>
          <button
            type="button"
            className="tool-btn reset-btn"
            onClick={handleResetSession}
            title="Start a new session"
          >
            🔄 New Session
          </button>
        </div>
      </header>

      {/* ── System Prompt (Collapsible) ────────────────────────── */}
      <div className={`system-prompt-bar ${showSystemPrompt ? 'open' : ''}`}>
        <label>System Prompt (Optional)</label>
        <input
          data-testid="system-prompt-input"
          type="text"
          placeholder="e.g. You are a concise, helpful engineering assistant..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="messages">
        {messages.length === 0 && !isLoading ? (
          <div className="welcome">
            <div className="welcome-icon">💬</div>
            <h2>What can I help you with today?</h2>
            <p>Responses are cached for speed and sessions remember full conversational context.</p>

            <div className="suggestions">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => handleSend(s)}
                >
                  "{s}" ➔
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isLoading={isLoading} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ──────────────────────────────────────────── */}
      <div className="input-bar">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          className="chat-textarea"
          rows={1}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          data-testid="send-button"
          className="send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
