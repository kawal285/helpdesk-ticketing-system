import { useState } from 'react';
import opLogo from '../assets/op-logo.png';
import futureSkillsLogo from '../assets/future-skills-logo.png';

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path
        d="M3 6l9 7 9-7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path
        d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({ open }) {
  if (!open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path
        d="M10.6 5.2A9.8 9.8 0 0 1 12 5c5.5 0 9 7 9 7a15.6 15.6 0 0 1-3.2 3.9M6.3 6.4C4 8.1 3 12 3 12s3.5 7 9 7a8.9 8.9 0 0 0 3.4-.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 10a3 3 0 0 0 4.2 4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage({
  onSuccess,
  onSwitchToRegister,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        'http://localhost:4000/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('token', data.token);
      onSuccess(data.data.user);
    } catch (loginError) {
      if (loginError.message === 'Failed to fetch') {
        setError(
          'Could not connect to the helpdesk server. Confirm that the backend is running on port 4000.'
        );
      } else {
        setError(loginError.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-institution-logos">
          <span className="auth-aic-wordmark">AIC</span>

          <div className="auth-logo-divider" />

          <img
            src={opLogo}
            alt="Otago Polytechnic"
            className="auth-op-logo"
          />

          <div className="auth-logo-divider" />

          <img
            src={futureSkillsLogo}
            alt="Future Skills"
            className="auth-future-skills-logo"
          />
        </div>

        <div className="auth-brand">
          <h2>IT Helpdesk</h2>
          <p className="auth-brand-sub">
            Support and Ticketing Portal
          </p>
        </div>

        <h1>Welcome back</h1>

        <p>
          Sign in to create, manage and track your support tickets.
        </p>

        {error && (
          <div className="error-text" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>

            <div className="input-icon-wrap">
              <span className="input-icon">
                <MailIcon />
              </span>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
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
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />

              <button
                type="button"
                className="input-icon-btn"
                onClick={() =>
                  setShowPassword(
                    (currentValue) => !currentValue
                  )
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="auth-register-text">
          Don&apos;t have an account?{' '}

          <button
            type="button"
            className="auth-link-button"
            onClick={onSwitchToRegister}
          >
            Create an account
          </button>
        </p>

        <p className="auth-help-text">
          Only administrators can create staff and agent accounts.
          Public registration creates a customer account.
        </p>
      </section>
    </main>
  );
}