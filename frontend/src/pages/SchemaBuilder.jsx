import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const FIELD_TYPES = ['string', 'integer', 'boolean', 'number', 'object', 'array', 'UUID', 'TIMESTAMP', 'URL'];

const TYPE_COLORS = {
  UUID: '#60a5fa',
  string: '#a8ff9a',
  object: '#00d4aa',
  TIMESTAMP: '#f5c842',
  URL: '#fb923c',
  boolean: '#ff7eb3',
  integer: '#c084fc',
  array: '#f97316',
  number: '#f5c842',
};

const panelInputStyle = {
  width: '100%',
  background: '#111',
  border: '1px solid #242424',
  borderRadius: 6,
  padding: '8px 12px',
  color: '#f0f0f0',
  fontSize: 12,
  outline: 'none',
};

const emptyFieldDraft = {
  name: '',
  type: 'string',
  description: '',
  required: false,
  parent_id: null,
};

function buildJsonSchema(fields, parentId = null) {
  const nodes = fields.filter(field => field.parent_id === parentId);
  const properties = {};
  const required = [];

  nodes.forEach(field => {
    const schema = fieldToSchema(field, fields);
    properties[field.name] = schema;
    if (field.required) {
      required.push(field.name);
    }
  });

  const result = { type: 'object', properties };
  if (required.length) {
    result.required = required;
  }
  return result;
}

function fieldToSchema(field, fields) {
  const normalizedType = field.type || 'string';
  const children = fields.filter(child => child.parent_id === field.id);

  if (normalizedType === 'object') {
    const schema = buildJsonSchema(fields, field.id);
    if (field.description) schema.description = field.description;
    return schema;
  }

  if (normalizedType === 'array') {
    const schema = {
      type: 'array',
      items: children.length ? buildJsonSchema(fields, field.id) : { type: 'string' },
    };
    if (field.description) schema.description = field.description;
    return schema;
  }

  const mapped = {
    UUID: { type: 'string', format: 'uuid' },
    TIMESTAMP: { type: 'string', format: 'date-time' },
    URL: { type: 'string', format: 'uri' },
  }[normalizedType] || { type: normalizedType };

  if (field.description) {
    mapped.description = field.description;
  }
  return mapped;
}

function FieldRow({ field, depth, onAddChild, onDelete }) {
  const color = TYPE_COLORS[field.type] || '#a0a0a0';
  const canNest = field.type === 'object' || field.type === 'array';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderBottom: '1px solid #141414',
      paddingLeft: 12 + depth * 22,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#d0d0d0', minWidth: 140 }}>{field.name}</span>
      <span style={{
        background: `${color}18`, color, fontSize: 10, fontFamily: 'var(--mono)',
        fontWeight: 600, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
      }}>{field.type}</span>
      <span style={{ fontSize: 11, color: '#808080', flex: 1 }}>{field.description || 'No description'}</span>
      <span style={{ fontSize: 10, color: field.required ? '#00d4aa' : '#505050' }}>{field.required ? 'required' : 'optional'}</span>
      {canNest && (
        <button onClick={() => onAddChild(field)} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 5, padding: '4px 8px', color: '#00d4aa', fontSize: 11 }}>
          + Child
        </button>
      )}
      <button onClick={() => onDelete(field.id)} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 5, padding: '4px 8px', color: '#ff5c6a', fontSize: 11 }}>
        Delete
      </button>
    </div>
  );
}

