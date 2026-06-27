const API_BASE_URL = `${import.meta.env.VITE_API_URL}/teachers`;
const HEALTH_CHECK_URL = `${import.meta.env.VITE_API_URL}/health`;

let backendAvailable = true;

const checkBackendConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(HEALTH_CHECK_URL, { method: 'GET', signal: controller.signal });
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
    return {
      success: false,
      error: 'Backend server is not running. Please start it with: npm run dev',
      offline: true,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status} ${response.statusText}`;
      try {
        const result = await response.json();
        errorMessage = result.error || errorMessage;
      } catch {
        // HTML error page — use status text
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
      backendAvailable = false;
      return {
        success: false,
        error: 'Cannot connect to backend server. Make sure it is running on port 3001.',
        offline: true,
      };
    }
    return { success: false, error: error.message };
  }
};

export const teacherAPI = {
  async getTeachers() {
    const result = await makeRequest(API_BASE_URL);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async createTeacher(teacherData) {
    const result = await makeRequest(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherData),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async getRemovedTeachers() {
    const result = await makeRequest(`${API_BASE_URL}/removed`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async deleteTeacher(teacherId) {
    const result = await makeRequest(`${API_BASE_URL}/${teacherId}`, { method: 'DELETE' });
    if (result.success) return { success: true };
    return result;
  },

  async updateLoadLimit(teacherId, loadLimit) {
    const result = await makeRequest(`${API_BASE_URL}/${teacherId}/load-limit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loadLimit }),
    });
    if (result.success) return { success: true };
    return result;
  },

  async restoreTeacher(teacherId) {
    const result = await makeRequest(`${API_BASE_URL}/${teacherId}/restore`, { method: 'POST' });
    if (result.success) return { success: true };
    return result;
  },

  async updateTeacher(teacherId, fields) {
    const result = await makeRequest(`${API_BASE_URL}/${teacherId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async importTeachers(teachers) {
    const result = await makeRequest(`${API_BASE_URL}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teachers }),
    });
    if (result.success) return { success: true, data: result.data, count: result.count };
    return result;
  },

  async getAllAvailability() {
    const result = await makeRequest(`${API_BASE_URL}/availability`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  async saveAvailability(teacherId, selectedSlots) {
    const result = await makeRequest(`${API_BASE_URL}/${teacherId}/availability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedSlots }),
    });
    if (result.success) return { success: true };
    return result;
  },
};
