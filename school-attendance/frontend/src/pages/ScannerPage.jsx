import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ScannerInput from '../components/ScannerInput';
import ScanLog from '../components/ScanLog';
import { usePersistentScans } from '../hooks/usePersistentScans';
import { confirmScan } from '../services/api';
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
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function StatCard({ value, label, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
    </div>
  );
}

export default function ScannerPage() {
  const navigate = useNavigate();
  const clock    = useClock();
  const { scans, addScan, clearScans } = usePersistentScans();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileShowLog,     setMobileShowLog]     = useState(false);
  const [ambiguous,         setAmbiguous]         = useState(null);  // { barcode, matches }
  const [confirming,        setConfirming]         = useState(false);

  const admin = (() => {
    try { return JSON.parse(localStorage.getItem('admin') || '{}'); }
    catch { return {}; }
  })();

  const handleResult = (result) => {
    if (result.status === 'ambiguous') {
      setAmbiguous({
        barcode: result.matches?.[0]?.barcode,
        matches: result.matches || [],
      });
      return;
    }
    addScan(result);
  };

  const handleConfirm = async (personType) => {
    if (!ambiguous || confirming) return;
    setConfirming(true);
    try {
      const { data } = await confirmScan(ambiguous.barcode, personType);
      addScan({ ...data, id: Date.now() });
    } catch (err) {
      const msg = err.response?.data?.message || 'Confirm failed. Please try again.';
      addScan({ id: Date.now(), status: 'error', action: null, message: msg });
    } finally {
      setConfirming(false);
      setAmbiguous(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/login', { replace: true });
  };

  const today      = new Date().toISOString().split('T')[0];
  const todayScans = scans.filter((s) => (s.scanned_at || '').startsWith(today));
  const arrivals   = todayScans.filter((s) => s.status === 'success' && (s.action === 'arrival'  || s.action === 'check_in')).length;
  const departures = todayScans.filter((s) => s.status === 'success' && (s.action === 'departure' || s.action === 'check_out')).length;
  const errors     = todayScans.filter((s) => s.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="text-white shadow-lg shrink-0"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #2d5a7a 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <img src={crestLogo} alt="LPS crest" className="w-8 h-8 object-contain" />
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="font-bold text-sm">Lekki Peculiar School</p>
              <p className="text-blue-200 text-xs font-medium">Attendance Scanner</p>
            </div>
          </div>

          <div className="flex-1 text-center hidden md:block">
            <p className="font-mono text-lg font-bold tracking-widest">{formatClock(clock)}</p>
            <p className="text-blue-200 text-xs">{formatDate(clock)}</p>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button onClick={() => setMobileShowLog((v) => !v)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20
                         border border-white/20 rounded-lg text-sm font-semibold transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Log
            </button>

            {admin.role !== 'scanner' && (
              <Link to="/dashboard"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20
                           border border-white/20 rounded-lg text-sm font-semibold transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0
                       0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0
                       0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Link>
            )}

            {admin.username && (
              <span className="hidden lg:block text-sm text-blue-200">{admin.username}</span>
            )}

            <button onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500
                         rounded-lg text-sm font-semibold transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5">

        <div className="md:hidden text-center mb-4">
          <p className="font-mono text-xl font-bold text-gray-700 tracking-widest">{formatClock(clock)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(clock)}</p>
        </div>

        <div className="grid md:grid-cols-5 gap-5">

          <div className={`md:col-span-2 space-y-4 ${mobileShowLog ? 'hidden md:block' : ''}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Scanner
                </h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  ambiguous
                    ? 'text-amber-600 bg-amber-50 border-amber-200'
                    : 'text-green-600 bg-green-50 border-green-200'
                }`}>
                  {ambiguous ? 'Select Person' : 'Ready'}
                </span>
              </div>
              {/* paused=true while disambiguation modal is open */}
              <ScannerInput onResult={handleResult} paused={!!ambiguous} />
              <p className="text-xs text-gray-400 text-center mt-3">↵ Enter to submit scan</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard value={arrivals}   label="Arrivals"   color="text-green-600" bg="bg-green-50" />
              <StatCard value={departures} label="Departures" color="text-blue-600"  bg="bg-blue-50" />
              <StatCard value={errors}     label="Errors"     color="text-red-600"   bg="bg-red-50" />
            </div>
          </div>

          <div className={`md:col-span-3 ${!mobileShowLog ? 'hidden md:block' : ''}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-700">Recent Scans</h2>
                <div className="flex items-center gap-2">
                  {scans.length > 0 && (
                    <span className="text-xs text-gray-400">{scans.length} stored</span>
                  )}
                  {scans.length > 0 && (
                    <button onClick={clearScans}
                      className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                      Clear
                    </button>
                  )}
                  <button onClick={() => setMobileShowLog(false)}
                    className="md:hidden text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                    ← Scanner
                  </button>
                </div>
              </div>
              <ScanLog scans={scans} />
            </div>
          </div>
        </div>
      </main>

      {/* ── Disambiguation modal ──────────────────────────────────────────── */}
      {ambiguous && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">

            {/* Header */}
            <div className="flex items-start gap-4 mb-6 pb-5 border-b border-gray-100">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">Duplicate ID — confirm identity</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Card{' '}
                  <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                    {ambiguous.barcode}
                  </span>{' '}
                  is linked to two records. Tap the correct person.
                </p>
              </div>
            </div>

            {/* Person cards — stacked vertically for more room */}
            <div className="space-y-3 mb-5">
              {ambiguous.matches.map((match) => {
                const isTeacher = match.type === 'teacher';

                // Build the labeled fields for each type
                const fields = isTeacher
                  ? [
                      { label: 'Name',       value: match.name },
                      { label: 'Staff Type', value: match.staff_type || '—' },
                      { label: 'Phone',      value: match.phone || '—' },
                    ]
                  : [
                      { label: 'Name',  value: match.name },
                      { label: 'Class', value: match.class_name || '—' },
                      { label: 'ID',    value: match.barcode },
                    ];

                const accent      = isTeacher ? 'border-purple-400 bg-purple-50'       : 'border-blue-400 bg-blue-50';
                const accentHover = isTeacher ? 'hover:border-purple-500 hover:bg-purple-100' : 'hover:border-blue-500 hover:bg-blue-100';
                const badgeCls    = isTeacher ? 'bg-purple-100 text-purple-700'         : 'bg-blue-100 text-blue-700';
                const avatarCls   = isTeacher ? 'bg-purple-200 text-purple-700'         : 'bg-blue-200 text-blue-700';
                const btnCls      = isTeacher ? 'bg-purple-600 hover:bg-purple-700'     : 'bg-blue-600 hover:bg-blue-700';

                return (
                  <button
                    key={match.type}
                    onClick={() => handleConfirm(match.type)}
                    disabled={confirming}
                    className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl text-left
                                transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                                ${accent} ${accentHover}`}
                  >
                    {/* Avatar initials */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 font-bold text-lg ${avatarCls}`}>
                      {match.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>

                    {/* Fields */}
                    <div className="flex-1 min-w-0">
                      {/* Type badge */}
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1.5 ${badgeCls}`}>
                        {isTeacher ? 'STAFF' : 'STUDENT'}
                      </span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {fields.map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-none mb-0.5">{label}</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Select button / spinner */}
                    <div className={`shrink-0 px-4 py-2 rounded-lg text-white text-sm font-bold ${btnCls}`}>
                      {confirming
                        ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        : 'This is them'
                      }
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cancel */}
            <button
              onClick={() => setAmbiguous(null)}
              disabled={confirming}
              className="w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700
                         border border-gray-200 rounded-xl transition-colors disabled:opacity-50">
              Cancel — scan again
            </button>
          </div>
        </div>
      )}

      {/* ── Logout confirmation modal ──────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Confirm Logout</h3>
            <p className="text-sm text-gray-500">
              Are you sure you want to log out? The scanner will stop accepting scans.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border
                           border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleLogout}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600
                           hover:bg-red-700 rounded-lg transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