function NewSchemaForm({ draft, saving, onChange, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        value={draft}
        onChange={event => onChange(event.target.value)}
        placeholder="Schema name"
        style={{ ...panelInputStyle, fontFamily: 'var(--mono)' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !draft.trim()} style={{ flex: 1, background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>
          {saving ? 'Creating...' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'transparent', color: '#606060', border: '1px solid #242424', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldForm({ draft, parentField, saving, onChange, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 12, padding: 14, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f0' }}>
            {parentField ? `Add child field to ${parentField.name}` : 'Add top-level field'}
          </div>
          <div style={{ fontSize: 10, color: '#505050', marginTop: 2 }}>
            {parentField ? `Parent type: ${parentField.type}` : 'This field will be created at the schema root'}
          </div>
        </div>
      </div>

      <input
        value={draft.name}
        onChange={event => onChange('name', event.target.value)}
        placeholder="Field name"
        style={{ ...panelInputStyle, fontFamily: 'var(--mono)' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <select
          value={draft.type}
          onChange={event => onChange('type', event.target.value)}
          style={panelInputStyle}
        >
          {FIELD_TYPES.map(type => <option key={type}>{type}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #242424', borderRadius: 6, color: '#a0a0a0', fontSize: 12 }}>
          <input type="checkbox" checked={draft.required} onChange={event => onChange('required', event.target.checked)} />
          Required field
        </label>
      </div>

      <textarea
        value={draft.description}
        onChange={event => onChange('description', event.target.value)}
        rows={3}
        placeholder="Describe this field"
        style={{ ...panelInputStyle, resize: 'vertical', lineHeight: 1.6 }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !draft.name.trim()} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600 }}>
          {saving ? 'Saving...' : 'Create Field'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'transparent', color: '#606060', border: '1px solid #242424', borderRadius: 6, padding: '8px 14px', fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SchemaBuilder() {
  const { activeProject } = useApp();
  const [schemas, setSchemas] = useState([]);
  const [activeSchemaId, setActiveSchemaId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createSchemaOpen, setCreateSchemaOpen] = useState(false);
  const [createSchemaSaving, setCreateSchemaSaving] = useState(false);
  const [schemaDraft, setSchemaDraft] = useState('');
  const [fieldFormOpen, setFieldFormOpen] = useState(false);
  const [fieldFormSaving, setFieldFormSaving] = useState(false);
  const [fieldDraft, setFieldDraft] = useState(emptyFieldDraft);

  useEffect(() => {
    let cancelled = false;

    async function loadSchemas() {
      if (!activeProject?.id) {
        setSchemas([]);
        setActiveSchemaId(null);
        return;
      }

      setLoading(true);
      try {
        const nextSchemas = await api.listSchemas(activeProject.id);
        if (!cancelled) {
          setSchemas(nextSchemas);
          setActiveSchemaId(current => current && nextSchemas.find(schema => schema.id === current) ? current : nextSchemas[0]?.id || null);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSchemas();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  const activeSchema = schemas.find(schema => schema.id === activeSchemaId) || null;
  const parentField = activeSchema?.fields.find(field => field.id === fieldDraft.parent_id) || null;

  const orderedFields = useMemo(() => {
    if (!activeSchema) return [];

    function visit(parentId, depth = 0) {
      return activeSchema.fields
        .filter(field => field.parent_id === parentId)
        .sort((left, right) => left.id - right.id)
        .flatMap(field => [{ field, depth }, ...visit(field.id, depth + 1)]);
    }

    return visit(null);
  }, [activeSchema]);

  const preview = useMemo(() => {
    if (!activeSchema) return '{\n  "type": "object",\n  "properties": {}\n}';
    return JSON.stringify(buildJsonSchema(activeSchema.fields), null, 2);
  }, [activeSchema]);

  async function refreshSchemas(nextActiveId = activeSchemaId) {
    if (!activeProject?.id) return;
    const nextSchemas = await api.listSchemas(activeProject.id);
    setSchemas(nextSchemas);
    setActiveSchemaId(nextActiveId && nextSchemas.find(schema => schema.id === nextActiveId) ? nextActiveId : nextSchemas[0]?.id || null);
  }

  function resetSchemaForm() {
    setCreateSchemaOpen(false);
    setCreateSchemaSaving(false);
    setSchemaDraft('');
  }

  function openFieldForm(parent = null) {
    setFieldDraft({
      ...emptyFieldDraft,
      parent_id: parent?.id || null,
      type: parent?.type === 'array' ? 'string' : 'string',
    });
    setFieldFormOpen(true);
  }

  function resetFieldForm() {
    setFieldFormOpen(false);
    setFieldFormSaving(false);
    setFieldDraft(emptyFieldDraft);
  }

  async function handleCreateSchema(event) {
    event.preventDefault();
    if (!activeProject?.id || !schemaDraft.trim()) return;

    setCreateSchemaSaving(true);
    const schema = await api.createSchema(activeProject.id, { name: schemaDraft.trim() });
    if (schema) {
      await refreshSchemas(schema.id);
      resetSchemaForm();
    } else {
      setCreateSchemaSaving(false);
    }
  }

  async function handleDeleteSchema(schemaId) {
    await api.deleteSchema(schemaId);
    await refreshSchemas();
  }

  async function handleCreateField(event) {
    event.preventDefault();
    if (!activeSchema || !fieldDraft.name.trim()) return;

    setFieldFormSaving(true);
    await api.createField(activeSchema.id, {
      name: fieldDraft.name.trim(),
      type: fieldDraft.type,
      required: fieldDraft.required,
      description: fieldDraft.description.trim(),
      parent_id: fieldDraft.parent_id,
    });

    await refreshSchemas(activeSchema.id);
    resetFieldForm();
  }

  async function handleDeleteField(fieldId) {
    if (!activeSchema) return;

    const idsToDelete = [];

    function collectDescendants(parentId) {
      activeSchema.fields
        .filter(field => field.parent_id === parentId)
        .forEach(field => {
          collectDescendants(field.id);
          idsToDelete.push(field.id);
        });
    }

    collectDescendants(fieldId);
    idsToDelete.push(fieldId);

    for (const id of idsToDelete) {
      await api.deleteField(id);
    }

    await refreshSchemas(activeSchema.id);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar tabs={[
          { label: 'Schema Builder', path: '/schema' },
        ]} />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 240, background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Schemas</div>
            <div style={{ flex: 1, padding: 6, overflow: 'auto' }}>
              {schemas.map(schema => (
                <div key={schema.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <button onClick={() => setActiveSchemaId(schema.id)} style={{
                    flex: 1,
                    background: activeSchemaId === schema.id ? 'rgba(0,212,170,0.08)' : 'transparent',
                    border: 'none',
                    borderLeft: activeSchemaId === schema.id ? '2px solid #00d4aa' : '2px solid transparent',
                    color: activeSchemaId === schema.id ? '#00d4aa' : '#606060',
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 5,
                  }}>
                    {schema.name}
                  </button>
                  <button onClick={() => handleDeleteSchema(schema.id)} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 4, color: '#ff5c6a', fontSize: 10, padding: '4px 6px' }}>
                    Del
                  </button>
                </div>
              ))}
              {!loading && schemas.length === 0 && (
                <div style={{ color: '#606060', fontSize: 12, padding: 8 }}>
                  No schemas yet for this project.
                </div>
              )}
            </div>
            <div style={{ padding: 8, borderTop: '1px solid #1a1a1a' }}>
              {createSchemaOpen ? (
                <NewSchemaForm
                  draft={schemaDraft}
                  saving={createSchemaSaving}
                  onChange={setSchemaDraft}
                  onSubmit={handleCreateSchema}
                  onCancel={resetSchemaForm}
                />
              ) : (
                <button onClick={() => setCreateSchemaOpen(true)} style={{ width: '100%', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00d4aa', borderRadius: 6, padding: '7px', fontSize: 11, cursor: 'pointer' }}>
                  + New Schema
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>Entity Structure</div>
                <div style={{ fontSize: 11, color: '#505050' }}>
                  {activeSchema ? `Persisted schema for ${activeProject?.name || 'current project'}` : 'Create a schema to start modeling data'}
                </div>
              </div>
              {activeSchema && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={() => openFieldForm()} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Add field
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '0 20px 12px' }}>
              {fieldFormOpen && (
                <FieldForm
                  draft={fieldDraft}
                  parentField={parentField}
                  saving={fieldFormSaving}
                  onChange={(field, value) => setFieldDraft(current => ({ ...current, [field]: value }))}
                  onSubmit={handleCreateField}
                  onCancel={resetFieldForm}
                />
              )}
            </div>

            <div style={{ display: 'flex', padding: '5px 10px', borderBottom: '1px solid #1a1a1a', background: '#0a0a0a', gap: 8 }}>
              {['Field name', 'Type', 'Description', 'Required', 'Actions'].map((header, index) => (
                <span key={header} style={{ fontSize: 10, color: '#404040', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', width: index === 0 ? 140 : index === 1 ? 80 : index === 3 ? 60 : index === 4 ? 120 : 'auto', flex: index === 2 ? 1 : undefined }}>
                  {header}
                </span>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading && <div style={{ padding: 16, color: '#606060', fontSize: 12 }}>Loading schemas...</div>}
              {error && <div style={{ padding: 16, color: '#ff5c6a', fontSize: 12 }}>{error}</div>}
              {!loading && !activeSchema && (
                <div style={{ padding: 16, color: '#606060', fontSize: 12 }}>
                  Create or select a schema to manage fields.
                </div>
              )}
              {orderedFields.map(({ field, depth }) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  depth={depth}
                  onAddChild={openFieldForm}
                  onDelete={handleDeleteField}
                />
              ))}
            </div>
          </div>

          <div style={{ width: 340, background: '#080808', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>JSON Schema Preview</span>
              <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#00d4aa' }} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.7, color: '#606060', whiteSpace: 'pre-wrap', margin: 0 }}>
                {preview}
              </pre>
            </div>

            <div style={{ padding: '12px', borderTop: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4aa' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#a0a0a0' }}>Persistence Status</span>
              </div>
              <div style={{ fontSize: 11, color: '#606060', lineHeight: 1.6 }}>
                Fields created here are stored in the backend and included in generated OpenAPI exports, including nested child fields for objects and arrays.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
