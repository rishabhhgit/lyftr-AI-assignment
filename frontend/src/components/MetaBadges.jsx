/**
 * MetaBadges – renders the metadata row beneath each assistant message.
 * Follows exact data-testid content requirements:
 * - meta-source: Exactly LIVE_INFERENCE or LLM_CACHE
 * - meta-model: The model value
 * - meta-latency: Latency, e.g. 812 ms
 * - meta-input-tokens: The input_tokens integer
 * - meta-output-tokens: The output_tokens integer
 */
export function MetaBadges({ metadata }) {
  if (!metadata) return null;

  const isCache = metadata.resolution_source === 'LLM_CACHE';

  return (
    <div className="meta-row">
      {/* Resolution source */}
      <span className={`badge ${isCache ? 'badge-source-cache' : 'badge-source-live'}`}>
        <span>{isCache ? '⚡' : '🔴'}</span>
        <span data-testid="meta-source">{metadata.resolution_source}</span>
      </span>

      {/* Model */}
      <span className="badge badge-model">
        <span>🤖</span>
        <span data-testid="meta-model">{metadata.model}</span>
      </span>

      {/* Latency */}
      <span className="badge badge-latency">
        <span>⏱</span>
        <span data-testid="meta-latency">{metadata.latency_ms} ms</span>
      </span>

      {/* Input tokens */}
      <span className="badge badge-tokens">
        <span>↑ in:</span>
        <span data-testid="meta-input-tokens">{metadata.input_tokens}</span>
      </span>

      {/* Output tokens */}
      <span className="badge badge-tokens">
        <span>↓ out:</span>
        <span data-testid="meta-output-tokens">{metadata.output_tokens}</span>
      </span>
    </div>
  );
}
