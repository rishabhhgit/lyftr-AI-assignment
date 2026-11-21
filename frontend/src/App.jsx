import { useRef, useState, useEffect, useCallback } from 'react';
import { useChat } from './hooks/useChat.js';
import { MessageList } from './components/MessageList.jsx';
import { BrandLogo } from './components/BrandLogo.jsx';

const SUGGESTIONS = [
  { title: 'What is the capital of France?', subtitle: 'Geography & facts' },
  { title: 'Explain quantum computing in one sentence', subtitle: 'Science & concepts' },
  { title: 'Write a short motivational haiku', subtitle: 'Creative writing' },
  { title: 'How does response caching work?', subtitle: 'System architecture' },
];

const SYSTEM_PRESETS = [
  { label: 'Concise', text: 'You are a concise, helpful assistant. Answer questions directly without filler.' },
  { label: 'Engineer', text: 'You are a senior full-stack engineer. Provide clean, production-grade solutions.' },
  { label: 'ELI5', text: 'Explain concepts in simple terms that a 5-year-old could understand.' },
  { label: 'Creative', text: 'You are an imaginative and vivid writer. Respond with creative flair.' },
];

export default function App() {
  const {
    messages,
    isLoading,
    sendMessage,
    sessionId,
    sessions,
    startNewSession,
    selectSession,
    deleteSession,
    clearAllSessions,
  } = useChat();

  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);

  // Theme: default to stored preference or system preference
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

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea like ChatGPT
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, [input]);

  const handleSend = useCallback(
    (overrideText) => {
      const textToSend = typeof overrideText === 'string' ? overrideText : input;
      if (!textToSend.trim() || isLoading) return;
      sendMessage(textToSend, systemPrompt);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    [input, systemPrompt, isLoading, sendMessage]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 2000);
  };

  return (
    <div className={`chatgpt-layout ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      {/* ── Left Sidebar (ChatGPT Style) ───────────────────────── */}
      <aside className="chatgpt-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <div className="sidebar-brand">
              <BrandLogo size={24} />
              <span className="brand-text">Lyftr AI</span>
            </div>
            <button
              type="button"
              className="icon-btn sidebar-toggle-btn"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              ◧
            </button>
          </div>

          <button
            type="button"
            className="new-chat-btn"
            onClick={startNewSession}
            title="Start a new chat"
          >
            <span className="plus-icon">+</span>
            <span className="new-chat-text">New chat</span>
          </button>
        </div>

        {/* Sessions History List */}
        <div className="sidebar-history">
          <div className="history-header">
            <span className="history-label">Recent chats</span>
            {sessions.length > 0 && (
              <button
                type="button"
                className="clear-all-link"
                onClick={clearAllSessions}
                title="Clear all saved chats"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="history-list">
            {/* Current Active Session */}
            <div className="history-item-row active">
              <button
                type="button"
                className="history-select-btn"
                onClick={handleCopySession}
                title={`Current Session: ${sessionId} (Click to copy ID)`}
              >
                <span className="chat-bubble-icon">💬</span>
                <span className="history-title">Current ({sessionId.slice(0, 8)})</span>
                <span className="copy-badge">{copiedSession ? '✓' : '📋'}</span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="history-delete-btn"
                  onClick={(e) => deleteSession(sessionId, e)}
                  title="Clear this conversation"
                  aria-label="Delete chat"
                >
                  🗑
                </button>
              )}
            </div>

            {/* Other Saved Sessions */}
            {sessions
              .filter((s) => s.id !== sessionId)
              .map((s) => (
                <div key={s.id} className="history-item-row">
                  <button
                    type="button"
                    className="history-select-btn"
                    onClick={() => selectSession(s.id)}
                    title={s.title || s.id}
                  >
                    <span className="chat-bubble-icon">💬</span>
                    <span className="history-title">{s.title || s.id}</span>
                  </button>
                  <button
                    type="button"
                    className="history-delete-btn"
                    onClick={(e) => deleteSession(s.id, e)}
                    title="Delete this chat"
                    aria-label="Delete chat"
                  >
                    🗑
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-action-btn"
            onClick={() => setShowSystemPrompt((v) => !v)}
            title="Configure Custom Instructions"
          >
            <span>⚙️ Custom instructions</span>
            {systemPrompt.trim() && <span className="active-dot" />}
          </button>

          <button
            type="button"
            className="sidebar-action-btn"
            onClick={toggleTheme}
            title="Toggle Light / Dark theme"
          >
            <span>{theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}</span>
          </button>

          <div className="sidebar-model-badge">
            <span className="model-indicator-dot" />
            <span>gemini-3.5-flash-lite</span>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ─────────────────────────────────────── */}
      <div className="chatgpt-main">
        {/* Top Minimal Navigation Bar */}
        <header className="chatgpt-topbar">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button
                type="button"
                className="icon-btn sidebar-open-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                ☰
              </button>
            )}

            {/* Model Selector Pill */}
            <div className="model-selector-wrapper">
              <button
                type="button"
                className="model-selector-btn"
                onClick={() => setShowModelDropdown((v) => !v)}
                title="AI Model Details"
              >
                <span className="model-name">Lyftr GPT</span>
                <span className="model-version">3.5 Flash Lite</span>
                <span className="chevron">▾</span>
              </button>

              {showModelDropdown && (
                <div className="model-dropdown-menu">
                  <div className="dropdown-header">Model Configuration</div>
                  <div className="dropdown-item active">
                    <div className="item-title">⚡ Primary: Gemini 3.5 Flash Lite</div>
                    <div className="item-desc">High-speed inference with sub-second latency</div>
                  </div>
                  <div className="dropdown-item">
                    <div className="item-title">🔄 Backup: Gemini 3.6 Flash</div>
                    <div className="item-desc">Automatic key failover across pool</div>
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-footer">
                    Cache: <strong>Active (LiteLLM)</strong> · Persistence: <strong>SQLite</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {messages.length > 0 && (
              <button
                type="button"
                className="topbar-btn delete-chat-top-btn"
                onClick={(e) => deleteSession(sessionId, e)}
                title="Clear current conversation"
              >
                🗑 Clear
              </button>
            )}

            <button
              type="button"
              className={`topbar-btn ${showSystemPrompt ? 'active' : ''}`}
              onClick={() => setShowSystemPrompt((v) => !v)}
              title="Custom Instructions (System Prompt)"
            >
              ⚙️ System {systemPrompt.trim() ? '●' : ''}
            </button>

            <button
              type="button"
              className="topbar-btn theme-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button
              type="button"
              className="topbar-btn new-chat-top-btn"
              onClick={startNewSession}
              title="Start a new chat"
            >
              <span className="plus-icon">+</span>
              <span className="btn-label">New chat</span>
            </button>
          </div>
        </header>

        {/* Collapsible System Prompt Drawer */}
        <div className={`system-drawer ${showSystemPrompt ? 'open' : ''}`}>
          <div className="system-drawer-inner">
            <div className="drawer-header-row">
              <label htmlFor="system-prompt-input">Custom System Instructions</label>
              <div className="preset-buttons">
                <span className="presets-label">Presets:</span>
                {SYSTEM_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-btn"
                    onClick={() => setSystemPrompt(p.text)}
                  >
                    {p.label}
                  </button>
                ))}
                {systemPrompt && (
                  <button
                    type="button"
                    className="preset-btn clear-btn"
                    onClick={() => setSystemPrompt('')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              id="system-prompt-input"
              data-testid="system-prompt-input"
              type="text"
              placeholder="How would you like Lyftr AI to respond? (e.g. Concise, Technical, Friendly...)"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
        </div>

        {/* Chat Stream (Centered, ChatGPT width max-w-3xl) */}
        <div className="chat-stream-viewport" onClick={() => setShowModelDropdown(false)}>
          <div className="chat-stream-inner">
            {messages.length === 0 && !isLoading ? (
              /* ── ChatGPT Centered Welcome Hero ── */
              <div className="chatgpt-hero">
                <div className="hero-icon">
                  <BrandLogo size={46} />
                </div>
                <h1 className="hero-heading">What can I help with?</h1>

                <div className="hero-suggestions-grid">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="hero-suggestion-card"
                      onClick={() => handleSend(s.title)}
                    >
                      <span className="card-title">{s.title}</span>
                      <span className="card-subtitle">{s.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MessageList messages={messages} isLoading={isLoading} />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Signature ChatGPT Bottom Input Capsule ─────────────── */}
        <div className="chatgpt-input-dock">
          <div className="chatgpt-input-wrapper">
            <div className="chatgpt-input-capsule">
              <textarea
                ref={textareaRef}
                data-testid="chat-input"
                className="chatgpt-textarea"
                rows={1}
                placeholder="Message Lyftr AI..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />

              <button
                data-testid="send-button"
                className={`chatgpt-send-btn ${input.trim() && !isLoading ? 'active' : ''}`}
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                title="Send message"
              >
                {isLoading ? (
                  <span className="chatgpt-btn-spinner" />
                ) : (
                  <span className="chatgpt-arrow-icon">↑</span>
                )}
              </button>
            </div>

            <div className="chatgpt-disclaimer">
              <span>
                Lyftr AI can make mistakes. Verify important info · Key Failover & Cache Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
