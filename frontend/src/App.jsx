import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import SchemaBuilder from './pages/SchemaBuilder';
import ExportPage from './pages/ExportPage';
import Monitoring from './pages/Monitoring';
import Documentation from './pages/Documentation';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/schema" element={<SchemaBuilder />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/docs" element={<Documentation />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}