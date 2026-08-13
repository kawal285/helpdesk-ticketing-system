import { useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewTicketPage from './pages/NewTicketPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';

function App() {
  const [mode, setMode] = useState('login');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'newTicket' | 'ticketDetail' | 'manageUsers'
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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