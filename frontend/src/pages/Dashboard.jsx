import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function ProjectCard({ project, onDelete, onEdit, onOpen }) {
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
        <button onClick={() => onEdit(project)} style={{
          width: 46, background: 'transparent', border: '1px solid #242424',
          borderRadius: 6, fontSize: 12, color: '#606060', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = '#60a5fa'; e.target.style.color = '#60a5fa'; }}
          onMouseLeave={e => { e.target.style.borderColor = '#242424'; e.target.style.color = '#606060'; }}
        >Edit</button>
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
  const {
    projects,
    activeProject,
    addProject,
    createStarterProject,
    deleteProject,
    updateProject,
    setActiveProject,
    loading,
    error,
    searchQuery,
  } = useApp();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [draft, setDraft] = useState({ name: '', version: '', description: '', color: '#00d4aa' });

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

  const handleDelete = (projectId) => {
    const project = projects.find(item => item.id === projectId);
    if (!window.confirm(`Delete ${project?.name || 'this project'} and all of its endpoints and schemas?`)) return;
    deleteProject(projectId);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setDraft({
      name: project.name,
      version: project.version,
      description: project.description || '',
      color: project.color || '#00d4aa',
    });
  };

  async function handleSaveProject() {
    if (!editingProject || !draft.name.trim()) return;
    await updateProject(editingProject.id, {
      name: draft.name.trim(),
      version: draft.version.trim() || 'v1.0.0',
      description: draft.description,
      color: draft.color || '#00d4aa',
    });
    setEditingProject(null);
  }

  async function handleStarterProject() {
    const project = await createStarterProject();
    if (project) navigate('/editor');
  }

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
              <button onClick={handleStarterProject} style={{
                background: 'transparent', color: '#a0a0a0', border: '1px solid #242424',
                borderRadius: 7, padding: '9px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>
                Starter Project
              </button>
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
              <div style={{ fontSize: 14, color: '#d0d0d0', marginBottom: 8 }}>No projects yet.</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>Create a blank project or generate a starter project with example endpoints, responses, schema fields, and mock routes.</div>
              <button onClick={handleStarterProject} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 7, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Create Starter Project
              </button>
            </div>
          )}
          {filteredProjects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredProjects.map(p => (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete} onEdit={handleEdit} onOpen={handleOpen} />
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

      {editingProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 460, background: '#0d0d0d', border: '1px solid #242424', borderRadius: 10, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Project Settings</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Project name" style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, padding: '9px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none' }} />
              <input value={draft.version} onChange={event => setDraft(current => ({ ...current, version: event.target.value }))} placeholder="Version" style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, padding: '9px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none' }} />
              <textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} rows={4} placeholder="Project description" style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, padding: '9px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={draft.color} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} style={{ width: 38, height: 34, background: '#111', border: '1px solid #242424', borderRadius: 6 }} />
                <span style={{ fontSize: 11, color: '#606060', fontFamily: 'var(--mono)' }}>{draft.color}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setEditingProject(null)} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '8px 14px', color: '#a0a0a0', fontSize: 12 }}>Cancel</button>
              <button onClick={handleSaveProject} disabled={!draft.name.trim()} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: draft.name.trim() ? 1 : 0.6 }}>Save Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
