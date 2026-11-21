import { useState } from 'react';
import { MetaBadges } from './MetaBadges.jsx';

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
      className="copy-btn"
      title="Copy to clipboard"
      aria-label="Copy message"
    >
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}

export function MessageList({ messages, isLoading }) {
  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={`msg-row ${msg.role}`}>
          <div className={`avatar ${msg.role === 'user' ? 'user' : 'bot'}`}>
            {msg.role === 'user' ? '👤' : '🤖'}
          </div>

          {msg.role === 'assistant' ? (
            /* ── Assistant bubble with required data-testid ───────── */
            <div
              data-testid="assistant-message"
              className={`msg-bubble bot ${msg.isError ? 'error' : ''}`}
            >
              <div className="msg-content">{msg.content}</div>
              {!msg.isError && (
                <div className="bot-footer">
                  <MetaBadges metadata={msg.metadata} />
                  <CopyButton text={msg.content} />
                </div>
              )}
            </div>
          ) : (
            /* ── User bubble ──────────────────────────────────────── */
            <div className="msg-bubble user">
              <div className="msg-content">{msg.content}</div>
            </div>
          )}
        </div>
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="msg-row bot">
          <div className="avatar bot">🤖</div>
          <div className="msg-bubble bot">
            <div className="typing">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
