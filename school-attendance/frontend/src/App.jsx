import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage      from './pages/LoginPage';
import ScannerPage    from './pages/ScannerPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminBulkImport from './pages/AdminBulkImport';
import TemplateCustomization from './pages/TemplateCustomization';
import StudentManagement from './pages/StudentManagement';
import TeacherManagement from './pages/TeacherManagement';
import StaffTypeConfig    from './pages/StaffTypeConfig';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
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
        <Route path="/dashboard" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/import"    element={<PrivateRoute><AdminBulkImport /></PrivateRoute>} />
        <Route path="/templates"   element={<PrivateRoute><TemplateCustomization /></PrivateRoute>} />
        <Route path="/students"   element={<PrivateRoute><StudentManagement /></PrivateRoute>} />
        <Route path="/teachers"   element={<PrivateRoute><TeacherManagement /></PrivateRoute>} />
        <Route path="/staff-types" element={<PrivateRoute><StaffTypeConfig /></PrivateRoute>} />
        <Route path="*"           element={<Navigate to="/scanner" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
