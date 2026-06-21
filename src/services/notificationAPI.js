const API_BASE = `${import.meta.env.VITE_API_URL}/notifications`;

const req = async (url, options = {}) => {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const res  = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try { const r = await res.json(); msg = r.error || msg; } catch {}
      throw new Error(msg);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
      return { success: false, offline: true, error: 'Cannot reach server.' };
    }
    return { success: false, error: err.message };
  }
};

export const notificationAPI = {
  getAll() {
    return req(API_BASE);
  },
  getUnreadCount() {
    return req(`${API_BASE}/unread-count`);
  },
  markRead(id) {
    return req(`${API_BASE}/${id}/read`, { method: 'PATCH' });
  },
  markHandled(id) {
    return req(`${API_BASE}/${id}/handled`, { method: 'PATCH' });
  },
};
