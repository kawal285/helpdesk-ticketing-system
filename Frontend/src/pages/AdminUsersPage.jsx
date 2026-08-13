import { useState, useEffect } from 'react';

const ROLES = ['customer', 'agent', 'admin'];

export default function AdminUsersPage({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('agent');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  function authHeaders(extra = {}) {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:4000/users', { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load users');
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const response = await fetch('http://localhost:4000/users', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create user');
      setUsers((prev) => [data.user, ...prev]);
      setName('');
      setEmail('');
      setPassword('');
      setRole('agent');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    setError('');
    try {
      const response = await fetch(`http://localhost:4000/users/${userId}/role`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update role');
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeactivate(userId) {
    setError('');
    try {
      const response = await fetch(`http://localhost:4000/users/${userId}/deactivate`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not deactivate user');
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleActivate(userId) {
    setError('');
    try {
      const response = await fetch(`http://localhost:4000/users/${userId}/activate`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not activate user');
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
    } catch (err) {
      setError(err.message);
    }
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 4px 16px rgba(16, 20, 43, 0.25)',
    fontFamily: 'sans-serif',
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '6px 12px' }}>
        ← Back to My Tickets
      </button>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h1 style={{ marginTop: 0 }}>Create staff account</h1>
        {createError && <div className="error-text">{createError}</div>}
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="agent">agent</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={creating} style={{ width: 'auto' }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      </div>

      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Users</h1>
        {loading && <p>Loading…</p>}
        {error && <div className="error-text">{error}</div>}

        {!loading && !error && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e2d9' }}>
                <th style={{ padding: 10 }}>Name</th>
                <th style={{ padding: 10 }}>Email</th>
                <th style={{ padding: 10 }}>Role</th>
                <th style={{ padding: 10 }}>Status</th>
                <th style={{ padding: 10 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #e5e2d9' }}>
                  <td style={{ padding: 10 }}>{u.name}</td>
                  <td style={{ padding: 10 }}>{u.email}</td>
                  <td style={{ padding: 10 }}>
                    <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 10 }}>{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td style={{ padding: 10 }}>
                    {u.isActive ? (
                      <button type="button" onClick={() => handleDeactivate(u.id)} style={{ padding: '4px 10px' }}>
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleActivate(u.id)} style={{ padding: '4px 10px' }}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
