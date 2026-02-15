import { useState, useCallback, useRef, useEffect } from 'react';
import { nlQueryApi } from '@api/nlQuery';

const STORAGE_KEY = 'auditi_nl_sessions';
const MAX_SAVED_SESSIONS = 20;

/**
 * Migrate old flat assistant messages to the versioned format.
 * Old: { role: 'assistant', content, data, visualization }
 * New: { role: 'assistant', versions: [{ content, data, visualization }], activeVersion: 0 }
 */
function migrateMessage(msg) {
  if (msg.role !== 'assistant') return msg;
  if (Array.isArray(msg.versions)) return msg;
  return {
    role: 'assistant',
    versions: [{
      content: msg.content || '',
      data: msg.data,
      visualization: msg.visualization,
      isError: msg.isError,
    }],
    activeVersion: 0,
  };
}

function migrateMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map(migrateMessage);
}

function loadSavedSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions = JSON.parse(raw);
    return sessions.map((s) => ({
      ...s,
      messages: migrateMessages(s.messages),
    }));
  } catch {
    return [];
  }
}

function persistSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SAVED_SESSIONS)));
  } catch {
    // quota exceeded — silently ignore
  }
}

/**
 * Message shape:
 *   User:      { role: 'user', content: string }
 *   Assistant:  { role: 'assistant', versions: [{ content, data, visualization, isError }], activeVersion: number }
 *
 * `versions` holds all regenerated responses. `activeVersion` is the index the user is currently viewing.
 * The conversation continues from the *active* version, so follow-up context stays coherent.
 */

export function useNLQuery() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(0);
  const [savedSessions, setSavedSessions] = useState(loadSavedSessions);
  const sessionIdRef = useRef(null);

  // Save current session to localStorage whenever messages change
  useEffect(() => {
    if (messages.length === 0 || !sessionIdRef.current) return;

    const firstUserMsg = messages.find((m) => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 80) : 'Untitled';

    setSavedSessions((prev) => {
      const existing = prev.filter((s) => s.id !== sessionIdRef.current);
      const updated = [
        {
          id: sessionIdRef.current,
          title,
          messages,
          tokenUsage,
          updatedAt: new Date().toISOString(),
        },
        ...existing,
      ].slice(0, MAX_SAVED_SESSIONS);
      persistSessions(updated);
      return updated;
    });
  }, [messages, tokenUsage]);

  const sendQuery = useCallback(async (query) => {
    setError(null);
    setIsLoading(true);

    // Add user message immediately
    setMessages((prev) => [...prev, { role: 'user', content: query }]);

    try {
      const res = await nlQueryApi.askQuery(query, sessionIdRef.current);
      sessionIdRef.current = res.session_id;

      if (res.token_usage) {
        setTokenUsage((prev) => prev + res.token_usage);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          versions: [{
            content: res.answer,
            data: res.data,
            visualization: res.visualization,
          }],
          activeVersion: 0,
        },
      ]);
    } catch (err) {
      const msg = err.message || 'Failed to process query';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          versions: [{ content: msg, isError: true }],
          activeVersion: 0,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Regenerate the assistant response at the given message index.
   * Finds the preceding user message, re-sends the same query with regenerate=true,
   * and appends the new response as another version.
   */
  const regenerate = useCallback(async (assistantIndex) => {
    // Find the user message just before this assistant message
    const userMsg = messages.slice(0, assistantIndex).reverse().find((m) => m.role === 'user');
    if (!userMsg) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await nlQueryApi.askQuery(userMsg.content, sessionIdRef.current, true);
      sessionIdRef.current = res.session_id;

      if (res.token_usage) {
        setTokenUsage((prev) => prev + res.token_usage);
      }

      setMessages((prev) => {
        const updated = [...prev];
        const msg = { ...updated[assistantIndex] };
        const newVersions = [
          ...msg.versions,
          {
            content: res.answer,
            data: res.data,
            visualization: res.visualization,
          },
        ];
        updated[assistantIndex] = {
          ...msg,
          versions: newVersions,
          activeVersion: newVersions.length - 1,
        };
        return updated;
      });
    } catch (err) {
      const errMsg = err.message || 'Regeneration failed';
      setError(errMsg);
      setMessages((prev) => {
        const updated = [...prev];
        const msg = { ...updated[assistantIndex] };
        const newVersions = [...msg.versions, { content: errMsg, isError: true }];
        updated[assistantIndex] = {
          ...msg,
          versions: newVersions,
          activeVersion: newVersions.length - 1,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  /**
   * Navigate to a specific version of an assistant message.
   */
  const setActiveVersion = useCallback((assistantIndex, versionIndex) => {
    setMessages((prev) => {
      const updated = [...prev];
      const msg = updated[assistantIndex];
      if (!msg || msg.role !== 'assistant') return prev;
      const clamped = Math.max(0, Math.min(versionIndex, msg.versions.length - 1));
      updated[assistantIndex] = { ...msg, activeVersion: clamped };
      return updated;
    });
  }, []);

  const resetSession = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await nlQueryApi.clearSession(sessionIdRef.current);
      } catch {
        // ignore
      }
    }
    sessionIdRef.current = null;
    setMessages([]);
    setTokenUsage(0);
    setError(null);
  }, []);

  const loadSession = useCallback((session) => {
    sessionIdRef.current = session.id;
    setMessages(migrateMessages(session.messages));
    setTokenUsage(session.tokenUsage || 0);
    setError(null);
  }, []);

  const deleteSession = useCallback((sessionId) => {
    setSavedSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      persistSessions(updated);
      return updated;
    });
    if (sessionIdRef.current === sessionId) {
      sessionIdRef.current = null;
      setMessages([]);
      setTokenUsage(0);
    }
  }, []);

  const sessionId = sessionIdRef.current;

  return {
    messages,
    isLoading,
    error,
    sessionId,
    tokenUsage,
    savedSessions,
    sendQuery,
    regenerate,
    setActiveVersion,
    resetSession,
    loadSession,
    deleteSession,
  };
}
