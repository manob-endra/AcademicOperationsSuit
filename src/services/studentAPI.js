const API_BASE_URL = `${import.meta.env.VITE_API_URL}/students`;

const makeRequest = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      let msg = `Server error: ${response.status}`;
      try { const r = await response.json(); msg = r.error || msg; } catch { /* skip */ }
      throw new Error(msg);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
      return { success: false, error: 'Cannot connect to backend server.', offline: true };
    }
    return { success: false, error: err.message };
  }
};

export const studentAPI = {
  async getStudents() {
    const r = await makeRequest(API_BASE_URL);
    return r.success ? { success: true, data: r.data } : r;
  },

  async getRemovedStudents() {
    const r = await makeRequest(`${API_BASE_URL}/removed`);
    return r.success ? { success: true, data: r.data } : r;
  },

  async createStudent(data) {
    const r = await makeRequest(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.success ? { success: true, data: r.data } : r;
  },

  async updateStudent(id, data) {
    const r = await makeRequest(`${API_BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.success ? { success: true, data: r.data } : r;
  },

  async deleteStudent(id) {
    const r = await makeRequest(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
    return r.success ? { success: true } : r;
  },

  async restoreStudent(id) {
    const r = await makeRequest(`${API_BASE_URL}/${id}/restore`, { method: 'POST' });
    return r.success ? { success: true } : r;
  },

  async importStudents(students) {
    const r = await makeRequest(`${API_BASE_URL}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students }),
    });
    return r.success ? { success: true, data: r.data, count: r.count } : r;
  },

  async promoteBatch(fromYear, toYear) {
    const r = await makeRequest(`${API_BASE_URL}/promote-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromYear, toYear }),
    });
    return r.success ? { success: true, count: r.count } : r;
  },
};
