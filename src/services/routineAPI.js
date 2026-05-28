const API_BASE_URL = `${import.meta.env.VITE_API_URL}/routine`;

const makeRequest = async (url, options = {}) => {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 20000);
    const response   = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status} ${response.statusText}`;
      try {
        const r = await response.json();
        errorMsg = r.error || errorMsg;
      } catch { /* HTML error page */ }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err) {
    clearTimeout && clearTimeout();
    if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
      return { success: false, error: 'Cannot connect to backend server.', offline: true };
    }
    return { success: false, error: err.message };
  }
};

export const routineAPI = {
  async checkConflicts() {
    const result = await makeRequest(`${API_BASE_URL}/conflicts`);
    if (result.success) return { success: true, conflicts: result.conflicts };
    return result;
  },

  async generateRoutine() {
    const result = await makeRequest(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (result.success) {
      return {
        success:     true,
        entries:     result.entries,
        warnings:    result.warnings || [],
        generatedAt: result.generatedAt,
      };
    }
    return result;
  },

  async getRoutine() {
    const result = await makeRequest(API_BASE_URL);
    if (result.success) {
      return { success: true, entries: result.entries || [], generatedAt: result.generatedAt };
    }
    return result;
  },

  async clearRoutine() {
    return makeRequest(API_BASE_URL, { method: 'DELETE' });
  },
};
