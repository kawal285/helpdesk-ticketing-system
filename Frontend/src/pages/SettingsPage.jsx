import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:4000';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}`, ...extra };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/settings`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load settings.');
      setSettings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    setVerifying(true);
    setVerifyError('');
    setVerifyResult(null);
    try {
      const response = await fetch(`${API_URL}/settings/verify-email`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not verify email connection.');
      setVerifyResult(data);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 22,
    boxShadow: '0 4px 14px rgba(0, 45, 85, 0.09)',
    border: '1px solid #e2e8ee',
  };

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        <p>Loading settings…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        width: '100%',
        minHeight: '100vh',
        padding: '40px',
        background: '#f1f4f7',
        fontFamily: 'sans-serif',
        color: '#121826',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div
          style={{
            marginBottom: 28,
            borderLeft: '7px solid #f37021',
            paddingLeft: 20,
          }}
        >
          <h1 style={{ margin: 0, color: '#005a9c', fontSize: 42 }}>Settings</h1>
          <p style={{ margin: '8px 0 0', color: '#5f6878', fontSize: 17 }}>
            Current system configuration.
          </p>
        </div>

        {error && (
          <div className="error-text" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {settings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section style={cardStyle}>
              <h2 style={{ color: '#005a9c', marginTop: 0 }}>Email notifications</h2>

              <p style={{ margin: '0 0 16px', color: '#5f6878' }}>
                {settings.email.configured
                  ? 'SMTP credentials are configured. Notification emails will attempt to send.'
                  : 'SMTP is not configured. Notification emails will be skipped rather than fail.'}
              </p>

              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto' }}
                disabled={verifying}
                onClick={handleVerifyEmail}
              >
                {verifying ? 'Checking…' : 'Verify email connection'}
              </button>

              {verifyError && (
                <div className="error-text" style={{ marginTop: 12 }}>
                  {verifyError}
                </div>
              )}

              {verifyResult && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 6,
                    background: verifyResult.verified ? '#eaf6ea' : '#fdf1e8',
                    color: verifyResult.verified ? '#1e6b1e' : '#7a3a00',
                  }}
                >
                  {verifyResult.message}
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <h2 style={{ color: '#005a9c', marginTop: 0 }}>Knowledge base</h2>
              <p style={{ margin: 0, color: '#5f6878' }}>
                Active provider: <strong>{settings.knowledgeBase.provider}</strong>
              </p>
            </section>

            <section style={cardStyle}>
              <h2 style={{ color: '#005a9c', marginTop: 0 }}>SLA response times</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #d8dde3' }}>
                    <th style={{ padding: 8 }}>Priority</th>
                    <th style={{ padding: 8 }}>Target response</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.tickets.priorities.map((priority) => (
                    <tr key={priority} style={{ borderBottom: '1px solid #e2e6ea' }}>
                      <td style={{ padding: 8 }}>
                        {priority}
                        {priority === settings.tickets.defaultPriority && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: '#5f6878' }}>
                            (default)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>{settings.sla[priority]} hours</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={cardStyle}>
              <h2 style={{ color: '#005a9c', marginTop: 0 }}>Ticket rules</h2>

              <p style={{ margin: '0 0 6px', color: '#5f6878' }}>
                <strong>Statuses:</strong> {settings.tickets.statuses.join(' → ')}
              </p>

              <p style={{ margin: '0 0 6px', color: '#5f6878' }}>
                <strong>Categories:</strong> {settings.tickets.categories.join(', ')}
              </p>

              <p style={{ margin: 0, color: '#5f6878' }}>
                <strong>Organizations:</strong> {settings.organizations.join(', ')}
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
