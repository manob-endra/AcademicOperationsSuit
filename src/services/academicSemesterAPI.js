const API_BASE_URL = `${import.meta.env.VITE_API_URL}/academic-semesters`;
const HEALTH_CHECK_URL = `${import.meta.env.VITE_API_URL}/health`;

let backendAvailable = true;

const checkBackendConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 3000);
    const response   = await fetch(HEALTH_CHECK_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

const makeRequest = async (url, options = {}) => {
  if (!backendAvailable) {
    backendAvailable = await checkBackendConnection();
  }
  if (!backendAvailable) {
    return { success: false, error: 'Backend server is not running.', offline: true };
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let msg = `Server error: ${response.status} ${response.statusText}`;
      try { const r = await response.json(); msg = r.error || msg; } catch {}
      throw new Error(msg);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
      backendAvailable = false;
      return { success: false, error: 'Cannot connect to backend server.', offline: true };
    }
    return { success: false, error: error.message };
  }
};

export const academicSemesterAPI = {
  async getAllSemesters() {
    const result = await makeRequest(API_BASE_URL);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async getRemovedSemesters() {
    const result = await makeRequest(`${API_BASE_URL}/removed`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async getSemesterById(id) {
    const result = await makeRequest(`${API_BASE_URL}/${id}`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  /**
   * Create a semester. Pass rollover=true to archive the current
   * course→teacher assignments to course history and refresh all
   * routine data (loads, preferences, time slots, rooms, selection).
   */
  async createSemester(year, name, rollover = false) {
    const result = await makeRequest(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, name, rollover }),
    });
    if (result.success) return { success: true, data: result.data, rollover: result.rollover };
    return result;
  },

  /** Soft delete — semester moves to the recoverable Removed list. */
  async removeSemester(id) {
    const result = await makeRequest(`${API_BASE_URL}/${id}/remove`, { method: 'PATCH' });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  /** Recover a semester from the Removed list. */
  async restoreSemester(id) {
    const result = await makeRequest(`${API_BASE_URL}/${id}/restore`, { method: 'PATCH' });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  /** Permanent delete (from the Removed list only). */
  async deleteSemester(id) {
    const result = await makeRequest(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
    if (result.success) return { success: true };
    return result;
  },
};
