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
    if (field.description) {
      schema.description = field.description;
    }
    return schema;
  }

  if (normalizedType === 'array') {
    const schema = {
      type: 'array',
      items: children.length ? buildJsonSchema(fields, field.id) : { type: 'string' },
    };
    if (field.description) {
      schema.description = field.description;
    }
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

export default function SchemaBuilder() {
  const { activeProject, searchQuery } = useApp();
  const [schemas, setSchemas] = useState([]);
  const [activeSchemaId, setActiveSchemaId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSchemas = useMemo(() => {
    if (!normalizedSearch) return schemas;
    return schemas.filter(schema => schema.name.toLowerCase().includes(normalizedSearch));
  }, [schemas, normalizedSearch]);

  useEffect(() => {
    if (!filteredSchemas.length) {
      setActiveSchemaId(null);
      return;
    }
    if (!filteredSchemas.find(schema => schema.id === activeSchemaId)) {
      setActiveSchemaId(filteredSchemas[0].id);
    }
  }, [filteredSchemas, activeSchemaId]);

  const activeSchema = filteredSchemas.find(schema => schema.id === activeSchemaId)
    || schemas.find(schema => schema.id === activeSchemaId)
    || null;

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

  const visibleFields = useMemo(() => {
    if (!normalizedSearch || !activeSchema) return orderedFields;
    const schemaMatches = activeSchema.name.toLowerCase().includes(normalizedSearch);
    if (schemaMatches) return orderedFields;
    return orderedFields.filter(({ field }) => (
      field.name.toLowerCase().includes(normalizedSearch)
      || field.type.toLowerCase().includes(normalizedSearch)
      || (field.description || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [orderedFields, activeSchema, normalizedSearch]);

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

  async function handleCreateSchema() {
    if (!activeProject?.id) return;
    const name = window.prompt('Schema name', 'NewSchema');
    if (!name) return;
    const schema = await api.createSchema(activeProject.id, { name });
    await refreshSchemas(schema?.id);
  }

  async function handleDeleteSchema(schemaId) {
    await api.deleteSchema(schemaId);
    await refreshSchemas();
  }

  async function handleAddField(parentField = null) {
    if (!activeSchema) return;
    const name = window.prompt('Field name', parentField ? 'child_field' : 'new_field');
    if (!name) return;
    const type = window.prompt(`Field type (${FIELD_TYPES.join(', ')})`, parentField ? 'string' : 'string');
    if (!type || !FIELD_TYPES.includes(type)) return;
    const description = window.prompt('Field description', '') || '';
    const required = window.confirm('Should this field be required?');

    await api.createField(activeSchema.id, {
      name,
      type,
      required,
      description,
      parent_id: parentField?.id || null,
    });

    await refreshSchemas(activeSchema.id);
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

    await refreshSchemas(activeSchema?.id);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          searchPlaceholder="Search schemas and fields..."
          tabs={[
          { label: 'Schema Builder', path: '/schema' },
        ]}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 220, background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Schemas</div>
            <div style={{ flex: 1, padding: 6, overflow: 'auto' }}>
              {filteredSchemas.map(schema => (
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
              {!loading && filteredSchemas.length === 0 && schemas.length > 0 && (
                <div style={{ color: '#606060', fontSize: 12, padding: 8 }}>
                  No schemas match "{searchQuery}".
                </div>
              )}
            </div>
            <div style={{ padding: 8, borderTop: '1px solid #1a1a1a' }}>
              <button onClick={handleCreateSchema} style={{ width: '100%', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00d4aa', borderRadius: 6, padding: '7px', fontSize: 11, cursor: 'pointer' }}>
                + New Schema
              </button>
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
                  <button onClick={() => handleAddField()} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Add field
                  </button>
                </div>
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
              {!loading && activeSchema && visibleFields.length === 0 && normalizedSearch && (
                <div style={{ padding: 16, color: '#606060', fontSize: 12 }}>
                  No fields in this schema match "{searchQuery}".
                </div>
              )}
              {visibleFields.map(({ field, depth }) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  depth={depth}
                  onAddChild={handleAddField}
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
