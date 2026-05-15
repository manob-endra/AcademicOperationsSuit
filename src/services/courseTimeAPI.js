/**
 * Frontend API Service for Course Time (duration settings per course)
 */

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/course-time`;
const HEALTH_CHECK_URL = `${import.meta.env.VITE_API_URL}/health`;

let backendAvailable = true;

const checkBackendConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal,
    });
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
        // HTML response (404 page etc.) — use status text
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

export const courseTimeAPI = {

  /** Fetch all active courses from the database */
  async getCourses() {
    const result = await makeRequest(`${API_BASE_URL}/courses`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  /** Fetch all saved course durations */
  async getDurations() {
    const result = await makeRequest(`${API_BASE_URL}/durations`);
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  /**
   * Save (upsert) the duration for a single course.
   * @param {string} courseId
   * @param {number} durationPeriods
   */
  async saveDuration(courseId, durationPeriods) {
    const result = await makeRequest(`${API_BASE_URL}/durations/${courseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationPeriods }),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },

  /**
   * Save (upsert) durations for many courses at once.
   * @param {Array<{courseId: string, durationPeriods: number}>} durations
   */
  async saveBulkDurations(durations) {
    const result = await makeRequest(`${API_BASE_URL}/durations/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durations }),
    });
    if (result.success) return { success: true, data: result.data };
    return result;
  },
};
