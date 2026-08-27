import { useState } from 'react';

const API_URL = 'http://localhost:4000';

export default function AccountPage({ user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not change password.');

      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 22,
    boxShadow: '0 4px 14px rgba(0, 45, 85, 0.09)',
    border: '1px solid #e2e8ee',
  };

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
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ marginBottom: 28, borderLeft: '7px solid #f37021', paddingLeft: 20 }}>
          <h1 style={{ margin: 0, color: '#005a9c', fontSize: 42 }}>My Account</h1>
          <p style={{ margin: '8px 0 0', color: '#5f6878', fontSize: 17 }}>
            {user.name} · {user.email}
          </p>
        </div>

        <section style={cardStyle}>
          <h2 style={{ color: '#005a9c', marginTop: 0 }}>Change password</h2>

          {error && (
            <div className="error-text" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 6,
                background: '#eaf6ea',
                color: '#1e6b1e',
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={saving} style={{ width: 'auto' }}>
              {saving ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
