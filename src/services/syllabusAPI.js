const API_BASE_URL = `${import.meta.env.VITE_API_URL}/syllabus`;
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
      try { const r = await response.json(); msg = r.error || msg; } catch { /* HTML error page */ }
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

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * Syllabus catalog API — versioned syllabi, option groups, batches,
 * per-academic-semester batch→syllabus assignments and course offerings.
 */
export const syllabusAPI = {

  // ── Syllabi ─────────────────────────────────────────────────────────
  async getAllSyllabi() {
    const r = await makeRequest(API_BASE_URL);
    if (r.success) return { success: true, data: r.data, migrationNeeded: r.migrationNeeded };
    return r;
  },

  async createSyllabus(fields) {
    return makeRequest(API_BASE_URL, json('POST', fields));
  },

  async updateSyllabus(id, fields) {
    return makeRequest(`${API_BASE_URL}/${id}`, json('PATCH', fields));
  },

  async deleteSyllabus(id) {
    return makeRequest(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
  },

  // ── Option groups ───────────────────────────────────────────────────
  async getOptionGroups(syllabusId) {
    const qs = syllabusId ? `?syllabusId=${syllabusId}` : '';
    const r = await makeRequest(`${API_BASE_URL}/option-groups${qs}`);
    if (r.success) return { success: true, data: r.data };
    return r;
  },

  async createOptionGroup(fields) {
    return makeRequest(`${API_BASE_URL}/option-groups`, json('POST', fields));
  },

  async updateOptionGroup(id, fields) {
    return makeRequest(`${API_BASE_URL}/option-groups/${id}`, json('PATCH', fields));
  },

  async deleteOptionGroup(id) {
    return makeRequest(`${API_BASE_URL}/option-groups/${id}`, { method: 'DELETE' });
  },

  // ── Batches ─────────────────────────────────────────────────────────
  async getAllBatches() {
    const r = await makeRequest(`${API_BASE_URL}/batches`);
    if (r.success) return { success: true, data: r.data };
    return r;
  },

  async createBatch(fields) {
    return makeRequest(`${API_BASE_URL}/batches`, json('POST', fields));
  },

  async deleteBatch(id) {
    return makeRequest(`${API_BASE_URL}/batches/${id}`, { method: 'DELETE' });
  },

  // ── Semester batch → syllabus assignments ───────────────────────────
  async getAssignments(semesterId) {
    const r = await makeRequest(`${API_BASE_URL}/assignments?semesterId=${semesterId}`);
    if (r.success) return { success: true, data: r.data };
    return r;
  },

  async assignSyllabus(semesterId, batchCode, syllabusId) {
    return makeRequest(`${API_BASE_URL}/assignments`, json('PUT', { semesterId, batchCode, syllabusId }));
  },

  // ── Course offerings (optional courses running this semester) ──────
  async getOfferings(semesterId) {
    const r = await makeRequest(`${API_BASE_URL}/offerings?semesterId=${semesterId}`);
    if (r.success) return { success: true, data: r.data };
    return r;
  },

  async setOffering(semesterId, courseId, offered) {
    return makeRequest(`${API_BASE_URL}/offerings`, json('PUT', { semesterId, courseId, offered }));
  },

  // ── Course equivalences ─────────────────────────────────────────────
  async getEquivalences() {
    const r = await makeRequest(`${API_BASE_URL}/equivalences`);
    if (r.success) return { success: true, data: r.data };
    return r;
  },

  async addEquivalence(oldCourseId, newCourseId) {
    return makeRequest(`${API_BASE_URL}/equivalences`, json('POST', { oldCourseId, newCourseId }));
  },

  async removeEquivalence(id) {
    return makeRequest(`${API_BASE_URL}/equivalences/${id}`, { method: 'DELETE' });
  },
};
