import { useEffect, useState } from "react";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import TicketsPage from "./pages/TicketsPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NewTicketPage from "./pages/NewTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AiAssistantPage from "./pages/AiAssistantPage";
import ReportPage from "./pages/ReportPage";
import SettingsPage from "./pages/SettingsPage";
import AccountPage from "./pages/AccountPage";
import Sidebar from "./components/Sidebar";

function App() {
  const [mode, setMode] = useState("login");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetch("http://localhost:4000/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Session is no longer valid.");
        }

        return response.json();
      })
      .then((data) => {
        setLoggedInUser(data.data.user);
        setView("dashboard");
      })
      .catch(() => {
        localStorage.removeItem("token");
        setLoggedInUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLoginSuccess(user) {
    setLoggedInUser(user);
    setSelectedTicketId(null);
    setView("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setLoggedInUser(null);
    setSelectedTicketId(null);
    setMode("login");
    setView("dashboard");
  }

  function handleTicketCreated() {
    setView("tickets");
    setRefreshKey((currentKey) => currentKey + 1);
  }

  function handleSelectTicket(id) {
    setSelectedTicketId(id);
    setView("ticketDetail");
  }

  function handleNavigate(nextView) {
    if (!loggedInUser) return;

const allowedViews = {
  customer: [
    "dashboard",
    "tickets",
    "aiAssistant",
    "newTicket",
    "ticketDetail",
    "account",
  ],
  agent: ["dashboard", "tickets", "ticketDetail", "account"],
  admin: [
    "dashboard",
    "tickets",
    "ticketDetail",
    "manageUsers",
    "report",
    "settings",
    "account",
  ],
};

    const roleViews = allowedViews[loggedInUser.role] || [];
    setView(roleViews.includes(nextView) ? nextView : "dashboard");
  }

  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        Loading helpdesk…
      </div>
    );
  }

  if (!loggedInUser) {
    return mode === "login" ? (
      <LoginPage
        onSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setMode("register")}
      />
    ) : (
      <RegisterPage
        onSuccess={handleLoginSuccess}
        onSwitchToLogin={() => setMode("login")}
      />
    );
  }

  const isCustomer = loggedInUser.role === "customer";
  const isAgent = loggedInUser.role === "agent";
  const isAdmin = loggedInUser.role === "admin";

  let content;

  /* Customer pages */
  if (isCustomer) {
    if (view === "account") {
      content = <AccountPage user={loggedInUser} />;
    } else if (view === "aiAssistant") {
  content = (
    <AiAssistantPage
      onCreateTicket={() => handleNavigate("newTicket")}
    />
  );
    } else if (view === "newTicket") {
      content = (
        <NewTicketPage
          onCreated={handleTicketCreated}
          onCancel={() => handleNavigate("tickets")}
        />
      );
    } else if (view === "ticketDetail") {
      content = (
        <TicketDetailPage
          ticketId={selectedTicketId}
          user={loggedInUser}
          onBack={() => handleNavigate("tickets")}
        />
      );
    } else if (view === "tickets") {
      content = (
        <TicketsPage
          key={refreshKey}
          user={loggedInUser}
          onNewTicket={() => handleNavigate("newTicket")}
          onSelectTicket={handleSelectTicket}
          onAiAssistant={() => handleNavigate("aiAssistant")}
        />
      );
    } else {
      content = (
        <DashboardPage
          key={refreshKey}
          user={loggedInUser}
          onNewTicket={() => handleNavigate("newTicket")}
          onSelectTicket={handleSelectTicket}
          onAiAssistant={() => handleNavigate("aiAssistant")}
        />
      );
    }
  }

  /* Agent pages */
  if (isAgent) {
    if (view === "account") {
      content = <AccountPage user={loggedInUser} />; backend-harpreet
    } else if (view === 'aiAssistant') {
      content = (
        <AiAssistantPage
          user={loggedInUser}
          onCreateTicket={() =>
            handleNavigate('newTicket')
          }
        />
      );
    } else if (
      view === 'ticketDetail' &&
      selectedTicketId
    ) {

 main
      content = (
        <TicketDetailPage
          ticketId={selectedTicketId}
          user={loggedInUser}
          onBack={() => handleNavigate("tickets")}
        />
      );
    } else if (view === "tickets") {
      content = (
        <TicketsPage
          key={refreshKey}
          user={loggedInUser}
          onSelectTicket={handleSelectTicket}
        />
      );
    } else {
      content = (
        <AdminDashboardPage
          user={loggedInUser}
          onSelectTicket={handleSelectTicket}
        />
      );
    }
  }

  /* Administrator pages */
  if (isAdmin) {
    if (view === "account") {
      content = <AccountPage user={loggedInUser} />;

    } else if (view === 'aiAssistant') {
      content = (
        <AiAssistantPage
          user={loggedInUser}
          onCreateTicket={() =>
            handleNavigate('newTicket')
          }
        />
      );
    } else if (
      view === 'ticketDetail' &&
      selectedTicketId
    ) {
 main
      content = (
        <TicketDetailPage
          ticketId={selectedTicketId}
          user={loggedInUser}
          onBack={() => handleNavigate("tickets")}
        />
      );
    } else if (view === "manageUsers") {
      content = <AdminUsersPage onBack={() => handleNavigate("dashboard")} />;
    } else if (view === "report") {
      content = <ReportPage />;
    } else if (view === "settings") {
      content = <SettingsPage />;
    } else if (view === "tickets") {
      content = (
        <TicketsPage
          key={refreshKey}
          user={loggedInUser}
          onSelectTicket={handleSelectTicket}
          onManageUsers={() => handleNavigate("manageUsers")}
        />
      );
    } else {
      content = (
        <AdminDashboardPage
          user={loggedInUser}
          onSelectTicket={handleSelectTicket}
        />
      );
    }
  }

  const activeSidebarItem =
    view === "newTicket" || view === "ticketDetail" ? "tickets" : view;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        active={activeSidebarItem}
        user={loggedInUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <div style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>{content}</div>
    </div>
  );
}

export default App;
