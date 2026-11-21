import { useRef, useState, useEffect, useCallback } from 'react';
import { useChat } from './hooks/useChat.js';
import { MessageList } from './components/MessageList.jsx';

const SUGGESTIONS = [
  'What is the capital of France?',
  'Explain quantum computing in one sentence',
  'Write a short motivational haiku',
];

const SYSTEM_PRESETS = [
  { label: 'Concise', text: 'You are a concise, helpful assistant. Answer questions directly without filler.' },
  { label: 'Engineer', text: 'You are a senior full-stack engineer. Provide clean, production-grade solutions.' },
  { label: 'ELI5', text: 'Explain concepts in simple terms that a 5-year-old could understand.' },
  { label: 'Creative', text: 'You are an imaginative and vivid writer. Respond with creative flair.' },
];

export default function App() {
  const { messages, isLoading, sendMessage, sessionId } = useChat();
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);

  // Theme state: default to saved or system preference
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('lyftr_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('lyftr_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 2000);
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo" title="Lyftr AI Engine">⚡</div>
          <div>
            <div className="header-title-row">
              <h1>Lyftr AI Chatbot</h1>
              <span className="online-pill">
                <span className="dot" /> Online
              </span>
            </div>
            <div className="header-sub">
              <span>Session: </span>
              <button
                type="button"
                className="session-id-pill"
                onClick={handleCopySession}
                title="Click to copy Session ID"
              >
                <code>{sessionId}</code>
                <span className="copy-icon">{copiedSession ? '✓' : '📋'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Theme toggle */}
          <button
            type="button"
            className="tool-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>

          {/* System prompt toggle */}
          <button
            type="button"
            className={`tool-btn ${showSystemPrompt ? 'active' : ''} ${systemPrompt.trim() ? 'has-value' : ''}`}
            onClick={() => setShowSystemPrompt((v) => !v)}
            title="Configure System Prompt"
          >
            ⚙️ System {systemPrompt.trim() ? '●' : ''} {showSystemPrompt ? '▲' : '▼'}
          </button>

          {/* New session reset */}
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
        <div className="system-prompt-inner">
          <div className="system-prompt-header">
            <label htmlFor="system-prompt-input">System Prompt (Optional)</label>
            <div className="system-preset-chips">
              <span className="preset-label">Presets:</span>
              {SYSTEM_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="preset-chip"
                  onClick={() => setSystemPrompt(p.text)}
                  title={p.text}
                >
                  {p.label}
                </button>
              ))}
              {systemPrompt && (
                <button
                  type="button"
                  className="preset-chip clear"
                  onClick={() => setSystemPrompt('')}
                  title="Clear system prompt"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
          <input
            id="system-prompt-input"
            data-testid="system-prompt-input"
            type="text"
            placeholder="e.g. You are a concise, helpful engineering assistant..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="messages">
        {messages.length === 0 && !isLoading ? (
          <div className="welcome">
            <div className="welcome-icon">💬</div>
            <h2>What can I help you with today?</h2>
            <p>
              Intelligent conversational assistant powered by Gemini 3.5 Flash Lite with automatic failover, response caching, and persistent multi-turn SQLite memory.
            </p>

            <div className="welcome-features">
              <span className="feat-tag">⚡ Sub-ms Response Caching</span>
              <span className="feat-tag">🔄 Automatic Key Failover</span>
              <span className="feat-tag">🧠 Multi-turn Memory</span>
            </div>

            <div className="suggestions">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => handleSend(s)}
                >
                  <span>"{s}"</span>
                  <span className="arrow">➔</span>
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
      <div className="input-bar-container">
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
            title="Send message"
          >
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              '➤'
            )}
          </button>
        </div>
        <div className="input-hint">
          <span>Press <strong>Enter ↵</strong> to send · <strong>Shift + Enter</strong> for new line</span>
        </div>
      </div>
    </div>
  );
}
