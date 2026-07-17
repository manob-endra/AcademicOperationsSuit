const API_BASE_URL = `${import.meta.env.VITE_API_URL}/routine`;

const makeRequest = async (url, options = {}, timeoutMs = 20000) => {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);
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

// Every call works inside one academic semester — `semesterId` is the UUID
// from the /routine-management/:semesterId route.
export const routineAPI = {
  async checkConflicts(semesterId) {
    const result = await makeRequest(`${API_BASE_URL}/conflicts?semesterId=${semesterId}`);
    if (result.success) return { success: true, conflicts: result.conflicts };
    return result;
  },

  /**
   * Run the memetic GA and get a routine PREVIEW (not persisted).
   * Optional `seed` reproduces a previous run exactly.
   * Generation can take a while on large inputs — generous timeout.
   */
  async generateRoutine(semesterId, seed) {
    const body = { semesterId };
    if (seed !== undefined && seed !== null && seed !== '') body.seed = seed;
    const result = await makeRequest(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 180000);
    if (result.success) {
      return {
        success:     true,
        entries:     result.entries,
        warnings:    result.warnings || [],
        report:      result.report || null,
        generatedAt: result.generatedAt,
      };
    }
    return result;
  },

  /** Persist a previewed routine so it can be published. */
  async saveRoutine(semesterId, entries, generatedAt) {
    return makeRequest(`${API_BASE_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semesterId, entries, generatedAt }),
    });
  },

  async getRoutine(semesterId) {
    const result = await makeRequest(`${API_BASE_URL}?semesterId=${semesterId}`);
    if (result.success) {
      return { success: true, entries: result.entries || [], generatedAt: result.generatedAt };
    }
    return result;
  },

  /**
   * The most recently published routine, for viewers with no semester
   * context of their own (student "My Routine", teacher routine pages).
   * Also returns which academic semester it belongs to, so the caller can
   * fetch that semester's class time settings / teacher loads to match.
   */
  async getPublishedRoutine() {
    const result = await makeRequest(`${API_BASE_URL}/published`);
    if (result.success) {
      return {
        success: true,
        entries: result.entries || [],
        generatedAt: result.generatedAt,
        semesterId: result.semesterId,
        semesterLabel: result.semesterLabel,
      };
    }
    return result;
  },

  async clearRoutine(semesterId) {
    return makeRequest(`${API_BASE_URL}?semesterId=${semesterId}`, { method: 'DELETE' });
  },

  /**
   * Publish one student batch's routine.
   * `semesterId` is the academic semester UUID; `batchId` is the batch short
   * code (e.g. 'Y4-S1') identifying which entries to publish.
   */
  async publishRoutine(semesterId, batchId, semesterLabel) {
    return makeRequest(`${API_BASE_URL}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semesterId, batchId, semesterLabel }),
    });
  },
};
