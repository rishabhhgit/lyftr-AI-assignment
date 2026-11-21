import { useState } from 'react';
import { MetaBadges } from './MetaBadges.jsx';
import { MarkdownContent } from './MarkdownContent.jsx';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="action-btn copy-btn"
      title="Copy to clipboard"
      aria-label="Copy message"
    >
      <span className="action-icon">{copied ? '✓' : '⧉'}</span>
      <span className="action-text">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

export function MessageList({ messages, isLoading }) {
  return (
    <div className="message-stream">
      {messages.map((msg, i) => (
        <div key={i} className={`msg-row-container ${msg.role}`}>
          {msg.role === 'assistant' ? (
            /* ── Assistant message: container with exact testid ── */
            <div data-testid="assistant-message" className="assistant-message-row">
              <div className="assistant-avatar" title="Lyftr AI">
                <span>🤖</span>
              </div>
              <div className="assistant-content-col">
                <div className={`message-text ${msg.isError ? 'error-text' : ''}`}>
                  {msg.isError ? (
                    msg.content
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}
                </div>
                {!msg.isError && (
                  <div className="assistant-footer-bar">
                    <MetaBadges metadata={msg.metadata} />
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── User message: ChatGPT rounded bubble ──────────── */
            <div className="user-message-row">
              <div className="user-bubble">
                <div className="message-text">{msg.content}</div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="assistant-message-row loading-row">
          <div className="assistant-avatar" title="Lyftr AI">
            <span>🤖</span>
          </div>
          <div className="assistant-content-col">
            <div className="chatgpt-typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
