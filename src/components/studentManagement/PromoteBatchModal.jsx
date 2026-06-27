import { useState } from 'react';

const YEAR_ORDER = ['1st', '2nd', '3rd', '4th'];
const NEXT_YEAR  = { '1st': '2nd', '2nd': '3rd', '3rd': '4th', '4th': 'ms' };
const YEAR_LABEL = { '1st': '1st Year', '2nd': '2nd Year', '3rd': '3rd Year', '4th': '4th Year', 'ms': 'MS' };

function PromoteBatchModal({ students, onClose, onPromote }) {
  const [fromYear, setFromYear] = useState('1st');
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const toYear = NEXT_YEAR[fromYear];
  const count  = students.filter(s => s.academic_year === fromYear).length;

  const handlePromote = async () => {
    if (!count) return;
    setPromoting(true);
    setError('');
    const result = await onPromote(fromYear, toYear);
    setPromoting(false);
    if (result.success) {
      setDone({ fromYear, toYear, count: result.count ?? count });
    } else {
      setError(result.error || 'Promotion failed.');
    }
  };

  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal sm-modal--sm">
        <div className="sm-modal-header">
          <h2 className="sm-modal-title">Promote Batch</h2>
          <button className="sm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sm-modal-body">
          {done ? (
            <div className="sm-promote-success">
              <div className="sm-promote-check">✓</div>
              <p className="sm-promote-done-text">
                <strong>{done.count}</strong> student{done.count !== 1 ? 's' : ''} promoted from{' '}
                <strong>{YEAR_LABEL[done.fromYear]}</strong> to{' '}
                <strong>{YEAR_LABEL[done.toYear]}</strong>.
              </p>
            </div>
          ) : (
            <>
              <p className="sm-promote-hint">
                Move all active students from one year to the next.
              </p>
              <div className="sm-form-group" style={{ marginBottom: 16 }}>
                <label className="sm-label">Promote students currently in</label>
                <select className="sm-input" value={fromYear} onChange={e => setFromYear(e.target.value)}>
                  {YEAR_ORDER.map(y => (
                    <option key={y} value={y}>{YEAR_LABEL[y]}</option>
                  ))}
                </select>
              </div>
              <div className="sm-promote-summary">
                <span className="sm-promote-arrow">{YEAR_LABEL[fromYear]} → {YEAR_LABEL[toYear]}</span>
                <span className="sm-promote-count">
                  {count} student{count !== 1 ? 's' : ''} will be promoted
                </span>
              </div>
              {!count && (
                <p className="sm-promote-warn">No active students found in {YEAR_LABEL[fromYear]}.</p>
              )}
              {error && <p className="sm-form-error">{error}</p>}
            </>
          )}
        </div>
        <div className="sm-modal-footer">
          {done ? (
            <button className="sm-btn sm-btn-primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button className="sm-btn sm-btn-ghost" onClick={onClose} disabled={promoting}>Cancel</button>
              <button
                className="sm-btn sm-btn-primary"
                onClick={handlePromote}
                disabled={promoting || !count}
              >
                {promoting ? 'Promoting…' : `Promote ${count ? count : ''} Student${count !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PromoteBatchModal;
