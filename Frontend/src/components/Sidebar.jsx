const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'manageUsers', label: 'Users', adminOnly: true },
  { key: 'report', label: 'Report' },
  { key: 'settings', label: 'Settings' },
];

export default function Sidebar({ active, user, onNavigate, onLogout }) {
  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #e5e2d9',
        minHeight: '100vh',
        padding: '20px 0',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ padding: '0 20px 20px', fontWeight: 700, fontSize: 16 }}>Help Desk</div>

      <nav>
        {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 20px',
              border: 'none',
              background: active === item.key ? '#eeeefd' : 'transparent',
              color: active === item.key ? '#5b5fef' : '#1b1e2b',
              fontWeight: active === item.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 30, padding: '0 20px' }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: '1px solid #e5e2d9',
            borderRadius: 4,
            background: '#ffffff',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
