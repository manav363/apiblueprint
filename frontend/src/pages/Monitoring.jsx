import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const statusColor = (statusCode) => statusCode < 300 ? '#00d4aa' : statusCode < 400 ? '#f5c842' : '#ff5c6a';

function buildBarData(logs) {
  const recent = logs.slice(0, 12).reverse();
  if (!recent.length) return [];
  return recent.map(log => ({
    requests: Math.max(12, log.status >= 400 ? 32 : 64),
    latency: Math.max(8, parseInt(log.latency, 10) || 0),
    label: log.time,
  }));
}

function buildLogStats(logs) {
  const total = logs.length;
  const errors = logs.filter(log => log.status >= 400).length;
  const avgLatency = total
    ? `${Math.round(logs.reduce((sum, log) => sum + (parseInt(log.latency, 10) || 0), 0) / total)}ms`
    : '0ms';

  return {
    total_requests: total,
    avg_latency: avgLatency,
    error_rate: total ? `${((errors / total) * 100).toFixed(1)}%` : '0%',
  };
}

export default function Monitoring() {
  const { activeProject, searchQuery } = useApp();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMonitoring() {
      try {
        const [nextLogs, nextStats] = await Promise.all([
          api.getMockLogs(),
          api.getMockStats(),
        ]);

        if (!cancelled) {
          setLogs(nextLogs);
          setStats(nextStats);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      }
    }

    loadMonitoring();
    const timer = window.setInterval(loadMonitoring, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLogs = useMemo(() => {
    if (!normalizedSearch) return logs;
    return logs.filter(log => (
      log.method.toLowerCase().includes(normalizedSearch)
      || log.path.toLowerCase().includes(normalizedSearch)
      || String(log.status).includes(normalizedSearch)
      || log.time.toLowerCase().includes(normalizedSearch)
    ));
  }, [logs, normalizedSearch]);
  const filteredStats = useMemo(() => buildLogStats(filteredLogs), [filteredLogs]);
  const chartData = useMemo(() => buildBarData(filteredLogs), [filteredLogs]);
  const displayStats = normalizedSearch ? { ...stats, ...filteredStats } : stats;
  const metricCards = [
    { label: 'Total Requests', value: displayStats?.total_requests ?? filteredLogs.length, change: normalizedSearch ? 'matching current search' : 'live', color: '#00d4aa' },
    { label: 'Avg Latency', value: displayStats?.avg_latency || '0ms', change: normalizedSearch ? 'matching current search' : 'computed from mock traffic', color: '#60a5fa' },
    { label: 'Error Rate', value: displayStats?.error_rate || '0%', change: normalizedSearch ? 'matching current search' : 'all recent responses', color: '#ff5c6a' },
    { label: 'Uptime', value: stats?.uptime || 'n/a', change: activeProject ? `project ${activeProject.id}` : 'mock server', color: '#f5c842' },
  ];

  async function handleReload() {
    if (!activeProject?.id) return;
    await api.reloadMock(activeProject.id);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          searchPlaceholder="Search request logs..."
          tabs={[
          { label: 'Endpoints', path: '/editor' },
          { label: 'Monitoring', path: '/monitoring' },
          { label: 'Documentation', path: '/docs' },
        ]}
        />

        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 4 }}>Monitoring</h1>
              <p style={{ fontSize: 12, color: '#505050' }}>
                Live mock traffic and response metrics{activeProject ? ` for ${activeProject.name}` : ''}.
              </p>
            </div>
            <button
              onClick={handleReload}
              disabled={!activeProject}
              style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '8px 14px', fontSize: 11, color: activeProject ? '#a0a0a0' : '#505050', cursor: activeProject ? 'pointer' : 'default' }}
            >
              Reload Mock Routes
            </button>
          </div>

          {error && <div style={{ color: '#ff5c6a', fontSize: 12, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {metricCards.map(card => (
              <div key={card.label} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#505050', marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--mono)', color: '#f0f0f0', marginBottom: 6 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: card.color }}>{card.change}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16, color: '#a0a0a0' }}>Recent Requests</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
                {chartData.map((point, index) => (
                  <div key={`${point.label}-${index}`} style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: `${point.requests}%`, background: 'rgba(0,212,170,0.25)', borderRadius: '3px 3px 0 0' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: '#303030' }}>{chartData[0]?.label || '--:--:--'}</span>
                <span style={{ fontSize: 10, color: '#303030' }}>{chartData[chartData.length - 1]?.label || '--:--:--'}</span>
              </div>
            </div>

            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16, color: '#a0a0a0' }}>Latency (ms)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
                {chartData.map((point, index) => (
                  <div key={`${point.label}-latency-${index}`} style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: `${Math.min(point.latency * 2, 100)}%`, background: point.latency > 35 ? 'rgba(245,200,66,0.3)' : 'rgba(96,165,250,0.25)', borderRadius: '3px 3px 0 0' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: '#303030' }}>{chartData[0]?.label || '--:--:--'}</span>
                <span style={{ fontSize: 10, color: '#303030' }}>{chartData[chartData.length - 1]?.label || '--:--:--'}</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0' }}>Request Log</span>
              <span style={{ fontSize: 11, color: '#00d4aa' }}>
                {filteredLogs.length}{normalizedSearch ? ' matching requests' : ' recent requests'}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #141414' }}>
                  {['Time', 'Method', 'Path', 'Status', 'Latency'].map(header => (
                    <th key={header} style={{ padding: '8px 16px', fontSize: 10, color: '#404040', textAlign: 'left', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '16px', color: '#606060', fontSize: 12 }}>
                      {normalizedSearch
                        ? `No request logs match "${searchQuery}".`
                        : 'No mock traffic yet. Hit a generated mock endpoint and the log will populate here.'}
                    </td>
                  </tr>
                )}
                {filteredLogs.map((log, index) => (
                  <tr key={`${log.time}-${log.path}-${index}`} style={{ borderBottom: '1px solid #111' }}>
                    <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: '#404040' }}>{log.time}</td>
                    <td style={{ padding: '9px 16px' }}><span className={`method-badge ${log.method}`}>{log.method}</span></td>
                    <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: '#808080' }}>{log.path}</td>
                    <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: statusColor(log.status) }}>{log.status}</td>
                    <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: '#505050' }}>{log.latency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
