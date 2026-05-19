import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

// ── Scan ──────────────────────────────────────────────────────────────────────
export const scanBarcode = (barcode) =>
  api.post('/api/scan', { barcode, entry_point: 'main_gate' });

// ── Admin dashboard ───────────────────────────────────────────────────────────
export const getDashboard = (date) =>
  api.get('/api/admin/dashboard', {
    params:  date ? { date } : {},
    timeout: 60_000,  // 60s — allows Supabase cold-start to complete
  });

export const getAttendanceLogs = (filters = {}) =>
  api.get('/api/admin/attendance-log', { params: filters });

export const exportCSV = async (date) => {
  const res = await api.get('/api/admin/export-csv', {
    params:       date ? { date } : {},
    responseType: 'blob',
  });
  const url  = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href     = url;
  link.download = `attendance_${date ?? new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── Bulk import ───────────────────────────────────────────────────────────────
export const importStudentsCSV = (formData) =>
  api.post('/api/admin/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });

export const importTeachersCSV = (formData) =>
  api.post('/api/admin/teachers/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });

// ── Message templates ─────────────────────────────────────────────────────────
export const getTemplates    = ()          => api.get('/api/admin/templates');
export const updateTemplate  = (key, body) => api.post(`/api/admin/templates/${key}`, body);

// ── Notification settings ─────────────────────────────────────────────────────
export const getSettings  = ()       => api.get('/api/admin/settings');
export const saveSettings = (body)   => api.post('/api/admin/settings', body);

// ── Student management ────────────────────────────────────────────────────────
export const getStudents    = ()                   => api.get('/api/admin/students');
export const addStudent     = (body)               => api.post('/api/admin/students', body);
export const updateStudent  = (student_id, body)   => api.put(`/api/admin/students/${student_id}`, body);
export const deleteStudent  = (student_id)         => api.delete(`/api/admin/students/${student_id}`);

// ── Teacher management ────────────────────────────────────────────────────────
export const getTeachers    = ()                   => api.get('/api/admin/teachers');
export const addTeacher     = (body)               => api.post('/api/admin/teachers', body);
export const updateTeacher  = (teacher_id, body)   => api.put(`/api/admin/teachers/${teacher_id}`, body);
export const deleteTeacher  = (teacher_id)         => api.delete(`/api/admin/teachers/${teacher_id}`);

// ── Staff type management ─────────────────────────────────────────────────────
export const getStaffTypes   = ()                  => api.get('/api/admin/staff-types');
export const addStaffType    = (body)              => api.post('/api/admin/staff-types', body);
export const updateStaffType = (config_id, body)   => api.put(`/api/admin/staff-types/${config_id}`, body);
export const deleteStaffType = (config_id)         => api.delete(`/api/admin/staff-types/${config_id}`);

// ── Audit logs ────────────────────────────────────────────────────────────────
export const getAuditLogs = (params = {})          => api.get('/api/admin/audit-logs', { params });

// ── Teacher attendance logs ───────────────────────────────────────────────────
export const getTeacherLogs = (params = {})        => api.get('/api/admin/teacher-logs', { params });

// ── Polling utility ───────────────────────────────────────────────────────────
export const startDashboardPolling = (callback, interval = 3000) => {
  const poll = async () => {
    try {
      const { data } = await getDashboard();
      callback(data);
    } catch (err) {
      console.error('Dashboard poll error:', err);
    }
  };
  poll();
  return setInterval(poll, interval);
};

// ── Holidays ──────────────────────────────────────────────────────────────────
export const getHolidays    = ()                  => api.get('/api/admin/holidays');
export const addHoliday     = (body)              => api.post('/api/admin/holidays', body);
export const updateHoliday  = (id, body)          => api.patch(`/api/admin/holidays/${id}`, body);
export const deleteHoliday  = (id)               => api.delete(`/api/admin/holidays/${id}`);

// ── Fraud alerts ──────────────────────────────────────────────────────────────
export const getFraudAlerts   = (params = {})     => api.get('/api/admin/fraud-alerts', { params });
export const updateFraudAlert = (id, body)         => api.patch(`/api/admin/fraud-alerts/${id}`, body);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAnalytics = (start, end) =>
  api.get('/api/admin/analytics', { params: { start, end }, timeout: 30_000 });

export default api;
