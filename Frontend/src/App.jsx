import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewTicketPage from './pages/NewTicketPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';

function App() {
  const [mode, setMode] = useState('login');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'newTicket' | 'ticketDetail' | 'manageUsers'
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-hydrate the session from a stored token on load, so a page refresh
  // doesn't silently log the user out even though their token is still valid.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetch('http://localhost:4000/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setLoggedInUser(data.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    setLoggedInUser(null);
    setMode('login');
  }

  function handleTicketCreated() {
    setView('dashboard');
    setRefreshKey((k) => k + 1);
  }

  function handleSelectTicket(id) {
    setSelectedTicketId(id);
    setView('ticketDetail');
  }

  if (checkingSession) {
    return null;
  }

  if (loggedInUser) {
    if (view === 'newTicket') {
      return (
        <NewTicketPage onCreated={handleTicketCreated} onCancel={() => setView('dashboard')} />
      );
    }
    if (view === 'ticketDetail') {
      return (
        <TicketDetailPage
          ticketId={selectedTicketId}
          user={loggedInUser}
          onBack={() => setView('dashboard')}
        />
      );
    }
    if (view === 'manageUsers') {
      return <AdminUsersPage onBack={() => setView('dashboard')} />;
    }
    return (
      <DashboardPage
        key={refreshKey}
        user={loggedInUser}
        onLogout={handleLogout}
        onNewTicket={() => setView('newTicket')}
        onSelectTicket={handleSelectTicket}
        onManageUsers={() => setView('manageUsers')}
      />
    );
  }

  return mode === 'login' ? (
    <LoginPage onSuccess={setLoggedInUser} onSwitchToRegister={() => setMode('register')} />
  ) : (
    <RegisterPage onSuccess={setLoggedInUser} onSwitchToLogin={() => setMode('login')} />
  );
}

export default App;