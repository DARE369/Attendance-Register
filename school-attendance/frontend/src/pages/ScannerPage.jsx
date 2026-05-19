import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ScannerInput from '../components/ScannerInput';
import ScanLog from '../components/ScanLog';
import { usePersistentScans } from '../hooks/usePersistentScans';
import crestLogo from '../assets/Picture1.png';

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatClock(date) {
  return date.toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

export default function ScannerPage() {
  const navigate    = useNavigate();
  const clock       = useClock();
  const { scans, addScan, clearScans }      = usePersistentScans();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const admin = (() => {
    try { return JSON.parse(localStorage.getItem('admin') || '{}'); }
    catch { return {}; }
  })();

  const handleResult = (result) => {
    addScan(result);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/login', { replace: true });
  };

  const today      = new Date().toISOString().split('T')[0];
  const todayScans = scans.filter((s) => (s.scanned_at || '').startsWith(today));
  const arrivals   = todayScans.filter((s) => s.status === 'success' && s.action === 'arrival').length;
  const departures = todayScans.filter((s) => s.status === 'success' && s.action === 'departure').length;
  const errors     = todayScans.filter((s) => s.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="text-white shadow-lg"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <img src={crestLogo} alt="LPS crest" className="w-8 h-8 object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-base leading-tight tracking-wide">Lekki Peculiar School</p>
              <p className="text-blue-200 text-xs font-medium">Attendance Register</p>
            </div>
          </div>

          {/* Center: Clock */}
          <div className="hidden sm:block text-center">
            <p className="font-mono text-xl font-bold tracking-widest">{formatClock(clock)}</p>
            <p className="text-blue-200 text-xs">{formatDate(clock)}</p>
          </div>

          {/* Right: Dashboard link + Admin + Logout */}
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20
                         rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1
                     1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Dashboard
            </Link>
            {admin.username && (
              <span className="hidden sm:block text-sm text-blue-200 ml-1">
                {admin.username}
              </span>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20
                         rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid md:grid-cols-5 gap-6">

        {/* Left panel: Scanner (2/5 width on md+) */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Connected" />
                Scanner
              </h2>
              <span className="text-xs font-semibold text-green-600 bg-green-50 border
                               border-green-200 px-2 py-0.5 rounded-full">
                Connected
              </span>
            </div>
            <ScannerInput onResult={handleResult} />
            <p className="text-xs text-gray-400 text-center mt-3">
              ↵ Enter to submit scan
            </p>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={arrivals}   label="Arrivals"   color="text-green-600" bg="bg-green-50" />
            <StatCard value={departures} label="Departures" color="text-blue-600"  bg="bg-blue-50" />
            <StatCard value={errors}     label="Errors"     color="text-red-600"   bg="bg-red-50" />
          </div>
        </div>

        {/* Right panel: Log (3/5 width on md+) */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-700">Recent Scans</h2>
              <div className="flex items-center gap-2">
                {scans.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {scans.length} stored
                  </span>
                )}
                {scans.length > 0 && (
                  <button onClick={clearScans}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <ScanLog scans={scans} />
          </div>
        </div>
      </main>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Confirm Logout</h3>
            <p className="text-sm text-gray-500">
              Are you sure you want to log out? The scanner will stop accepting scans.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border
                           border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600
                           hover:bg-red-700 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
    </div>
  );
}
