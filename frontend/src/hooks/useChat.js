/**
 * useChat – manages session state, API calls, and message history.
 * A new sessionId is generated on every page load (fresh session).
 */
import { useState, useCallback } from 'react';

const rawApiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = rawApiBase.replace(/\/+$/, '');

function generateSessionId() {
  return 's-' + Math.random().toString(36).slice(2, 10);
}

export function useChat() {
  const [sessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState([]);   // {role, content, metadata?, isError?}
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text, systemPrompt) => {
      if (!text.trim() || isLoading) return;

      // Optimistically add user message
      const userMsg = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const body = { session_id: sessionId, message: text.trim() };
        if (systemPrompt?.trim()) body.system_prompt = systemPrompt.trim();

        const res = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.detail || `Server error: ${res.status}`
          );
        }

        const data = await res.json();
        const assistantMsg = {
          role: 'assistant',
          content: data.reply,
          metadata: data.metadata,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg = {
          role: 'assistant',
          content: `⚠️ ${err.message || 'Something went wrong. Please try again.'}`,
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading]
  );

  return { messages, isLoading, sendMessage, sessionId };
}
