function RemoveConfirmModal({ student, onClose, onConfirm, removing }) {
  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal sm-modal--sm">
        <div className="sm-modal-header">
          <h2 className="sm-modal-title">Remove Student</h2>
          <button className="sm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sm-modal-body">
          <p className="sm-confirm-text">
            Are you sure you want to remove <strong>{student.name}</strong>?
          </p>
          <p className="sm-confirm-sub">
            The student will be moved to the Removed list and can be restored later.
          </p>
        </div>
        <div className="sm-modal-footer">
          <button className="sm-btn sm-btn-ghost" onClick={onClose} disabled={removing}>Cancel</button>
          <button className="sm-btn sm-btn-danger" onClick={onConfirm} disabled={removing}>
            {removing ? 'Removing…' : 'Yes, Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RemoveConfirmModal;
