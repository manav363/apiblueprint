import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AppContext = createContext();

function toProjectSummary(project) {
  return {
    id: project.id,
    name: project.name,
    version: project.version,
    description: project.description || '',
    color: project.color || '#00d4aa',
    created_at: project.created_at,
    updated_at: project.updated_at,
    endpoint_count: project.endpoint_count ?? project.endpoints?.length ?? 0,
  };
}

function normalizeEndpoint(endpoint) {
  return {
    ...endpoint,
    method: endpoint.method || 'GET',
    path: endpoint.path || '/',
    group_name: endpoint.group_name || 'Default',
    summary: endpoint.summary || '',
    operation_id: endpoint.operation_id || '',
    tag: endpoint.tag || '',
    description: endpoint.description || '',
    parameters: Array.isArray(endpoint.parameters) ? endpoint.parameters : [],
    responses: Array.isArray(endpoint.responses) ? endpoint.responses : [],
  };
}

export function AppProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [activeEndpoint, setActiveEndpoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Load projects on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadProjects();
  }, []);

  // ── Load endpoints when active project changes ─────────────────────────────
  useEffect(() => {
    if (activeProject?.id) {
      loadEndpoints(activeProject.id);
    } else {
      setEndpoints([]);
      setActiveEndpoint(null);
    }
  }, [activeProject?.id]);

  async function loadProjects() {
    try {
      setLoading(true);
      const data = (await api.listProjects()).map(toProjectSummary);
      setProjects(data);
      setActiveProject(current => {
        if (!data.length) return null;
        if (!current) return data[0];
        return data.find(project => project.id === current.id) || data[0];
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEndpoints(projectId) {
    try {
      const data = (await api.listEndpoints(projectId)).map(normalizeEndpoint);
      setEndpoints(data);
      setActiveEndpoint(current => data.find(endpoint => endpoint.id === current?.id) || data[0] || null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function addProject(name) {
    try {
      const project = await api.createProject({
        name,
        version: "v1.0.0",
        description: "New API project.",
        color: "#00d4aa",
      });
      const summary = toProjectSummary(project);
      setProjects(p => [summary, ...p]);
      setActiveProject(summary);
      return summary;
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateProject(id, data) {
    try {
      const project = await api.updateProject(id, data);
      const summary = toProjectSummary(project);
      setProjects(items => items.map(item => item.id === id ? summary : item));
      setActiveProject(current => current?.id === id ? summary : current);
      return summary;
    } catch (e) {
      setError(e.message);
    }
  }

  async function createStarterProject() {
    try {
      setLoading(true);
      setError(null);
      const project = await api.createProject({
        name: 'Customer Portal API',
        version: 'v1.0.0',
        description: 'Starter API with customer, session, and support-ticket flows.',
        color: '#60a5fa',
      });

      const customers = await api.createEndpoint(project.id, {
        method: 'GET',
        path: '/customers/{id}',
        group_name: 'Customers',
        summary: 'Get customer profile',
        operation_id: 'getCustomerProfile',
        tag: 'customers',
        description: 'Returns the core customer profile used by portal screens.',
      });
      await api.createParameter(customers.id, {
        name: 'id',
        location: 'path',
        type: 'UUID',
        required: true,
        description: 'Customer identifier',
      });
      await api.createResponse(customers.id, {
        status_code: '200',
        description: 'Customer profile',
        example: JSON.stringify({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          plan: 'pro',
        }, null, 2),
      });

      const tickets = await api.createEndpoint(project.id, {
        method: 'POST',
        path: '/support/tickets',
        group_name: 'Support',
        summary: 'Create support ticket',
        operation_id: 'createSupportTicket',
        tag: 'support',
        description: 'Creates a support ticket from the portal form.',
      });
      await api.createResponse(tickets.id, {
        status_code: '201',
        description: 'Ticket created',
        example: JSON.stringify({ ticket_id: 'TCK-1042', status: 'open' }, null, 2),
      });

      const schema = await api.createSchema(project.id, { name: 'Customer' });
      await api.createField(schema.id, {
        name: 'id',
        type: 'UUID',
        required: true,
        description: 'Customer identifier',
        parent_id: null,
      });
      await api.createField(schema.id, {
        name: 'email',
        type: 'string',
        required: true,
        description: 'Primary email address',
        parent_id: null,
      });
      await api.createField(schema.id, {
        name: 'plan',
        type: 'string',
        required: false,
        description: 'Current subscription plan',
        parent_id: null,
      });

      api.reloadMock(project.id).catch(() => {});
      const refreshed = await api.getProject(project.id);
      const summary = toProjectSummary(refreshed);
      setProjects(items => [summary, ...items.filter(item => item.id !== summary.id)]);
      setActiveProject(summary);
      return summary;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(id) {
    try {
      await api.deleteProject(id);
      setProjects(p => {
        const nextProjects = p.filter(x => x.id !== id);
        if (activeProject?.id === id) {
          setActiveProject(nextProjects[0] || null);
        }
        return nextProjects;
      });
      if (activeProject?.id === id) {
        setEndpoints([]);
        setActiveEndpoint(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function patchEndpoint(endpointId, transform) {
    setEndpoints(items => items.map(endpoint => (
      endpoint.id === endpointId ? transform(endpoint) : endpoint
    )));
    setActiveEndpoint(endpoint => (
      endpoint?.id === endpointId ? transform(endpoint) : endpoint
    ));
  }

  async function addEndpoint(projectId, data) {
    try {
      const ep = normalizeEndpoint(await api.createEndpoint(projectId, data));
      setEndpoints(e => [...e, ep]);
      setActiveEndpoint(ep);
      setProjects(items => items.map(project => (
        project.id === projectId
          ? { ...project, endpoint_count: project.endpoint_count + 1, updated_at: new Date().toISOString() }
          : project
      )));
      setActiveProject(project => (
        project?.id === projectId
          ? { ...project, endpoint_count: project.endpoint_count + 1, updated_at: new Date().toISOString() }
          : project
      ));
      // Reload mock server for this project
      api.reloadMock(projectId).catch(() => {});
      return ep;
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateEndpoint(id, data) {
    try {
      const ep = normalizeEndpoint(await api.updateEndpoint(id, data));
      setEndpoints(e => e.map(x => x.id === id ? ep : x));
      if (activeEndpoint?.id === id) setActiveEndpoint(ep);
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
      return ep;
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteEndpoint(id) {
    try {
      const endpoint = endpoints.find(item => item.id === id);
      await api.deleteEndpoint(id);
      setEndpoints(e => e.filter(x => x.id !== id));
      if (activeEndpoint?.id === id) setActiveEndpoint(null);
      if (endpoint?.project_id) {
        setProjects(items => items.map(project => (
          project.id === endpoint.project_id
            ? { ...project, endpoint_count: Math.max(project.endpoint_count - 1, 0), updated_at: new Date().toISOString() }
            : project
        )));
        setActiveProject(project => (
          project?.id === endpoint.project_id
            ? { ...project, endpoint_count: Math.max(project.endpoint_count - 1, 0), updated_at: new Date().toISOString() }
            : project
        ));
      }
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  }

  async function addParameter(endpointId, data) {
    try {
      const parameter = await api.createParameter(endpointId, data);
      patchEndpoint(endpointId, endpoint => ({
        ...endpoint,
        parameters: [...endpoint.parameters, parameter],
      }));
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
      return parameter;
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateParameter(id, endpointId, data) {
    try {
      const parameter = await api.updateParameter(id, data);
      patchEndpoint(endpointId, endpoint => ({
        ...endpoint,
        parameters: endpoint.parameters.map(item => item.id === id ? parameter : item),
      }));
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
      return parameter;
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteParameter(id, endpointId) {
    try {
      await api.deleteParameter(id);
      patchEndpoint(endpointId, endpoint => ({
        ...endpoint,
        parameters: endpoint.parameters.filter(item => item.id !== id),
      }));
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  }

  async function addResponse(endpointId, data) {
    try {
      const response = await api.createResponse(endpointId, data);
      patchEndpoint(endpointId, endpoint => ({
        ...endpoint,
        responses: [...endpoint.responses, response],
      }));
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
      return response;
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateResponse(id, endpointId, data) {
    try {
      const response = await api.updateResponse(id, data);
      patchEndpoint(endpointId, endpoint => ({
        ...endpoint,
        responses: endpoint.responses.map(item => item.id === id ? response : item),
      }));
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
      return response;
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteResponse(id, endpointId) {
    try {
      await api.deleteResponse(id);
      patchEndpoint(endpointId, endpoint => ({
        ...endpoint,
        responses: endpoint.responses.filter(item => item.id !== id),
      }));
      if (activeProject?.id) api.reloadMock(activeProject.id).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppContext.Provider value={{
      projects, activeProject, setActiveProject,
      endpoints, activeEndpoint, setActiveEndpoint,
      loading, error,
      searchQuery, setSearchQuery,
      addProject, deleteProject,
      updateProject, createStarterProject,
      addEndpoint, updateEndpoint, deleteEndpoint,
      addParameter, updateParameter, deleteParameter,
      addResponse, updateResponse, deleteResponse,
      refreshProjects: loadProjects,
      refreshEndpoints: loadEndpoints,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
