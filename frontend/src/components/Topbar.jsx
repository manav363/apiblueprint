import { useNavigate, useLocation } from 'react-router-dom';

export default function Topbar({ tabs }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header style={{
      height: 46, background: '#080808', borderBottom: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
      flexShrink: 0,
    }}>
      {tabs && tabs.map(tab => (
        <span key={tab.label} onClick={() => navigate(tab.path)}
          style={{
            fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 2px',
            color: location.pathname === tab.path ? '#00d4aa' : '#606060',
            borderBottom: location.pathname === tab.path ? '1px solid #00d4aa' : '1px solid transparent',
            paddingBottom: 2, transition: 'color 0.15s',
          }}
          onMouseEnter={e => { if (location.pathname !== tab.path) e.currentTarget.style.color = '#a0a0a0'; }}
          onMouseLeave={e => { if (location.pathname !== tab.path) e.currentTarget.style.color = '#606060'; }}
        >{tab.label}</span>
      ))}

      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{
        background: '#111', border: '1px solid #242424', borderRadius: 6,
        padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8, width: 200,
      }}>
        <span style={{ color: '#404040', fontSize: 12 }}>⌕</span>
        <input placeholder="Search resources..." style={{
          background: 'transparent', border: 'none', color: '#a0a0a0',
          fontSize: 12, outline: 'none', width: '100%',
        }} />
      </div>

      {/* Icons */}
      <span style={{ color: '#404040', fontSize: 16, cursor: 'pointer' }}>🔔</span>
      <span style={{ color: '#404040', fontSize: 16, cursor: 'pointer' }}>⚙</span>

      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00d4aa, #0099ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600, color: '#000', cursor: 'pointer',
      }}>M</div>
    </header>
  );
}
