import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const NAV = [
  { label: 'Dashboard',      icon: '⊞', path: '/' },
  { label: 'Endpoints',      icon: '⇌', path: '/editor' },
  { label: 'API Tester',     icon: '▶', path: '/tester' },
  { label: 'Schema Builder', icon: '⬡', path: '/schema' },
  { label: 'Monitoring',     icon: '◎', path: '/monitoring' },
  { label: 'Documentation',  icon: '≡', path: '/docs' },
  { label: 'Settings',       icon: '⚙', path: '/settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProject } = useApp();

  return (
    <aside style={{
      width: 200, background: '#080808', borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}>
          API<span style={{ color: '#00d4aa' }}>Blueprint</span>
        </div>
        <div style={{ fontSize: 10, color: '#505050', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Developer Console</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {NAV.map(item => {
          const active = item.path === '/' ? location.pathname === '/' : location.pathname === item.path;
          return (
            <div key={item.label} onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                marginBottom: 2,
                background: active ? 'rgba(0,212,170,0.08)' : 'transparent',
                borderLeft: active ? '2px solid #00d4aa' : '2px solid transparent',
                color: active ? '#00d4aa' : '#707070',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#b0b0b0'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#707070'; }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: active ? 500 : 400 }}>{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid #1a1a1a' }}>
        {activeProject && (
          <div style={{ padding: '0 10px 10px' }}>
            <div style={{ fontSize: 10, color: '#404040', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Active Project</div>
            <div style={{ fontSize: 12, color: '#d0d0d0', fontWeight: 500 }}>{activeProject.name}</div>
            <div style={{ fontSize: 10, color: '#505050', marginTop: 2 }}>{activeProject.endpoint_count} endpoints</div>
          </div>
        )}
        {['Support'].map(label => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', color: '#505050', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = '#909090'}
            onMouseLeave={e => e.currentTarget.style.color = '#505050'}
          >
            <span style={{ fontSize: 12 }}>?</span>
            <span style={{ fontSize: 12 }}>{label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
