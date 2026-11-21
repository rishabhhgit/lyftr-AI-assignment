import { MetaBadges } from './MetaBadges.jsx';

export function MessageList({ messages, isLoading }) {
  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={`msg-row ${msg.role}`}>
          <div className={`avatar ${msg.role === 'user' ? 'user' : 'bot'}`}>
            {msg.role === 'user' ? 'U' : 'AI'}
          </div>

          {msg.role === 'assistant' ? (
            /* ── Assistant bubble with required data-testid ───────── */
            <div
              data-testid="assistant-message"
              className={`msg-bubble bot ${msg.isError ? 'error' : ''}`}
            >
              <div>{msg.content}</div>
              {!msg.isError && <MetaBadges metadata={msg.metadata} />}
            </div>
          ) : (
            /* ── User bubble ──────────────────────────────────────── */
            <div className="msg-bubble user">{msg.content}</div>
          )}
        </div>
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="msg-row">
          <div className="avatar bot">AI</div>
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
