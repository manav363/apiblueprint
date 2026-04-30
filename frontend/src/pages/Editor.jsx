import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const TABS = ['Definition', 'Parameters', 'Responses'];

function EndpointList({ endpoints, activeEndpoint, onSelect, onAdd }) {
  const groups = [...new Set(endpoints.map(endpoint => endpoint.group_name || 'Default'))];

  return (
    <div style={{
      width: 240, background: '#080808', borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Resources</span>
        <button onClick={onAdd} style={{
          background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)',
          color: '#00d4aa', borderRadius: 4, width: 24, height: 24,
          fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
        {endpoints.length === 0 && (
          <div style={{ padding: 12, color: '#606060', fontSize: 12 }}>
            No endpoints yet. Add one to start building your API surface.
          </div>
        )}

        {groups.map(group => (
          <div key={group}>
            <div style={{ fontSize: 9, color: '#404040', padding: '8px 8px 4px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              {group}
            </div>
            {endpoints
              .filter(endpoint => (endpoint.group_name || 'Default') === group)
              .map(endpoint => (
                <div
                  key={endpoint.id}
                  onClick={() => onSelect(endpoint)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: activeEndpoint?.id === endpoint.id ? '#111' : 'transparent',
                    borderLeft: activeEndpoint?.id === endpoint.id ? '2px solid #00d4aa' : '2px solid transparent',
                  }}
                >
                  <span className={`method-badge ${endpoint.method}`}>{endpoint.method}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#b0b0b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {endpoint.path}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DefinitionTab({ endpoint, onSave }) {
  const [draft, setDraft] = useState({
    method: 'GET',
    path: '',
    group_name: 'Default',
    summary: '',
    operation_id: '',
    tag: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!endpoint) return;
    setDraft({
      method: endpoint.method || 'GET',
      path: endpoint.path || '',
      group_name: endpoint.group_name || 'Default',
      summary: endpoint.summary || '',
      operation_id: endpoint.operation_id || '',
      tag: endpoint.tag || '',
      description: endpoint.description || '',
    });
  }, [endpoint]);

  if (!endpoint) {
    return <div style={{ color: '#606060', fontSize: 13 }}>Select an endpoint to edit its definition.</div>;
  }

  const inputStyle = {
    width: '100%', background: '#111', border: '1px solid #242424',
    borderRadius: 6, padding: '8px 12px', color: '#f0f0f0', fontSize: 12,
    outline: 'none',
  };

  async function handleSave() {
    setSaving(true);
    await onSave(endpoint.id, draft);
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8 }}>
        <select value={draft.method} onChange={event => setDraft(current => ({ ...current, method: event.target.value }))}
          style={{ ...inputStyle, fontFamily: 'var(--mono)', color: '#00d4aa' }}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => <option key={method}>{method}</option>)}
        </select>
        <input
          value={draft.path}
          onChange={event => setDraft(current => ({ ...current, path: event.target.value }))}
          placeholder="/users/{id}"
          style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input
          value={draft.group_name}
          onChange={event => setDraft(current => ({ ...current, group_name: event.target.value }))}
          placeholder="Group"
          style={inputStyle}
        />
        <input
          value={draft.tag}
          onChange={event => setDraft(current => ({ ...current, tag: event.target.value }))}
          placeholder="Tag"
          style={inputStyle}
        />
      </div>

      <input
        value={draft.operation_id}
        onChange={event => setDraft(current => ({ ...current, operation_id: event.target.value }))}
        placeholder="operation_id"
        style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
      />

      <input
        value={draft.summary}
        onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))}
        placeholder="Short summary"
        style={inputStyle}
      />

      <textarea
        value={draft.description}
        onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
        rows={5}
        placeholder="Describe what this endpoint does"
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6,
            padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function ParameterRow({ endpointId, parameter, onSave, onDelete }) {
  const [draft, setDraft] = useState(parameter);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(parameter);
  }, [parameter]);

  async function handleSave() {
    setSaving(true);
    await onSave(parameter.id, endpointId, {
      name: draft.name,
      location: draft.location,
      type: draft.type,
      required: draft.required,
      description: draft.description,
    });
    setSaving(false);
  }

  return (
    <tr style={{ borderBottom: '1px solid #141414' }}>
      <td style={{ padding: '6px 8px' }}>
        <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 4, padding: '4px 8px', color: '#d0d0d0', fontSize: 11, fontFamily: 'var(--mono)', width: '100%' }} />
      </td>
      <td style={{ padding: '6px 8px' }}>
        <select value={draft.location} onChange={event => setDraft(current => ({ ...current, location: event.target.value }))}
          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 4, padding: '4px 8px', color: '#d0d0d0', fontSize: 11, width: '100%' }}>
          {['path', 'query', 'header'].map(location => <option key={location}>{location}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 8px' }}>
        <select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value }))}
          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 4, padding: '4px 8px', color: '#d0d0d0', fontSize: 11, width: '100%' }}>
          {['string', 'integer', 'boolean', 'number', 'array', 'UUID', 'TIMESTAMP', 'URL'].map(type => <option key={type}>{type}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <input type="checkbox" checked={draft.required} onChange={event => setDraft(current => ({ ...current, required: event.target.checked }))} />
      </td>
      <td style={{ padding: '6px 8px' }}>
        <input value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 4, padding: '4px 8px', color: '#d0d0d0', fontSize: 11, width: '100%' }} />
      </td>
      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
        <button onClick={handleSave} disabled={saving} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 4, padding: '4px 8px', color: '#a0a0a0', fontSize: 11, marginRight: 6 }}>
          {saving ? '...' : 'Save'}
        </button>
        <button onClick={() => onDelete(parameter.id, endpointId)} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 4, padding: '4px 8px', color: '#ff5c6a', fontSize: 11 }}>
          Delete
        </button>
      </td>
    </tr>
  );
}

