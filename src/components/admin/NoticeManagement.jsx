import { useState, useEffect, useRef } from 'react';
import { noticeAPI, MAX_DOCUMENT_BYTES } from '../../services/noticeAPI';
import DocumentAttachment from '../shared/DocumentAttachment';
import '../../styles/TeacherDashboard.css';

const PRIORITY_LABEL = { normal: 'Normal', important: 'Important', urgent: 'Urgent' };

const EMPTY_FORM = { title: '', content: '', priority: 'normal' };

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NoticeManagement({ user }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [docFile, setDocFile] = useState(null); // optional attachment
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setError('');
    if (file && file.size > MAX_DOCUMENT_BYTES) {
      setError('Document exceeds the 15 MB limit. Please choose a smaller file.');
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setDocFile(file);
  };

  const clearFile = () => {
    setDocFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const load = async () => {
    setLoading(true);
    const result = await noticeAPI.getAllNotices();
    if (result.success) setNotices(result.notices || []);
    else setError(result.error || 'Failed to load notices.');
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    // Upload the optional document first; only attach it if that succeeds.
    let doc = { url: null, name: null, size: null };
    if (docFile) {
      const up = await noticeAPI.uploadDocument(docFile);
      if (!up.success) {
        setError(up.error || 'Failed to upload the document.');
        setSaving(false);
        return;
      }
      doc = { url: up.url, name: up.name, size: up.size };
    }

    const result = await noticeAPI.createNotice({
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      created_by: user?.id || null,
      document_url: doc.url,
      document_name: doc.name,
      document_size: doc.size,
    });

    if (result.success) {
      setSuccess('Notice posted successfully.');
      setForm(EMPTY_FORM);
      clearFile();
      await load();
    } else {
      setError(result.error || 'Failed to post notice.');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notice?')) return;
    const result = await noticeAPI.deleteNotice(id);
    if (result.success) await load();
    else setError(result.error || 'Failed to delete notice.');
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a2a4a', margin: '0 0 6px' }}>Notice Management</h2>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
        Post notices that will be visible to all teachers on their dashboard.
      </p>

      {error   && <div className="td-alert error">{error}</div>}
      {success && <div className="td-alert success">{success}</div>}

      {/* Post form */}
      <div className="td-notice-form">
        <h3 className="td-notice-form-title">Post a New Notice</h3>
        <form onSubmit={handleSubmit}>
          <div className="td-form-row">
            <label>Title *</label>
            <input
              type="text"
              placeholder="Notice title…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="td-form-row">
            <label>Content *</label>
            <textarea
              placeholder="Write the notice content here…"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              required
            />
          </div>

          <div className="td-form-row">
            <label>Priority</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="td-form-row">
            <label>Attachment (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip"
              onChange={handleFileChange}
            />
            <small style={{ color: '#6b7280', fontSize: 12 }}>
              PDF or document, up to 15 MB.
            </small>
            {docFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 13 }}>
                <span>📎 {docFile.name} <span style={{ color: '#6b7280' }}>({formatSize(docFile.size)})</span></span>
                <button
                  type="button"
                  onClick={clearFile}
                  style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="td-save-btn" disabled={saving}>
            {saving ? (docFile ? 'Uploading & posting…' : 'Posting…') : 'Post Notice'}
          </button>
        </form>
      </div>

      {/* Posted notices */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2a4a', margin: '0 0 14px' }}>
        Posted Notices ({notices.length})
      </h3>

      {loading && (
        <div className="td-loading">
          <div className="td-loading-spinner" />
          Loading…
        </div>
      )}

      {!loading && notices.length === 0 && (
        <div className="td-empty-state">
          <div className="td-empty-icon">📋</div>
          <p>No notices have been posted yet.</p>
        </div>
      )}

      {notices.map(n => (
        <div key={n.id} className={`td-notice-list-item ${n.priority || 'normal'}`}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <p className="td-notice-list-title">{n.title}</p>
              <span className={`td-notice-badge ${n.priority || 'normal'}`}>
                {PRIORITY_LABEL[n.priority] || 'Normal'}
              </span>
            </div>
            <p className="td-notice-list-body">{n.content}</p>
            {n.document_url && (
              <DocumentAttachment url={n.document_url} name={n.document_name} size={n.document_size} />
            )}
            <p className="td-notice-list-meta">Posted {formatDate(n.created_at)}</p>
          </div>
          <button className="td-delete-btn" onClick={() => handleDelete(n.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default NoticeManagement;
