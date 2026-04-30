import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function ProjectCard({ project, onDelete, onOpen }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0d0d0d', border: `1px solid ${hovered ? '#2e2e2e' : '#1a1a1a'}`,
        borderRadius: 10, overflow: 'hidden', transition: 'all 0.2s',
        boxShadow: hovered ? '0 4px 24px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        borderLeft: `3px solid ${project.color}`,
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}>
      <div style={{ padding: '16px 18px', flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${project.color}18`, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {project.name.includes('Auth') ? '🔐' : project.name.includes('Inventory') ? '📦' : project.name.includes('Pay') ? '💳' : '🛡️'}
          </div>
          <span style={{
            background: 'rgba(0,212,170,0.1)', color: '#00d4aa',
            fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
            padding: '3px 8px', borderRadius: 20,
          }}>{project.endpoint_count} ENDPOINTS</span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#f0f0f0' }}>{project.name}</div>
        <div style={{ fontSize: 11, color: '#606060', lineHeight: 1.6, marginBottom: 14 }}>
          {(project.description || 'No description yet.').slice(0, 100)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#404040' }}>Version {project.version}</span>
          <span style={{ fontSize: 10, color: '#404040' }}>Updated {formatDate(project.updated_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 18px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
        <button onClick={() => onOpen(project)} style={{
          flex: 1, background: 'transparent', border: '1px solid #242424',
          borderRadius: 6, padding: '7px 0', fontSize: 12, color: '#a0a0a0',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = '#00d4aa'; e.target.style.color = '#00d4aa'; }}
          onMouseLeave={e => { e.target.style.borderColor = '#242424'; e.target.style.color = '#a0a0a0'; }}
        >Open</button>
        <button onClick={() => onDelete(project.id)} style={{
          width: 32, background: 'transparent', border: '1px solid #242424',
          borderRadius: 6, fontSize: 13, color: '#404040', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = '#ff5c6a'; e.target.style.color = '#ff5c6a'; }}
          onMouseLeave={e => { e.target.style.borderColor = '#242424'; e.target.style.color = '#404040'; }}
        >🗑</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { projects, activeProject, addProject, deleteProject, setActiveProject, loading, error, searchQuery } = useApp();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const query = searchQuery.toLowerCase();
  const filteredProjects = query
    ? projects.filter(p => p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query))
    : projects;

  const handleNew = () => {
    if (!newName.trim()) return;
    addProject(newName.trim());
    setNewName('');
    setShowNew(false);
  };

  const handleOpen = (project) => {
    setActiveProject(project);
    navigate('/editor');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar searchPlaceholder="Search projects..." />
        <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', marginBottom: 5 }}>Project Workspace</h1>
              <p style={{ color: '#606060', fontSize: 12 }}>Manage your API architectures and deployment pipelines.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {showNew && (
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNew()}
                  placeholder="Project name..." autoFocus
                  style={{
                    background: '#111', border: '1px solid #00d4aa',
                    borderRadius: 6, padding: '7px 12px', color: '#f0f0f0',
                    fontSize: 12, outline: 'none', width: 200,
                  }} />
              )}
              <button onClick={() => showNew ? handleNew() : setShowNew(true)} style={{
                background: '#00d4aa', color: '#000', border: 'none',
                borderRadius: 7, padding: '9px 18px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span style={{ fontSize: 16 }}>+</span> {showNew ? 'Create' : 'New Project'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Total Projects', value: filteredProjects.length },
                { label: 'Total Endpoints', value: filteredProjects.reduce((a, p) => a + p.endpoint_count, 0) },
                { label: 'Selected Project', value: activeProject?.name || 'None' },
              ].map(stat => (
              <div key={stat.label} style={{
                background: '#0d0d0d', border: '1px solid #1a1a1a',
                borderRadius: 8, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', fontFamily: 'var(--mono)' }}>{stat.value}</span>
                <span style={{ fontSize: 11, color: '#505050' }}>{stat.label}</span>
              </div>
            ))}
          </div>

          {loading && <div style={{ color: '#606060', fontSize: 12 }}>Loading projects...</div>}
          {error && <div style={{ color: '#ff5c6a', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {!loading && projects.length === 0 && (
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: 24, color: '#707070' }}>
              No projects yet. Create one to start designing endpoints and generating a live spec.
            </div>
          )}
          {filteredProjects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredProjects.map(p => (
                <ProjectCard key={p.id} project={p} onDelete={deleteProject} onOpen={handleOpen} />
              ))}
            </div>
          )}
          {!loading && filteredProjects.length === 0 && projects.length > 0 && (
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: 24, color: '#707070' }}>
              No projects match &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
