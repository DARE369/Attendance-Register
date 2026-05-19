import { Link, useNavigate } from 'react-router-dom';
import crestLogo from '../assets/Picture1.png';

export default function AppHeader({ subtitle = 'Attendance Register', onSettings }) {
  const navigate = useNavigate();

  const admin = (() => {
    try { return JSON.parse(localStorage.getItem('admin') || '{}'); }
    catch { return {}; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/login', { replace: true });
  };

  return (
    <header className="text-white shadow-lg sticky top-0 z-40"
      style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-3 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
            <img src={crestLogo} alt="LPS crest" className="w-9 h-9 object-contain" />
          </div>
          <div className="hidden sm:block">
            <p className="font-bold text-base leading-tight tracking-wide">Lekki Peculiar School</p>
            <p className="text-blue-200 text-xs mt-0.5 font-medium">{subtitle}</p>
          </div>
        </Link>

        {/* Nav buttons */}
        <div className="flex items-center gap-1.5">
          <Link to="/scanner"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                       border border-white/20 rounded-lg text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m0 14v1M4 12h1m14 0h1" />
            </svg>
            <span className="hidden sm:inline">Scanner</span>
          </Link>
          <Link to="/import"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                       border border-white/20 rounded-lg text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0L8 8m4-4l4 4" />
            </svg>
            <span className="hidden md:inline">Import</span>
          </Link>
          <Link to="/templates"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                       border border-white/20 rounded-lg text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                   2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden lg:inline">Templates</span>
          </Link>
          {onSettings && (
            <button onClick={onSettings}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30
                         border border-white/20 rounded-lg text-sm font-semibold transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
                     00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                     .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="hidden lg:inline">Settings</span>
            </button>
          )}
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
  );
}
