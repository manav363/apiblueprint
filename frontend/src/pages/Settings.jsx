import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { API_BASE_URL, MOCK_BASE_URL, api } from '../services/api';

const COLORS = ['#00d4aa', '#60a5fa', '#f5c842', '#ff5c6a', '#c084fc', '#fb923c'];

function StatusCard({ label, status, detail }) {
  const healthy = status === 'ok';
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#a0a0a0', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color: healthy ? '#00d4aa' : '#ff5c6a', fontFamily: 'var(--mono)' }}>
          {status || 'unknown'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#606060', lineHeight: 1.6, fontFamily: 'var(--mono)' }}>{detail}</div>
    </div>
  );
}

export default function Settings() {
  const { activeProject, updateProject, deleteProject, createStarterProject, refreshProjects } = useApp();
  const [draft, setDraft] = useState({ name: '', version: '', description: '', color: '#00d4aa' });
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState({
    backend: { status: 'checking', detail: API_BASE_URL },
    mock: { status: 'checking', detail: MOCK_BASE_URL },
  });

  useEffect(() => {
    if (!activeProject) return;
    setDraft({
      name: activeProject.name,
      version: activeProject.version,
      description: activeProject.description || '',
      color: activeProject.color || '#00d4aa',
    });
  }, [activeProject]);

  async function checkHealth() {
    const [backend, mock] = await Promise.allSettled([
      api.getBackendHealth(),
      api.getMockHealth(),
    ]);

    setHealth({
      backend: backend.status === 'fulfilled'
        ? { status: backend.value.status, detail: `${backend.value.service} at ${API_BASE_URL}` }
        : { status: 'down', detail: backend.reason?.message || API_BASE_URL },
      mock: mock.status === 'fulfilled'
        ? { status: mock.value.status, detail: `${mock.value.service} at ${MOCK_BASE_URL}` }
        : { status: 'down', detail: mock.reason?.message || MOCK_BASE_URL },
    });
  }

  useEffect(() => {
    checkHealth();
  }, []);

  async function handleSave() {
    if (!activeProject || !draft.name.trim()) return;
    setSaving(true);
    await updateProject(activeProject.id, {
      name: draft.name.trim(),
      version: draft.version.trim() || 'v1.0.0',
      description: draft.description,
      color: draft.color,
    });
    setSaving(false);
  }

  async function handleDeleteProject() {
    if (!activeProject) return;
    if (!window.confirm(`Delete ${activeProject.name} and all of its endpoints, responses, parameters, and schemas?`)) return;
    await deleteProject(activeProject.id);
  }

  async function handleStarterProject() {
    await createStarterProject();
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar searchPlaceholder="Search projects..." />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 4 }}>Settings</h1>
              <p style={{ fontSize: 12, color: '#505050' }}>Project metadata, service health, and local operations.</p>
            </div>
            <button onClick={checkHealth} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '8px 14px', fontSize: 11, color: '#a0a0a0' }}>
              Refresh Health
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
            <StatusCard label="Backend API" status={health.backend.status} detail={health.backend.detail} />
            <StatusCard label="Mock Server" status={health.mock.status} detail={health.mock.detail} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}>
            <section style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 18 }}>
              <div style={{ fontSize: 13, color: '#d0d0d0', fontWeight: 600, marginBottom: 14 }}>Active Project</div>
              {!activeProject && (
                <div style={{ color: '#606060', fontSize: 12, lineHeight: 1.7 }}>
                  Select or create a project from the dashboard before editing project settings.
                </div>
              )}
              {activeProject && (
                <>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Project name" style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, padding: '9px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none' }} />
                    <input value={draft.version} onChange={event => setDraft(current => ({ ...current, version: event.target.value }))} placeholder="Version" style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, padding: '9px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none' }} />
                    <textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} rows={5} placeholder="Project description" style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, padding: '9px 12px', color: '#f0f0f0', fontSize: 12, outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {COLORS.map(color => (
                        <button key={color} onClick={() => setDraft(current => ({ ...current, color }))} title={color} style={{ width: 26, height: 26, borderRadius: 6, border: draft.color === color ? '2px solid #f0f0f0' : '1px solid #242424', background: color }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                    <button onClick={handleDeleteProject} style={{ background: 'transparent', border: '1px solid #3a1f24', borderRadius: 6, padding: '8px 14px', color: '#ff5c6a', fontSize: 12 }}>
                      Delete Project
                    </button>
                    <button onClick={handleSave} disabled={saving || !draft.name.trim()} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: saving || !draft.name.trim() ? 0.65 : 1 }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </>
              )}
            </section>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#a0a0a0', fontWeight: 600, marginBottom: 8 }}>Project Bootstrap</div>
                <div style={{ fontSize: 11, color: '#606060', lineHeight: 1.6, marginBottom: 12 }}>
                  Generate a ready-to-edit project with endpoints, sample responses, schemas, and a mock reload.
                </div>
                <button onClick={handleStarterProject} style={{ width: '100%', background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '8px', color: '#00d4aa', fontSize: 12 }}>
                  Create Starter Project
                </button>
              </div>

              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#a0a0a0', fontWeight: 600, marginBottom: 8 }}>Data Sync</div>
                <div style={{ fontSize: 11, color: '#606060', lineHeight: 1.6, marginBottom: 12 }}>
                  Pull the latest project list from the backend after external edits or seed scripts.
                </div>
                <button onClick={refreshProjects} style={{ width: '100%', background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '8px', color: '#a0a0a0', fontSize: 12 }}>
                  Refresh Projects
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
