const API_BASE = `${import.meta.env.VITE_API_URL}/academic-calendars`;
const HEALTH_URL = `${import.meta.env.VITE_API_URL}/health`;

let backendAvailable = true;

const checkBackend = async () => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(HEALTH_URL, { signal: ctrl.signal });
    clearTimeout(tid);
    return res.ok;
  } catch { return false; }
};

const makeRequest = async (url, options = {}) => {
  if (!backendAvailable) backendAvailable = await checkBackend();
  if (!backendAvailable) return { success: false, error: 'Backend server is not running.', offline: true };

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) {
      let msg = `Server error: ${res.status}`;
      try { const r = await res.json(); msg = r.error || msg; } catch {}
      throw new Error(msg);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
      backendAvailable = false;
      return { success: false, error: 'Cannot connect to backend server.', offline: true };
    }
    return { success: false, error: err.message };
  }
};

export const academicCalendarAPI = {
  async getCalendar(semesterId) {
    return makeRequest(`${API_BASE}/${semesterId}`);
  },

  async getPublishedCalendars() {
    return makeRequest(API_BASE);
  },

  async saveCalendar(semesterId, config, entries, published = false) {
    return makeRequest(`${API_BASE}/${semesterId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, entries, published }),
    });
  },

  async publishCalendar(semesterId, config, entries) {
    return makeRequest(`${API_BASE}/${semesterId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, entries }),
    });
  },
};
