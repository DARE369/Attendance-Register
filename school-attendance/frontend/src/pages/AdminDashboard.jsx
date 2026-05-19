import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import crestLogo from '../assets/Picture1.png';

import SummaryCards    from '../components/SummaryCards';
import AttendanceLog   from '../components/AttendanceLog';
import AuditLogs           from '../components/AuditLogs';
import HolidayManager      from '../components/HolidayManager';
import FraudAlertsPanel    from '../components/FraudAlertsPanel';
import AnalyticsPanel      from '../components/AnalyticsPanel';
import ReportsPanel        from '../components/ReportsPanel';
import NotificationSettings from '../components/NotificationSettings';
import StudentManagement   from './StudentManagement';
import TeacherManagement   from './TeacherManagement';
import StaffTypeConfig     from './StaffTypeConfig';
import AdminProfile        from './AdminProfile';

import { getDashboard, exportCSV } from '../services/api';

const POLL_INTERVAL  = 5000;   // normal refresh cadence
const BACKOFF_MAX_MS = 30_000; // longest we'll wait after repeated failures

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: ChartIcon },
  { id: 'analytics',   label: 'Analytics',    icon: AnalyticsIcon },
  { id: 'reports',     label: 'Reports',      icon: ReportsIcon },
  { id: 'students',    label: 'Students',     icon: StudentsIcon },
  { id: 'teachers',    label: 'Teachers',     icon: TeacherIcon },
  { id: 'staff-config', label: 'Staff Config', icon: ConfigIcon },
  { id: 'holidays',    label: 'Holidays',     icon: HolidayIcon },
  { id: 'fraud',       label: 'Fraud Alerts', icon: FraudIcon },
  { id: 'audit',       label: 'Audit Logs',   icon: AuditIcon },
  { id: 'profile',     label: 'Profile',      icon: ProfileIcon },
];

