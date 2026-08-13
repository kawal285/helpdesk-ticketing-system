import { useState } from 'react';

function HeadsetIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" strokeLinecap="round" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
      <path d="M20 19v1a3 3 0 0 1-3 3h-3" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M3 6l9 7 9-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ open }) {
  if (!open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c5.5 0 9 7 9 7a15.6 15.6 0 0 1-3.2 3.9M6.3 6.4C4 8.1 3 12 3 12s3.5 7 9 7a8.9 8.9 0 0 0 3.4-.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.36 0-4.36-1.59-5.07-3.73H.9v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.93 10.69A5.4 5.4 0 0 1 3.65 9c0-.59.1-1.16.28-1.69V4.98H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.02l3.03-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.98l3.03 2.33C4.64 5.17 6.64 3.58 9 3.58Z" />
    </svg>
  );
}

export default function LoginPage({ onSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      onSuccess(data.data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setNotice('Password reset isn’t set up yet — contact your administrator.');
  }

  function handleGoogleLogin() {
    setError('');
    setNotice('Google sign-in isn’t set up yet.');
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <HeadsetIcon />
        </div>
        <div className="auth-brand">
          <h2>Help Desk</h2>
          <p className="auth-brand-sub">Ticketing System</p>
        </div>

        <h1>Welcome back!</h1>
        <p>Please sign in to your account</p>

        {error && <div className="error-text">{error}</div>}
        {notice && <div className="notice-text">{notice}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <div className="input-icon-wrap">
              <span className="input-icon">
                <MailIcon />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-icon-wrap">
              <span className="input-icon">
                <LockIcon />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <div className="auth-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <a href="#" onClick={handleForgotPassword}>
              Forgot password?
            </a>
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button type="button" className="btn-google" onClick={handleGoogleLogin}>
          <GoogleIcon />
          Log in with Google
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20 }}>
          No account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}>
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
