const BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') + '/api';

async function req(url, opts = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

export const notificationSystemAPI = {
  // Jobs
  getJobs: (limit = 50) => req(`/email-notifications/jobs?limit=${limit}`),
  cancelJob: (id)       => req(`/email-notifications/jobs/${id}/cancel`, { method: 'POST' }),

  // Deliveries
  getDeliveries: ({ jobId, status, limit = 100, offset = 0 } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (jobId)  params.set('jobId',  jobId);
    if (status) params.set('status', status);
    return req(`/email-notifications/deliveries?${params}`);
  },
  retryDelivery: (id) => req(`/email-notifications/deliveries/${id}/retry`, { method: 'POST' }),

  // Unsubscribe list
  getOptedOut:   ()      => req('/email-notifications/opted-out'),
  resubscribe:   (email) => req('/email-notifications/resubscribe', {
    method: 'POST',
    body:   JSON.stringify({ email }),
  }),

  // Publish routine (triggers job creation).
  // semesterId = academic semester UUID (routine scope); batchId = student
  // batch short code (e.g. 'Y4-S1') identifying which entries to publish.
  publishRoutine: (semesterId, batchId, semesterLabel) => req('/routine/publish', {
    method: 'POST',
    body:   JSON.stringify({ semesterId, batchId, semesterLabel }),
  }),

  // Public unsubscribe by token
  unsubscribeByToken: (token) => req(`/unsubscribe?token=${encodeURIComponent(token)}`),
};
