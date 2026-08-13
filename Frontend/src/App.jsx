import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import NewTicketPage from './pages/NewTicketPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ComingSoonPage from './pages/ComingSoonPage';
import Sidebar from './components/Sidebar';

function App() {
  const [mode, setMode] = useState('login');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  // 'dashboard' | 'tickets' | 'newTicket' | 'ticketDetail' | 'manageUsers' | 'report' | 'settings'
  const [view, setView] = useState('dashboard');
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
    const isStaff = loggedInUser.role === 'agent' || loggedInUser.role === 'admin';

    // Customer experience is untouched: no sidebar, same pages as before.
    if (!isStaff) {
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
      return (
        <DashboardPage
          key={refreshKey}
          user={loggedInUser}
          onLogout={handleLogout}
          onNewTicket={() => setView('newTicket')}
          onSelectTicket={handleSelectTicket}
        />
      );
    }

    let content;
    if (view === 'newTicket') {
      content = <NewTicketPage onCreated={handleTicketCreated} onCancel={() => setView('dashboard')} />;
    } else if (view === 'ticketDetail') {
      content = (
        <TicketDetailPage
          ticketId={selectedTicketId}
          user={loggedInUser}
          onBack={() => setView('tickets')}
        />
      );
    } else if (view === 'manageUsers' && loggedInUser.role === 'admin') {
      content = <AdminUsersPage onBack={() => setView('dashboard')} />;
    } else if (view === 'report') {
      content = <ComingSoonPage title="Report" />;
    } else if (view === 'settings') {
      content = <ComingSoonPage title="Settings" />;
    } else if (view === 'tickets') {
      content = (
        <DashboardPage
          key={refreshKey}
          user={loggedInUser}
          onLogout={handleLogout}
          onNewTicket={() => setView('newTicket')}
          onSelectTicket={handleSelectTicket}
          onManageUsers={() => setView('manageUsers')}
        />
      );
    } else {
      content = <AdminDashboardPage user={loggedInUser} onSelectTicket={handleSelectTicket} />;
    }

    return (
      <div style={{ display: 'flex' }}>
        <Sidebar
          active={view === 'newTicket' || view === 'ticketDetail' ? 'tickets' : view}
          user={loggedInUser}
          onNavigate={setView}
          onLogout={handleLogout}
        />
        <div style={{ flex: 1 }}>{content}</div>
      </div>
    );
  }

  return mode === 'login' ? (
    <LoginPage onSuccess={setLoggedInUser} onSwitchToRegister={() => setMode('register')} />
  ) : (
    <RegisterPage onSuccess={setLoggedInUser} onSwitchToLogin={() => setMode('login')} />
  );
}

export default App;