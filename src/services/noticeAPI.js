import { supabase } from '../supabaseClient';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/notices`;

const NOTICE_BUCKET = 'notice-documents';
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024; // 15 MB

const makeRequest = async (url, options = {}) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let msg = `Server error: ${response.status}`;
      try { const r = await response.json(); msg = r.error || msg; } catch {}
      throw new Error(msg);
    }
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
      return { success: false, error: 'Cannot connect to backend server.', offline: true };
    }
    return { success: false, error: err.message };
  }
};

export const noticeAPI = {
  async getAllNotices() {
    const result = await makeRequest(API_BASE_URL);
    if (result.success) return { success: true, notices: result.notices };
    return result;
  },

  /**
   * Upload an optional notice document straight to Supabase Storage from the
   * browser. Returns { url, name, size } to pass into createNotice, or an
   * error. Enforces the 15 MB cap client-side (the bucket enforces it too).
   */
  async uploadDocument(file) {
    if (!file) return { success: false, error: 'No file selected.' };
    if (file.size > MAX_DOCUMENT_BYTES) {
      return { success: false, error: 'Document exceeds the 15 MB limit.' };
    }
    // Unique object path so two files with the same name never collide.
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const { error } = await supabase
      .storage
      .from(NOTICE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });

    if (error) {
      return { success: false, error: error.message || 'Failed to upload document.' };
    }

    const { data } = supabase.storage.from(NOTICE_BUCKET).getPublicUrl(path);
    return { success: true, url: data.publicUrl, name: file.name, size: file.size };
  },

  async createNotice({ title, content, priority, created_by, document_url, document_name, document_size }) {
    return makeRequest(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, content, priority, created_by,
        document_url: document_url || null,
        document_name: document_name || null,
        document_size: document_size ?? null,
      }),
    });
  },

  async updateNotice(id, updates) {
    return makeRequest(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteNotice(id) {
    return makeRequest(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
  },
};
