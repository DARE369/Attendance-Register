import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage      from './pages/LoginPage';
import ScannerPage    from './pages/ScannerPage';
import AdminDashboard from './pages/AdminDashboard';

function getRole() {
  try { return JSON.parse(localStorage.getItem('admin') || '{}').role || 'admin'; }
  catch { return 'admin'; }
}

function PrivateRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && getRole() === 'scanner') return <Navigate to="/scanner" replace />;
  return children;
}

function DefaultRedirect() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={getRole() === 'scanner' ? '/scanner' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style:   { fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.95rem' },
          success: { duration: 2500, iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/scanner"   element={<PrivateRoute><ScannerPage /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
        {/* Redirect old standalone routes to the unified dashboard */}
        <Route path="/import"     element={<PrivateRoute adminOnly><Navigate to="/dashboard" replace /></PrivateRoute>} />
        <Route path="/templates"  element={<PrivateRoute adminOnly><Navigate to="/dashboard" replace /></PrivateRoute>} />
        <Route path="/students"   element={<PrivateRoute adminOnly><Navigate to="/dashboard" replace /></PrivateRoute>} />
        <Route path="/teachers"   element={<PrivateRoute adminOnly><Navigate to="/dashboard" replace /></PrivateRoute>} />
        <Route path="/staff-types" element={<PrivateRoute adminOnly><Navigate to="/dashboard" replace /></PrivateRoute>} />
        <Route path="*"           element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
