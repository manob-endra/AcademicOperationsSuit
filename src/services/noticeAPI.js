const API_BASE_URL = `${import.meta.env.VITE_API_URL}/notices`;

const makeRequest = async (url, options = {}) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let msg = `Server error: ${response.status}`;
      try { const r = await response.json(); msg = r.error || msg; } catch {}
      throw new Error(msg);
    }
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
      return { success: false, error: 'Cannot connect to backend server.', offline: true };
    }
    return { success: false, error: err.message };
  }
};

export const noticeAPI = {
  async getAllNotices() {
    const result = await makeRequest(API_BASE_URL);
    if (result.success) return { success: true, notices: result.notices };
    return result;
  },

  async createNotice({ title, content, priority, created_by }) {
    return makeRequest(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, priority, created_by }),
    });
  },

  async updateNotice(id, updates) {
    return makeRequest(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteNotice(id) {
    return makeRequest(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
  },
};
