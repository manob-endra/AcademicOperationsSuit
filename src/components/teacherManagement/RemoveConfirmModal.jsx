function RemoveConfirmModal({ teacher, onClose, onConfirm, removing }) {
  return (
    <div className="tm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal tm-modal--sm">
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">Remove Teacher</h2>
          <button className="tm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tm-modal-body">
          <p className="tm-confirm-text">
            Are you sure you want to remove <strong>{teacher.name}</strong>?
          </p>
          <p className="tm-confirm-sub">
            The teacher will be moved to the Removed list and can be restored later.
          </p>
        </div>
        <div className="tm-modal-footer">
          <button className="tm-btn tm-btn-ghost" onClick={onClose} disabled={removing}>Cancel</button>
          <button className="tm-btn tm-btn-danger" onClick={onConfirm} disabled={removing}>
            {removing ? 'Removing…' : 'Yes, Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RemoveConfirmModal;
