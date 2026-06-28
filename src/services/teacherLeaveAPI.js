const BASE = (import.meta.env.VITE_API_URL?.replace('/routine', '') || 'http://localhost:3001/api') + '/teacher-leaves';

async function req(url, opts = {}) {
  try {
    const res = await fetch(`${BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    return res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export const teacherLeaveAPI = {
  // Admin
  getAllLeaves:      ()          => req('/'),
  getRequests:      ()          => req('/requests'),
  getTeacherLeaves: (teacherId) => req(`/teacher/${teacherId}`),
  addLeave: (data) => req('/', {
    method: 'POST',
    body:   JSON.stringify(data),
  }),
  approveRequest: (id, adminNote = '') => req(`/${id}/approve`, {
    method: 'PATCH',
    body:   JSON.stringify({ admin_note: adminNote }),
  }),
  rejectRequest: (id, adminNote = '') => req(`/${id}/reject`, {
    method: 'PATCH',
    body:   JSON.stringify({ admin_note: adminNote }),
  }),
  deleteLeave: (id) => req(`/${id}`, { method: 'DELETE' }),

  // Teacher
  submitRequest: (data) => req('/request', {
    method: 'POST',
    body:   JSON.stringify(data),
  }),
  getMyLeaves: (email) => req(`/by-email?email=${encodeURIComponent(email)}`),
};
