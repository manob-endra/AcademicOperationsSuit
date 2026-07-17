import { useState, useEffect } from 'react';
import { noticeAPI } from '../../services/noticeAPI';
import DocumentAttachment from '../shared/DocumentAttachment';

const PRIORITY_LABEL = { normal: 'Normal', important: 'Important', urgent: 'Urgent' };

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    '  ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function Notice() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    setLoading(true);
    const result = await noticeAPI.getAllNotices();
    if (result.success) {
      setNotices(result.notices || []);
    } else {
      setError(result.offline
        ? 'Cannot reach server. Check that the backend is running.'
        : result.error || 'Failed to load notices.');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="td-loading">
        <div className="td-loading-spinner" />
        Loading notices…
      </div>
    );
  }

  return (
    <div>
      <h2 className="td-section-title">Notice Board</h2>
      <p className="td-section-subtitle">
        Announcements and updates from the department administration.
      </p>

      {error && <div className="td-alert error">{error}</div>}

      {!error && notices.length === 0 && (
        <div className="td-empty-state">
          <div className="td-empty-icon">📋</div>
          <p>No notices have been posted yet. Check back later.</p>
        </div>
      )}

      <div className="td-notice-grid">
        {notices.map(notice => (
          <div
            key={notice.id}
            className={`td-notice-card priority-${notice.priority || 'normal'}`}
          >
            <div className="td-notice-card-top">
              <h3 className="td-notice-title">{notice.title}</h3>
              <span className={`td-notice-badge ${notice.priority || 'normal'}`}>
                {PRIORITY_LABEL[notice.priority] || 'Normal'}
              </span>
            </div>
            <p className="td-notice-content">{notice.content}</p>
            {notice.document_url && (
              <DocumentAttachment url={notice.document_url} name={notice.document_name} size={notice.document_size} />
            )}
            <div className="td-notice-footer">
              Posted on {formatDate(notice.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notice;
