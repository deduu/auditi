import { client } from './client';

export const nlQueryApi = {
  askQuery: (query, sessionId = null, regenerate = false) =>
    client.post('/nl-query/ask', { query, session_id: sessionId, regenerate }),

  getSuggestions: () =>
    client.get('/nl-query/suggestions'),

  getSession: (sessionId) =>
    client.get(`/nl-query/session/${sessionId}`),

  clearSession: (sessionId) =>
    client.delete(`/nl-query/session/${sessionId}`),
};