function ParametersTab({ endpoint, onAdd, onSave, onDelete }) {
  if (!endpoint) {
    return <div style={{ color: '#606060', fontSize: 13 }}>Select an endpoint to manage parameters.</div>;
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
            {['Name', 'In', 'Type', 'Required', 'Description', 'Actions'].map(header => (
              <th key={header} style={{ fontSize: 10, color: '#404040', textAlign: 'left', padding: '6px 8px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {endpoint.parameters.map(parameter => (
            <ParameterRow
              key={parameter.id}
              endpointId={endpoint.id}
              parameter={parameter}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
      <button
        onClick={() => onAdd(endpoint.id, { name: 'param', location: 'query', type: 'string', required: false, description: '' })}
        style={{ marginTop: 10, background: 'transparent', border: 'none', color: '#00d4aa', fontSize: 12, cursor: 'pointer', padding: '6px 8px' }}
      >
        + Add parameter
      </button>
    </div>
  );
}

function ResponseRow({ endpointId, response, onSave, onDelete }) {
  const [draft, setDraft] = useState(response);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(response);
  }, [response]);

  async function handleSave() {
    setSaving(true);
    await onSave(response.id, endpointId, {
      description: draft.description,
      example: draft.example,
    });
    setSaving(false);
  }

  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: '#00d4aa', fontSize: 13 }}>{response.status_code}</span>
        <input
          value={draft.description}
          onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
          style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: 5, color: '#a0a0a0', fontSize: 11, padding: '6px 10px' }}
        />
      </div>
      <textarea
        value={draft.example}
        onChange={event => setDraft(current => ({ ...current, example: event.target.value }))}
        rows={4}
        style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 5, color: '#a0a0a0', fontSize: 11, padding: '6px 10px', resize: 'vertical', outline: 'none', fontFamily: 'var(--mono)' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={handleSave} disabled={saving} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 4, padding: '4px 8px', color: '#a0a0a0', fontSize: 11 }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => onDelete(response.id, endpointId)} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 4, padding: '4px 8px', color: '#ff5c6a', fontSize: 11 }}>
          Delete
        </button>
      </div>
    </div>
  );
}