// ── "Updated X ago" hook ──────────────────────────────────────────────────────
function useAgo(date) {
  const [ago, setAgo] = useState('');
  useEffect(() => {
    if (!date) return;
    const tick = () => {
      const s = Math.floor((Date.now() - date.getTime()) / 1000);
      if (s < 5)       setAgo('just now');
      else if (s < 60) setAgo(`${s}s ago`);
      else             setAgo(`${Math.floor(s / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);
  return ago;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab,    setActiveTab]    = useState('dashboard');
  const mountedTabs = useRef(new Set(['dashboard']));

  const switchTab = useCallback((id) => {
    mountedTabs.current.add(id);
    setActiveTab(id);
  }, []);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [exporting,    setExporting]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [retryCount,   setRetryCount]   = useState(0);
  const [connecting,   setConnecting]   = useState(true);

  const ago = useAgo(lastUpdated);

  const admin = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('admin') || '{}'); }
    catch { return {}; }
  }, []);

  // ── Polling with exponential backoff ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let timerId   = null;
    let fails     = 0;

    const poll = async () => {
      try {
        const { data: res } = await getDashboard(selectedDate);
        if (cancelled) return;
        setData(res);
        setLastUpdated(new Date());
        setLoading(false);
        setConnecting(false);
        setRetryCount(0);
        fails = 0;
        timerId = setTimeout(poll, POLL_INTERVAL);
      } catch {
        if (cancelled) return;
        fails += 1;
        setRetryCount(fails);
        setLoading(false);
        // Exponential back-off: 5s → 10s → 20s → 30s (cap)
        const delay = Math.min(POLL_INTERVAL * Math.pow(2, fails - 1), BACKOFF_MAX_MS);
        timerId = setTimeout(poll, delay);
      }
    };

    setLoading(true);
    setConnecting(true);
    setRetryCount(0);
    fails = 0;
    poll();

    return () => { cancelled = true; clearTimeout(timerId); };
  }, [selectedDate, refreshKey]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExporting(true);
    try { await exportCSV(selectedDate); }
    catch { toast.error('Export failed. Please try again.'); }
    finally { setExporting(false); }
  }, [selectedDate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/login', { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="text-white shadow-lg sticky top-0 z-40"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <img src={crestLogo} alt="LPS crest" className="w-9 h-9 object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-base leading-tight tracking-wide">Lekki Peculiar School</p>
              <p className="text-blue-200 text-xs mt-0.5 font-medium">Attendance Register</p>
            </div>
          </div>

          {/* Live badge */}
          {lastUpdated && (
            <div className="hidden md:flex items-center gap-2 text-xs text-blue-200">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Updated {ago}
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <HeaderBtn onClick={() => setRefreshKey((k) => k + 1)} title="Refresh">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0
                     0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </HeaderBtn>
            <Link to="/scanner"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                         border border-white/20 rounded-lg text-sm font-semibold transition-colors text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m0 14v1M4 12h1m14 0h1" />
              </svg>
              <span className="hidden sm:inline">Scanner</span>
            </Link>
            <Link to="/import"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                         border border-white/20 rounded-lg text-sm font-semibold transition-colors text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0L8 8m4-4l4 4" />
              </svg>
              <span className="hidden md:inline">Import</span>
            </Link>
            <Link to="/templates"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                         border border-white/20 rounded-lg text-sm font-semibold transition-colors text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                     2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden lg:inline">Templates</span>
            </Link>
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                         border border-white/20 rounded-lg text-sm font-semibold transition-colors text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
                     00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                     .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="hidden lg:inline">Settings</span>
            </button>
            {admin.username && (
              <span className="hidden lg:block text-sm text-blue-200 px-2">{admin.username}</span>
            )}
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500
                         rounded-lg text-sm font-semibold transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3
                     3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-[56px] z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => switchTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2
                          whitespace-nowrap transition-all duration-200 ${
                activeTab === id
                  ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {/* Dashboard tab — always mounted */}
        <div style={{ display: activeTab === 'dashboard' ? undefined : 'none' }}>
          <div className="space-y-6">
            {!data && retryCount > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200
                              text-amber-800 rounded-xl px-5 py-3.5 text-sm">
                <svg className="animate-spin w-4 h-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>
                  Connecting to database — the server may be waking up after inactivity.
                  {' '}<span className="font-semibold">This can take up to 2 minutes on first load.</span>
                  {' '}Attempt {retryCount}…
                </span>
                <button onClick={() => setRefreshKey((k) => k + 1)}
                  className="ml-auto shrink-0 text-xs font-semibold text-amber-700
                             hover:text-amber-900 underline underline-offset-2">
                  Retry now
                </button>
              </div>
            )}
            <SummaryCards summary={data?.summary} teacherSummary={data?.teacher_summary} loading={loading} />
            <AttendanceLog data={data} loading={loading} selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  retryCount > 0 && !data ? 'bg-amber-400' : 'bg-green-400'
                }`} />
                {retryCount > 0 && !data
                  ? `Reconnecting… attempt ${retryCount}`
                  : `Live · refreshes every ${POLL_INTERVAL / 1000}s${lastUpdated ? ` · last sync ${ago}` : ''}`
                }
              </div>
              <button onClick={handleExport} disabled={exporting || loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-semibold rounded-lg shadow-sm transition-colors
                           disabled:opacity-60 disabled:cursor-not-allowed">
                {exporting ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* All other tabs — lazy mount (mounted on first visit, then kept alive) */}
        {[
          { id: 'analytics',   el: <AnalyticsPanel isEmbedded /> },
          { id: 'reports',     el: <ReportsPanel isEmbedded /> },
          { id: 'students',    el: <StudentManagement isEmbedded /> },
          { id: 'teachers',    el: <TeacherManagement isEmbedded /> },
          { id: 'staff-config', el: <StaffTypeConfig isEmbedded /> },
          { id: 'holidays',    el: <HolidayManager isEmbedded /> },
          { id: 'fraud',       el: <FraudAlertsPanel isEmbedded /> },
          { id: 'audit',       el: <AuditLogs isEmbedded /> },
          { id: 'profile',     el: <AdminProfile isEmbedded /> },
        ].map(({ id, el }) =>
          mountedTabs.current.has(id) ? (
            <div key={id} style={{ display: activeTab === id ? undefined : 'none' }}>
              {el}
            </div>
          ) : null
        )}
      </main>

      {showSettings && <NotificationSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── Small header button ───────────────────────────────────────────────────────
function HeaderBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center w-9 h-9 bg-white/15 hover:bg-white/30
                 border border-white/20 rounded-lg transition-colors text-white">
      {children}
    </button>
  );
}

// ── Tab icons ─────────────────────────────────────────────────────────────────
function ChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0
           0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0
           0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function StudentsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7
           20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0
           0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function TeacherIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function ConfigIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94
           3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724
           1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426
           1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724
           1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31
           2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9
           5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3
           4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function HolidayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0
           00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function FraudIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
           001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}
function ReportsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6M4 21h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0
           00-1 1v15a1 1 0 001 1z" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15
           10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
