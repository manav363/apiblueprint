import { useNavigate, useLocation } from 'react-router-dom';
import { clearAuth, getStoredUsername } from '../services/api';
import { useApp } from '../context/AppContext';

export default function Topbar({ tabs, searchPlaceholder = 'Search resources...' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = getStoredUsername();
  const { searchQuery, setSearchQuery } = useApp();

  function handleLogout() {
    clearAuth();
    window.location.reload();
  }

  return (
    <header style={{
      height: 46, background: '#080808', borderBottom: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
      flexShrink: 0,
    }}>
      {tabs && tabs.map(tab => (
        <span key={tab.label} onClick={() => { setSearchQuery(''); navigate(tab.path); }}
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
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            background: 'transparent', border: 'none', color: '#a0a0a0',
            fontSize: 12, outline: 'none', width: '100%',
          }}
        />
        {searchQuery && (
          <span
            onClick={() => setSearchQuery('')}
            style={{ color: '#606060', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
          >×</span>
        )}
      </div>

      {/* Icons */}
      <span style={{ color: '#404040', fontSize: 16, cursor: 'pointer' }}>🔔</span>
      <span style={{ color: '#404040', fontSize: 16, cursor: 'pointer' }}>⚙</span>

      <span style={{ fontSize: 11, color: '#707070', fontFamily: 'var(--mono)' }}>{username || 'admin'}</span>
      <button
        onClick={handleLogout}
        style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '6px 10px', color: '#a0a0a0', fontSize: 11, cursor: 'pointer' }}
      >
        Log Out
      </button>
    </header>
  );
}
