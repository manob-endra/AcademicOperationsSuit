const BASE = `${import.meta.env.VITE_API_URL}/exam-routine`;

const req = async (url, options = {}) => {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 20000);
    const res  = await fetch(url, { ...options, signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    clearTimeout(tid);
    const json = await res.json();
    return json;
  } catch (err) {
    return { success: false, error: err.message, offline: true };
  }
};

export const examRoutineAPI = {
  // Get-or-create session + full data (slots, invigilators, teachers, weightMap)
  getSession: (type, semesterId) =>
    req(`${BASE}/${type}/session/${semesterId}`),

  updateConfig: (type, sessionId, config) =>
    req(`${BASE}/${type}/session/${sessionId}/config`, { method: 'PATCH', body: JSON.stringify(config) }),

  saveSlots: (type, sessionId, slots) =>
    req(`${BASE}/${type}/session/${sessionId}/slots`, { method: 'PUT', body: JSON.stringify({ slots }) }),

  saveInvigilators: (type, sessionId, invigilatorMap) =>
    req(`${BASE}/${type}/session/${sessionId}/invigilators`, { method: 'PUT', body: JSON.stringify({ invigilatorMap }) }),

  setWeight: (type, sessionId, teacher_id, weight) =>
    req(`${BASE}/${type}/session/${sessionId}/weight`, { method: 'PATCH', body: JSON.stringify({ teacher_id, weight }) }),

  autoAssign: (type, sessionId, semesterId, weightMap, teachersPerExam) =>
    req(`${BASE}/${type}/session/${sessionId}/auto-assign`, {
      method: 'POST',
      body: JSON.stringify({ semesterId, weightMap, teachersPerExam }),
    }),

  publish: (type, sessionId) =>
    req(`${BASE}/${type}/session/${sessionId}/publish`, { method: 'POST' }),

  getPublished: (type, semesterId) =>
    req(`${BASE}/${type}/published/${semesterId}`),

  getAllPublished: (type) =>
    req(`${BASE}/${type}/all-published`),
};
