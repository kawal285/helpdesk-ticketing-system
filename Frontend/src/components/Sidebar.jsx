import aicDualPartnerLockup from '../assets/aic-dual-partner-lockup.png';
const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    roles: ['customer', 'agent', 'admin'],
  },
  {
    key: 'tickets',
    label: 'Tickets',
    roles: ['customer', 'agent', 'admin'],
  },
  {
    key: 'aiAssistant',
    label: 'AI Assistant',
    roles: ['customer', 'agent', 'admin'],
  },
  {
    key: 'manageUsers',
    label: 'Users',
    roles: ['admin'],
  },
  {
    key: 'report',
    label: 'Report',
    roles: ['admin'],
  },
  {
    key: 'knowledgeGaps',
    label: 'Knowledge Gaps',
    roles: ['admin'],
  },
  {
    key: 'settings',
    label: 'Settings',
    roles: ['admin'],
  },
  {
    key: 'account',
    label: 'My Account',
    roles: ['customer', 'agent', 'admin'],
  },
];
export default function Sidebar({
  active,
  user,
  onNavigate,
  onLogout,
}) {
  const visibleItems = NAV_ITEMS.filter((item) =>
  item.roles.includes(user.role)
);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="institution-logos">
          <img
            src={aicDualPartnerLockup}
            alt="Auckland International Campus | Otago Polytechnic | Future Skills"
            className="aic-dual-lockup"
          />
        </div>

        <div className="helpdesk-title">
          <strong>IT Helpdesk</strong>
          <span>Support Portal</span>
        </div>
      </div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        {visibleItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-nav-button ${
              active === item.key ? 'active' : ''
            }`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <strong>{user.name}</strong>
          <span>{user.role}</span>
        </div>

        <button
          type="button"
          className="sidebar-logout"
          onClick={onLogout}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}