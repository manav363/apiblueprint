import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { buildSuggestedOperationId, normalizeEndpointPath } from '../utils/endpoints';

const TABS = ['Definition', 'Parameters', 'Responses'];

const emptyEndpointDraft = {
  method: 'GET',
  path: '',
  group_name: 'Default',
  summary: '',
  operation_id: '',
  tag: '',
  description: '',
};

const fieldInputStyle = {
  width: '100%',
  background: '#111',
  border: '1px solid #242424',
  borderRadius: 6,
  padding: '8px 12px',
  color: '#f0f0f0',
  fontSize: 12,
  outline: 'none',
};

function NewEndpointForm({ draft, onChange, onSubmit, onCancel, saving }) {
  const suggestedOperationId = buildSuggestedOperationId(draft.method, draft.path);

  return (
    <form onSubmit={onSubmit} style={{ padding: 12, borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        New Endpoint
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 8 }}>
        <select
          value={draft.method}
          onChange={event => onChange('method', event.target.value)}
          style={{ ...fieldInputStyle, fontFamily: 'var(--mono)', color: '#00d4aa' }}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => <option key={method}>{method}</option>)}
        </select>
        <input
          value={draft.path}
          onChange={event => onChange('path', event.target.value)}
          placeholder="/users"
          style={{ ...fieldInputStyle, fontFamily: 'var(--mono)' }}
        />
      </div>
      <input
        value={draft.group_name}
        onChange={event => onChange('group_name', event.target.value)}
        placeholder="Group name"
        style={fieldInputStyle}
      />
      <input
        value={draft.summary}
        onChange={event => onChange('summary', event.target.value)}
        placeholder="Short summary"
        style={fieldInputStyle}
      />
      <div style={{ fontSize: 10, color: '#505050' }}>
        Suggested operation id: <span style={{ color: '#909090', fontFamily: 'var(--mono)' }}>{suggestedOperationId}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !draft.path.trim()} style={{ flex: 1, background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>
          {saving ? 'Creating...' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'transparent', color: '#606060', border: '1px solid #242424', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EndpointList({ endpoints, activeEndpoint, onSelect, createState }) {
  const groups = [...new Set(endpoints.map(endpoint => endpoint.group_name || 'Default'))];

  return (
    <div style={{
      width: 260, background: '#080808', borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px', borderBottom: createState.open ? 'none' : '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Resources</span>
        <button onClick={createState.open ? createState.onCancel : createState.onOpen} style={{
          background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)',
          color: '#00d4aa', borderRadius: 4, width: 24, height: 24,
          fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {createState.open ? '×' : '+'}
        </button>
      </div>

      {createState.open && (
        <NewEndpointForm
          draft={createState.draft}
          onChange={createState.onChange}
          onSubmit={createState.onSubmit}
          onCancel={createState.onCancel}
          saving={createState.saving}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
        {endpoints.length === 0 && !createState.open && (
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#b0b0b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {endpoint.path}
                    </div>
                    <div style={{ fontSize: 10, color: '#505050', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {endpoint.summary || 'No summary'}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DefinitionTab({ endpoint, onSave }) {
  const [draft, setDraft] = useState(emptyEndpointDraft);
  const [saving, setSaving] = useState(false);
  const [operationIdTouched, setOperationIdTouched] = useState(false);

  useEffect(() => {
    if (!endpoint) return;
    const suggestedOperationId = buildSuggestedOperationId(endpoint.method, endpoint.path);
    setDraft({
      method: endpoint.method || 'GET',
      path: endpoint.path || '',
      group_name: endpoint.group_name || 'Default',
      summary: endpoint.summary || '',
      operation_id: endpoint.operation_id || suggestedOperationId,
      tag: endpoint.tag || '',
      description: endpoint.description || '',
    });
    setOperationIdTouched(Boolean(endpoint.operation_id && endpoint.operation_id !== suggestedOperationId));
  }, [endpoint]);

  if (!endpoint) {
    return <div style={{ color: '#606060', fontSize: 13 }}>Select an endpoint to edit its definition.</div>;
  }

  const suggestedOperationId = buildSuggestedOperationId(draft.method, draft.path);

  function updateDraftField(field, value) {
    setDraft(current => {
      const nextDraft = { ...current, [field]: value };
      if ((field === 'method' || field === 'path') && !operationIdTouched) {
        nextDraft.operation_id = buildSuggestedOperationId(
          field === 'method' ? value : nextDraft.method,
          field === 'path' ? value : nextDraft.path,
        );
      }
      return nextDraft;
    });
  }

  async function handleSave() {
    setSaving(true);
    await onSave(endpoint.id, {
      ...draft,
      path: normalizeEndpointPath(draft.path),
      operation_id: draft.operation_id.trim() || suggestedOperationId,
    });
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8 }}>
        <select value={draft.method} onChange={event => updateDraftField('method', event.target.value)}
          style={{ ...fieldInputStyle, fontFamily: 'var(--mono)', color: '#00d4aa' }}>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => <option key={method}>{method}</option>)}
        </select>
        <input
          value={draft.path}
          onChange={event => updateDraftField('path', event.target.value)}
          placeholder="/users/{id}"
          style={{ ...fieldInputStyle, fontFamily: 'var(--mono)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input
          value={draft.group_name}
          onChange={event => setDraft(current => ({ ...current, group_name: event.target.value }))}
          placeholder="Group"
          style={fieldInputStyle}
        />
        <input
          value={draft.tag}
          onChange={event => setDraft(current => ({ ...current, tag: event.target.value }))}
          placeholder="Tag"
          style={fieldInputStyle}
        />
      </div>

      <input
        value={draft.operation_id}
        onChange={event => {
          const value = event.target.value;
          setDraft(current => ({ ...current, operation_id: value }));
          setOperationIdTouched(Boolean(value.trim()) && value.trim() !== suggestedOperationId);
        }}
        placeholder="operation_id"
        style={{ ...fieldInputStyle, fontFamily: 'var(--mono)' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -8 }}>
        <div style={{ fontSize: 10, color: '#505050' }}>
          Suggested: <span style={{ color: '#909090', fontFamily: 'var(--mono)' }}>{suggestedOperationId}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(current => ({ ...current, operation_id: suggestedOperationId }));
            setOperationIdTouched(false);
          }}
          style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 4, padding: '4px 8px', color: '#a0a0a0', fontSize: 11, cursor: 'pointer' }}
        >
          Use Suggested
        </button>
      </div>

      <input
        value={draft.summary}
        onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))}
        placeholder="Short summary"
        style={fieldInputStyle}
      />

      <textarea
        value={draft.description}
        onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
        rows={5}
        placeholder="Describe what this endpoint does"
        style={{ ...fieldInputStyle, resize: 'vertical', lineHeight: 1.6 }}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving || !draft.path.trim()}
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
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(response);
    setError('');
  }, [response]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave(response.id, endpointId, {
        description: draft.description,
        example: draft.example,
      });
    } catch (saveError) {
      setError(saveError.message);
    }
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
      {error && <div style={{ marginTop: 8, color: '#ff5c6a', fontSize: 11, whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div>
  );
}

function ResponsesTab({ endpoint, onAdd, onSave, onDelete }) {
  const [createError, setCreateError] = useState('');

  if (!endpoint) {
    return <div style={{ color: '#606060', fontSize: 13 }}>Select an endpoint to manage responses.</div>;
  }

  async function handleAddResponse() {
    setCreateError('');
    try {
      await onAdd(endpoint.id, { status_code: '200', description: 'Successful operation', example: '{}' });
    } catch (error) {
      setCreateError(error.message);
    }
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
        onClick={handleAddResponse}
        style={{ background: 'transparent', border: '1px dashed #242424', borderRadius: 7, padding: '8px', color: '#00d4aa', cursor: 'pointer', fontSize: 12 }}
      >
        + Add response code
      </button>
      {createError && <div style={{ color: '#ff5c6a', fontSize: 11, whiteSpace: 'pre-wrap' }}>{createError}</div>}
    </div>
  );
}

function PreviewPane({ projectId, previewTab, setPreviewTab, previewNonce }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!projectId) {
        setContent('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        if (previewTab === 'YAML') {
          const yaml = await api.getSpecYaml(projectId);
          if (!cancelled) setContent(yaml);
        } else {
          const json = await api.getSpecJson(projectId);
          if (!cancelled) setContent(JSON.stringify(json, null, 2));
        }
      } catch (loadError) {
        if (!cancelled) {
          setContent('');
          setError(loadError.message);
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
        ) : error ? (
          <div style={{ color: '#ff5c6a', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{error}</div>
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
  } = useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Definition');
  const [previewTab, setPreviewTab] = useState('YAML');
  const [previewNonce, setPreviewNonce] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyEndpointDraft);

  function bumpPreview() {
    setPreviewNonce(current => current + 1);
  }

  function resetCreateForm() {
    setCreateDraft(emptyEndpointDraft);
    setCreateOpen(false);
    setCreateSaving(false);
  }

  async function handleCreateEndpoint(event) {
    event.preventDefault();
    if (!activeProject?.id || !createDraft.path.trim()) return;

    setCreateSaving(true);
    const endpoint = await addEndpoint(activeProject.id, {
      ...createDraft,
      path: normalizeEndpointPath(createDraft.path),
      group_name: createDraft.group_name.trim() || 'Default',
      operation_id: buildSuggestedOperationId(createDraft.method, createDraft.path),
    });

    if (endpoint) {
      setActiveEndpoint(endpoint);
      resetCreateForm();
      bumpPreview();
    } else {
      setCreateSaving(false);
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
        <Topbar tabs={[
          { label: 'Endpoints', path: '/editor' },
          { label: 'Monitoring', path: '/monitoring' },
          { label: 'Documentation', path: '/docs' },
        ]} />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <EndpointList
            endpoints={endpoints}
            activeEndpoint={activeEndpoint}
            onSelect={setActiveEndpoint}
            createState={{
              open: createOpen,
              saving: createSaving,
              draft: createDraft,
              onOpen: () => setCreateOpen(true),
              onCancel: resetCreateForm,
              onChange: (field, value) => setCreateDraft(current => ({
                ...current,
                [field]: value,
                operation_id: ['method', 'path'].includes(field)
                  ? buildSuggestedOperationId(
                    field === 'method' ? value : current.method,
                    field === 'path' ? value : current.path,
                  )
                  : current.operation_id,
              })),
              onSubmit: handleCreateEndpoint,
            }}
          />

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
