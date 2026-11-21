import { useRef, useState, useEffect, useCallback } from 'react';
import { useChat } from './hooks/useChat.js';
import { MessageList } from './components/MessageList.jsx';

export default function App() {
  const { messages, isLoading, sendMessage, sessionId } = useChat();
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
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

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input, systemPrompt);
    setInput('');
  }, [input, systemPrompt, isLoading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-logo">L</div>
        <div>
          <h1>Lyftr AI Chatbot</h1>
          <div className="header-sub">Session: {sessionId}</div>
        </div>
      </header>

      {/* ── System Prompt ──────────────────────────────────────── */}
      <div className="system-prompt-bar">
        <label>System Prompt (optional)</label>
        <input
          data-testid="system-prompt-input"
          type="text"
          placeholder="e.g. You are a helpful travel guide..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="messages">
        {messages.length === 0 && !isLoading ? (
          <div className="welcome">
            <div className="welcome-icon">💬</div>
            <h2>Start a conversation</h2>
            <p>Ask anything — I remember the whole conversation.</p>
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
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          data-testid="send-button"
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
