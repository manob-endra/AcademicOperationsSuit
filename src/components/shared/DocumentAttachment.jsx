import { useState } from 'react';
import '../../styles/DocumentAttachment.css';

// Human-readable file size
function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const isPdf = (name = '', url = '') =>
  /\.pdf(\?|$)/i.test(name) || /\.pdf(\?|$)/i.test(url);

const isImage = (name = '', url = '') =>
  /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(name) || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);

/**
 * Attachment shown on a notice. A compact chip that opens an in-page viewer
 * (PDFs and images render inline; other types offer download). Always keeps a
 * download button.
 */
function DocumentAttachment({ url, name, size }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  const label = name || 'Attachment';
  const pdf = isPdf(name, url);
  const image = isImage(name, url);
  const viewable = pdf || image;

  // Force the browser's download rather than navigating away.
  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = label;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      // Fallback: open in a new tab if the fetch/CORS download fails
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <div className="doc-attach">
      <button
        type="button"
        className="doc-attach-chip"
        onClick={() => (viewable ? setOpen(true) : window.open(url, '_blank', 'noopener'))}
        title={viewable ? 'Click to view' : 'Open document'}
      >
        <span className="doc-attach-icon">{pdf ? '📄' : image ? '🖼️' : '📎'}</span>
        <span className="doc-attach-name">{label}</span>
        {size != null && <span className="doc-attach-size">{formatSize(size)}</span>}
      </button>
      <button type="button" className="doc-attach-download" onClick={handleDownload} title="Download">
        ⬇ Download
      </button>

      {open && viewable && (
        <div className="doc-viewer-overlay" onClick={() => setOpen(false)}>
          <div className="doc-viewer" onClick={e => e.stopPropagation()}>
            <div className="doc-viewer-head">
              <span className="doc-viewer-title">{label}</span>
              <div className="doc-viewer-actions">
                <button className="doc-viewer-btn" onClick={handleDownload}>⬇ Download</button>
                <a className="doc-viewer-btn" href={url} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
                <button className="doc-viewer-btn doc-viewer-close" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>
            <div className="doc-viewer-body">
              {pdf ? (
                <iframe src={url} title={label} className="doc-viewer-frame" />
              ) : (
                <img src={url} alt={label} className="doc-viewer-image" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentAttachment;
