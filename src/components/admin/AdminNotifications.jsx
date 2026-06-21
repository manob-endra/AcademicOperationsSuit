import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationAPI } from '../../services/notificationAPI';
import { teacherAPI } from '../../services/teacherAPI';

const TEACHER_DOMAIN = '@cse.du.ac.bd';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function deriveInitials(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);
}

function AdminNotifications() {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [expandedId,    setExpandedId]    = useState(null); // notification id with open form
  const [teacherForm,   setTeacherForm]   = useState({ name: '', initials: '', load_limit: 20 });
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState('');
  const panelRef = useRef(null);

  // Poll unread count every 30 s
  const loadCount = useCallback(async () => {
    const r = await notificationAPI.getUnreadCount();
    if (r.success) setUnreadCount(r.count);
  }, []);

  useEffect(() => {
    loadCount();
    const tid = setInterval(loadCount, 30000);
    return () => clearInterval(tid);
  }, [loadCount]);

  // Load full list when panel opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const r = await notificationAPI.getAll();
      if (r.success) {
        setNotifications(r.notifications || []);
        // Mark unread (not handled) ones as read
        const unread = (r.notifications || []).filter(n => !n.is_read && !n.is_handled);
        unread.forEach(n => notificationAPI.markRead(n.id));
        setUnreadCount(0);
      }
    })();
  }, [open]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const refreshList = async () => {
    const r = await notificationAPI.getAll();
    if (r.success) setNotifications(r.notifications || []);
  };

  const openAddForm = (notif) => {
    if (expandedId === notif.id) { setExpandedId(null); return; }
    setExpandedId(notif.id);
    setSaveError('');
    setTeacherForm({
      name:       notif.user_name || '',
      initials:   deriveInitials(notif.user_name),
      load_limit: 20,
    });
  };

  const handleAddTeacher = async (notif) => {
    if (!teacherForm.name.trim() || !teacherForm.initials.trim()) {
      setSaveError('Name and initials are required.');
      return;
    }
    setSaving(true);
    setSaveError('');

    const r = await teacherAPI.createTeacher({
      name:        teacherForm.name.trim(),
      initials:    teacherForm.initials.trim().toUpperCase(),
      email:       notif.user_email,
      department:  'CSE',
      load_limit:  Number(teacherForm.load_limit) || 20,
    });

    if (r.success) {
      await notificationAPI.markHandled(notif.id);
      setExpandedId(null);
      await refreshList();
    } else {
      setSaveError(r.error || 'Failed to add teacher.');
    }
    setSaving(false);
  };

  const isTeacherEligible = (notif) =>
    !notif.is_handled &&
    notif.user_email?.toLowerCase().endsWith(TEACHER_DOMAIN);

  const pending  = notifications.filter(n => !n.is_handled);
  const handled  = notifications.filter(n =>  n.is_handled);

  return (
    <div className="notif-wrapper" ref={panelRef}>
      {/* Bell button */}
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {pending.length > 0 && (
              <span className="notif-count-chip">{pending.length} pending</span>
            )}
          </div>

          <div className="notif-panel-body">
            {notifications.length === 0 && (
              <div className="notif-empty">No notifications yet.</div>
            )}

            {/* Pending / unhandled */}
            {pending.map(notif => (
              <div key={notif.id} className={`notif-item${notif.is_read ? '' : ' unread'}`}>
                <div className="notif-item-top">
                  <div className="notif-avatar">
                    {(notif.user_name || notif.user_email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-msg">
                      <span className="notif-user">{notif.user_name || notif.user_email}</span>
                      {' signed up'}
                    </div>
                    <div className="notif-item-meta">
                      {notif.user_email} &bull; {notif.user_role} &bull; {timeAgo(notif.created_at)}
                    </div>
                  </div>
                </div>

                {isTeacherEligible(notif) && (
                  <div className="notif-actions">
                    <button
                      className="notif-add-btn"
                      onClick={() => openAddForm(notif)}
                    >
                      {expandedId === notif.id ? 'Cancel' : '+ Add as Teacher'}
                    </button>
                  </div>
                )}

                {expandedId === notif.id && (
                  <div className="notif-add-form">
                    {saveError && <div className="notif-form-error">{saveError}</div>}
                    <div className="notif-form-row">
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={teacherForm.name}
                        onChange={e => setTeacherForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Dr. John Doe"
                      />
                    </div>
                    <div className="notif-form-row">
                      <label>Initials</label>
                      <input
                        type="text"
                        value={teacherForm.initials}
                        onChange={e => setTeacherForm(f => ({ ...f, initials: e.target.value }))}
                        placeholder="JD"
                        maxLength={4}
                        style={{ width: 80 }}
                      />
                    </div>
                    <div className="notif-form-row">
                      <label>Load Limit (hrs/week)</label>
                      <input
                        type="number"
                        value={teacherForm.load_limit}
                        onChange={e => setTeacherForm(f => ({ ...f, load_limit: e.target.value }))}
                        min={1}
                        max={40}
                        style={{ width: 80 }}
                      />
                    </div>
                    <button
                      className="notif-confirm-btn"
                      onClick={() => handleAddTeacher(notif)}
                      disabled={saving}
                    >
                      {saving ? 'Adding…' : 'Confirm — Add Teacher'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Handled / done */}
            {handled.length > 0 && (
              <>
                <div className="notif-section-label">Handled</div>
                {handled.map(notif => (
                  <div key={notif.id} className="notif-item handled">
                    <div className="notif-item-top">
                      <div className="notif-avatar handled">
                        {(notif.user_name || notif.user_email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="notif-item-body">
                        <div className="notif-item-msg">
                          <span className="notif-user">{notif.user_name || notif.user_email}</span>
                          {' — added as teacher'}
                        </div>
                        <div className="notif-item-meta">
                          {notif.user_email} &bull; {timeAgo(notif.created_at)}
                        </div>
                      </div>
                      <span className="notif-done-badge">Done</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminNotifications;