function ResponsesTab({ endpoint, onAdd, onSave, onDelete }) {
  if (!endpoint) {
    return <div style={{ color: '#606060', fontSize: 13 }}>Select an endpoint to manage responses.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {endpoint.responses.map(response => (
        <ResponseRow
          key={response.id}
          endpointId={endpoint.id}
          response={response}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
      <button
        onClick={() => onAdd(endpoint.id, { status_code: '200', description: 'Successful operation', example: '{}' })}
        style={{ background: 'transparent', border: '1px dashed #242424', borderRadius: 7, padding: '8px', color: '#00d4aa', cursor: 'pointer', fontSize: 12 }}
      >
        + Add response code
      </button>
    </div>
  );
}

function PreviewPane({ projectId, previewTab, setPreviewTab, previewNonce }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!projectId) {
        setContent('');
        return;
      }

      setLoading(true);
      try {
        if (previewTab === 'YAML') {
          const yaml = await api.getSpecYaml(projectId);
          if (!cancelled) setContent(yaml);
        } else {
          const json = await api.getSpecJson(projectId);
          if (!cancelled) setContent(JSON.stringify(json, null, 2));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [projectId, previewTab, previewNonce]);

  return (
    <div style={{ width: 320, background: '#080808', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Generated Spec</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {['YAML', 'JSON'].map(tab => (
            <button
              key={tab}
              onClick={() => setPreviewTab(tab)}
              style={{
                background: previewTab === tab ? '#1a1a1a' : 'transparent',
                border: '1px solid', borderColor: previewTab === tab ? '#2e2e2e' : 'transparent',
                borderRadius: 4, padding: '2px 8px', fontSize: 10, color: previewTab === tab ? '#d0d0d0' : '#404040', cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ color: '#606060', fontSize: 12 }}>Refreshing preview...</div>
        ) : (
          <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7, color: '#b0b0b0', whiteSpace: 'pre-wrap' }}>
            {content || 'No generated spec yet.'}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function Editor() {
  const {
    endpoints,
    activeEndpoint,
    setActiveEndpoint,
    activeProject,
    addEndpoint,
    updateEndpoint,
    addParameter,
    updateParameter,
    deleteParameter,
    addResponse,
    updateResponse,
    deleteResponse,
    searchQuery,
  } = useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Definition');
  const [previewTab, setPreviewTab] = useState('YAML');
  const [previewNonce, setPreviewNonce] = useState(0);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredEndpoints = useMemo(() => {
    if (!normalizedSearch) return endpoints;
    return endpoints.filter(endpoint => (
      endpoint.path.toLowerCase().includes(normalizedSearch)
      || endpoint.method.toLowerCase().includes(normalizedSearch)
      || endpoint.group_name.toLowerCase().includes(normalizedSearch)
      || endpoint.summary.toLowerCase().includes(normalizedSearch)
      || endpoint.tag.toLowerCase().includes(normalizedSearch)
    ));
  }, [endpoints, normalizedSearch]);

  useEffect(() => {
    if (!filteredEndpoints.length) {
      setActiveEndpoint(null);
      return;
    }
    if (!activeEndpoint || !filteredEndpoints.find(endpoint => endpoint.id === activeEndpoint.id)) {
      setActiveEndpoint(filteredEndpoints[0]);
    }
  }, [filteredEndpoints, activeEndpoint, setActiveEndpoint]);

  function bumpPreview() {
    setPreviewNonce(current => current + 1);
  }

  async function handleAddEndpoint() {
    if (!activeProject?.id) return;

    const rawPath = window.prompt('Endpoint path', `/resource-${endpoints.length + 1}`);
    if (!rawPath) return;

    const endpoint = await addEndpoint(activeProject.id, {
      method: 'GET',
      path: rawPath.startsWith('/') ? rawPath : `/${rawPath}`,
      group_name: 'Default',
      summary: '',
      operation_id: '',
      tag: '',
      description: '',
    });

    if (endpoint) {
      setActiveEndpoint(endpoint);
      bumpPreview();
    }
  }

  async function handleSaveEndpoint(endpointId, payload) {
    await updateEndpoint(endpointId, payload);
    bumpPreview();
  }

  async function handleAddParameter(endpointId, payload) {
    await addParameter(endpointId, payload);
    bumpPreview();
  }

  async function handleUpdateParameter(parameterId, endpointId, payload) {
    await updateParameter(parameterId, endpointId, payload);
    bumpPreview();
  }

  async function handleDeleteParameter(parameterId, endpointId) {
    await deleteParameter(parameterId, endpointId);
    bumpPreview();
  }

  async function handleAddResponse(endpointId, payload) {
    await addResponse(endpointId, payload);
    bumpPreview();
  }

  async function handleUpdateResponse(responseId, endpointId, payload) {
    await updateResponse(responseId, endpointId, payload);
    bumpPreview();
  }

  async function handleDeleteResponse(responseId, endpointId) {
    await deleteResponse(responseId, endpointId);
    bumpPreview();
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          searchPlaceholder="Search endpoints..."
          tabs={[
          { label: 'Endpoints', path: '/editor' },
          { label: 'Monitoring', path: '/monitoring' },
          { label: 'Documentation', path: '/docs' },
        ]}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <EndpointList endpoints={filteredEndpoints} activeEndpoint={activeEndpoint} onSelect={setActiveEndpoint} onAdd={handleAddEndpoint} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#000' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeEndpoint ? (
                <>
                  <span className={`method-badge ${activeEndpoint.method}`}>{activeEndpoint.method}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: '#d0d0d0' }}>{activeEndpoint.path}</span>
                </>
              ) : (
                <span style={{ color: '#606060', fontSize: 12 }}>No endpoint selected</span>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => navigate('/export')} style={{ background: 'transparent', border: '1px solid #1e1e1e', borderRadius: 5, padding: '5px 12px', fontSize: 11, color: '#606060', cursor: 'pointer' }}>
                  Export Spec
                </button>
                <button onClick={() => navigate('/docs')} style={{ background: 'transparent', border: '1px solid #1e1e1e', borderRadius: 5, padding: '5px 12px', fontSize: 11, color: '#606060', cursor: 'pointer' }}>
                  View Docs
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a', padding: '0 20px', gap: 2 }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'transparent', border: 'none', padding: '10px 14px',
                    fontSize: 12, cursor: 'pointer',
                    color: activeTab === tab ? '#00d4aa' : '#606060',
                    borderBottom: activeTab === tab ? '2px solid #00d4aa' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {activeTab === 'Definition' && <DefinitionTab endpoint={activeEndpoint} onSave={handleSaveEndpoint} />}
              {activeTab === 'Parameters' && (
                <ParametersTab
                  endpoint={activeEndpoint}
                  onAdd={handleAddParameter}
                  onSave={handleUpdateParameter}
                  onDelete={handleDeleteParameter}
                />
              )}
              {activeTab === 'Responses' && (
                <ResponsesTab
                  endpoint={activeEndpoint}
                  onAdd={handleAddResponse}
                  onSave={handleUpdateResponse}
                  onDelete={handleDeleteResponse}
                />
              )}
            </div>
          </div>

          <PreviewPane
            projectId={activeProject?.id}
            previewTab={previewTab}
            setPreviewTab={setPreviewTab}
            previewNonce={previewNonce}
          />
        </div>
      </div>
    </div>
  );
}
