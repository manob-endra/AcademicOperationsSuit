import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { notificationSystemAPI } from '../services/notificationSystemAPI';

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
  },
  card: {
    background: 'white',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,.12)',
    padding: '48px 40px',
    textAlign: 'center',
    maxWidth: 440,
    width: '100%',
  },
  icon:  { fontSize: 52, marginBottom: 16 },
  h2:    { color: '#1a3a52', margin: '0 0 10px', fontSize: 22, fontWeight: 700 },
  p:     { color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: '0 0 24px' },
  email: { color: '#1a3a52', fontWeight: 700 },
  link:  { color: '#2c5f8a', textDecoration: 'none', fontWeight: 600, fontSize: 13 },
};

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState('loading'); // loading | success | error | noToken
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) { setState('noToken'); return; }
    notificationSystemAPI.unsubscribeByToken(token).then(r => {
      if (r.success) {
        setEmail(r.email || '');
        setState('success');
      } else {
        setState('error');
      }
    }).catch(() => setState('error'));
  }, [token]);

  const render = () => {
    if (state === 'loading') return (
      <>
        <div style={S.icon}>⏳</div>
        <h2 style={S.h2}>Processing…</h2>
        <p style={S.p}>Please wait while we process your request.</p>
      </>
    );

    if (state === 'success') return (
      <>
        <div style={S.icon}>✅</div>
        <h2 style={S.h2}>Unsubscribed</h2>
        <p style={S.p}>
          {email
            ? <><span style={S.email}>{email}</span> has been removed from</>
            : 'You have been removed from'}{' '}
          our routine notification emails.
          <br /><br />
          If this was a mistake, please contact your department administrator.
        </p>
        <Link to="/login" style={S.link}>← Back to login</Link>
      </>
    );

    if (state === 'error') return (
      <>
        <div style={S.icon}>❌</div>
        <h2 style={S.h2}>Invalid Link</h2>
        <p style={S.p}>
          This unsubscribe link is invalid or has already been used.
          <br />
          Please contact your administrator if you need help.
        </p>
        <Link to="/login" style={S.link}>← Back to login</Link>
      </>
    );

    return (
      <>
        <div style={S.icon}>🔗</div>
        <h2 style={S.h2}>No Token Provided</h2>
        <p style={S.p}>Please use the unsubscribe link from your email.</p>
        <Link to="/login" style={S.link}>← Back to login</Link>
      </>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ marginBottom: 6, fontSize: 13, color: '#9ca3af' }}>
          Academic Operation Suite — CSE, University of Dhaka
        </div>
        {render()}
      </div>
    </div>
  );
}
