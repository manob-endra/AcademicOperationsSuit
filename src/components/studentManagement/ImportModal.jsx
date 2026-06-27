import { useState, useRef } from 'react';

const EXPECTED = ['registration_no','name','hall','date_of_birth','roll','email','mobile','institutional_email','session','academic_year','parents_contact'];

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_').replace(/['"]/g,''));
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.name?.trim());
};

const parseTSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(line => {
    const vals = line.split('\t').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.name?.trim());
};

const parseJSON = (text) => {
  const d = JSON.parse(text);
  const arr = Array.isArray(d) ? d : d.students || [];
  return arr.filter(r => r.name?.trim());
};

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = () => reject(new Error('Failed to read file.'));
  reader.readAsText(file);
});

const YEAR_LABEL = { '1st':'1st Year','2nd':'2nd Year','3rd':'3rd Year','4th':'4th Year','ms':'MS' };

function ImportModal({ onClose, onImport }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(''); setPreview(null);
    try {
      const text = await readFile(file);
      const ext = file.name.split('.').pop().toLowerCase();
      let rows;
      if (ext === 'json') rows = parseJSON(text);
      else if (ext === 'tsv') rows = parseTSV(text);
      else rows = parseCSV(text);
      if (!rows.length) throw new Error('No valid records found. File must have a header row with a "name" column.');
      setPreview(rows);
    } catch (err) { setParseError(err.message); }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setImporting(true); setImportError('');
    const result = await onImport(preview);
    setImporting(false);
    if (!result.success) setImportError(result.error || 'Import failed.');
  };

  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal sm-modal--xl">
        <div className="sm-modal-header">
          <h2 className="sm-modal-title">Import Students</h2>
          <button className="sm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sm-modal-body">
          <div className="sm-import-hint">
            <p>Supported formats: <strong>CSV, TSV, JSON</strong>. First row must be a header.</p>
            <p>Columns: <code>{EXPECTED.join(', ')}</code></p>
            <p>Only <strong>name</strong> is required. All other columns are optional.</p>
          </div>
          <div className="sm-import-drop" onClick={() => inputRef.current?.click()}>
            <span className="sm-import-drop-icon">⬆</span>
            <span>Click to choose a file</span>
            <span className="sm-import-drop-sub">.csv  .tsv  .json</span>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.tsv,.json,.txt" style={{ display:'none' }} onChange={handleFile} />
          {parseError && <p className="sm-form-error">{parseError}</p>}
          {preview && (
            <div className="sm-import-preview">
              <p className="sm-import-count">{preview.length} record{preview.length !== 1 ? 's' : ''} ready to import</p>
              <div className="sm-table-wrap">
                <table className="sm-table">
                  <thead><tr>
                    <th>Reg No</th><th>Name</th><th>Roll</th><th>Session</th>
                    <th>Year</th><th>Hall</th><th>Email</th><th>Mobile</th>
                  </tr></thead>
                  <tbody>
                    {preview.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td>{r.registration_no || '—'}</td>
                        <td>{r.name}</td>
                        <td>{r.roll || '—'}</td>
                        <td>{r.session || '—'}</td>
                        <td>{YEAR_LABEL[r.academic_year] || r.academic_year || '1st Year'}</td>
                        <td>{r.hall || '—'}</td>
                        <td>{r.email || '—'}</td>
                        <td>{r.mobile || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && <p className="sm-import-more">… and {preview.length - 10} more</p>}
              </div>
            </div>
          )}
          {importError && <p className="sm-form-error">{importError}</p>}
        </div>
        <div className="sm-modal-footer">
          <button className="sm-btn sm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sm-btn sm-btn-primary" onClick={handleImport} disabled={!preview || importing}>
            {importing ? 'Importing…' : `Import ${preview ? preview.length : ''} Students`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
