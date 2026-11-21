/**
 * useChat – manages session state, API calls, and message history.
 * Supports multiple sessions and persistent recent session history.
 */
import { useState, useCallback, useEffect } from 'react';

const rawApiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = rawApiBase.replace(/\/+$/, '');

function generateSessionId() {
  return 's-' + Math.random().toString(36).slice(2, 10);
}

export function useChat() {
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState([]); // {role, content, metadata?, isError?}
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('lyftr_saved_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep saved sessions in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lyftr_saved_sessions', JSON.stringify(sessions));
    } catch {
      /* ignore */
    }
  }, [sessions]);

  const startNewSession = useCallback(() => {
    const newId = generateSessionId();
    setSessionId(newId);
    setMessages([]);
  }, []);

  const selectSession = useCallback(async (id) => {
    setSessionId(id);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (text, systemPrompt) => {
      if (!text.trim() || isLoading) return;

      const trimmedText = text.trim();

      // Optimistically add user message
      const userMsg = { role: 'user', content: trimmedText };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Track session in recent list
      setSessions((prev) => {
        const title = trimmedText.length > 28 ? trimmedText.slice(0, 28) + '...' : trimmedText;
        const exists = prev.find((s) => s.id === sessionId);
        if (exists) return prev;
        return [{ id: sessionId, title, date: new Date().toLocaleDateString() }, ...prev].slice(0, 15);
      });

      try {
        const body = { session_id: sessionId, message: trimmedText };
        if (systemPrompt?.trim()) body.system_prompt = systemPrompt.trim();

        const res = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error: ${res.status}`);
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

  return {
    messages,
    isLoading,
    sendMessage,
    sessionId,
    sessions,
    startNewSession,
    selectSession,
  };
}
