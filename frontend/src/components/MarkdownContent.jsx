import { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function MarkdownContent({ content }) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      // Clean up stray redundant TL;DR prefixes if present at the very beginning of the response
      let cleaned = content;
      cleaned = cleaned.replace(/^(\*{0,2})TL;?DR:?(\*{0,2})\s*/i, '');

      return marked.parse(cleaned);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
