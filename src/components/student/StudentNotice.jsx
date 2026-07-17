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

function StudentNotice() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  if (loading) {
    return (
      <div className="sd-loading">
        <div className="sd-loading-spinner" />
        Loading notices…
      </div>
    );
  }

  return (
    <div>
      <h2 className="sd-section-title">Notice Board</h2>
      <p className="sd-section-subtitle">
        Announcements and updates from the Department of CSE.
      </p>

      {error && <div className="sd-alert error">{error}</div>}

      {!error && notices.length === 0 && (
        <div className="sd-empty-state">
          <div className="sd-empty-icon">📋</div>
          <p>No notices have been posted yet. Check back later.</p>
        </div>
      )}

      <div className="sd-notice-grid">
        {notices.map(notice => (
          <div
            key={notice.id}
            className={`sd-notice-card priority-${notice.priority || 'normal'}`}
          >
            <div className="sd-notice-card-top">
              <h3 className="sd-notice-title">{notice.title}</h3>
              <span className={`sd-notice-badge ${notice.priority || 'normal'}`}>
                {PRIORITY_LABEL[notice.priority] || 'Normal'}
              </span>
            </div>
            <p className="sd-notice-content">{notice.content}</p>
            {notice.document_url && (
              <DocumentAttachment url={notice.document_url} name={notice.document_name} size={notice.document_size} />
            )}
            <div className="sd-notice-footer">
              Posted on {formatDate(notice.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentNotice;
