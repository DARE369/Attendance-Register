import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import crestLogo from '../assets/Picture1.png';

// ── Sidebar nav content (shared between desktop + mobile drawer) ──────────────

function NavContent({ navGroups, activeId, onNav, expanded, onClose }) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
      {navGroups.map((group, gi) => (
        <div key={gi}>
          {(expanded || onClose) && group.label && (
            <p className={`px-4 pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-widest select-none
                          ${gi === 0 ? 'pt-2' : ''}`}>
              {group.label}
            </p>
          )}
          {!expanded && !onClose && gi > 0 && (
            <div className="my-2 mx-3 border-t border-gray-100" />
          )}
          {group.items.map((item) => {
            const isActive = !item.href && activeId === item.id;
            const baseCls = `
              relative flex items-center gap-3 rounded-lg mx-2 px-3 py-2.5 text-sm font-medium
              transition-all duration-150 cursor-pointer
              ${isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
            `;
            const inner = (
              <>
                {!expanded && !onClose && isActive && (
                  <span className="absolute left-0 top-1/4 h-1/2 w-0.5 rounded-r-full bg-blue-600" />
                )}
                <item.Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {(expanded || onClose) && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {item.href && (expanded || onClose) && (
                  <svg className="w-3 h-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </>
            );

            if (item.href) {
              return (
                <Link key={item.id} to={item.href} className={baseCls}
                  onClick={onClose}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={item.id} onClick={() => { onNav(item.id); onClose?.(); }}
                className={`w-full ${baseCls}`}>
                {inner}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ── Main AppShell ─────────────────────────────────────────────────────────────

export default function AppShell({ navGroups, activeId, onNav, statusSlot, children }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(() => window.innerWidth >= 1280);
  const [mobileOpen, setMobileOpen] = useState(false);

  const admin = (() => {
    try { return JSON.parse(localStorage.getItem('admin') || '{}'); }
    catch { return {}; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 sticky top-0 z-50 flex items-center px-3 sm:px-4 gap-3 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #2d5a7a 100%)' }}>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(true)}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
            <img src={crestLogo} alt="LPS" className="w-7 h-7 object-contain" />
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="font-bold text-sm">Lekki Peculiar School</p>
            <p className="text-blue-200 text-xs font-medium">Attendance Register</p>
          </div>
        </div>

        {/* Status slot */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          {statusSlot}
        </div>

        {/* User + logout */}
        <div className="flex items-center gap-2 shrink-0">
          {admin.username && (
            <span className="hidden md:block text-sm text-blue-200 font-medium max-w-[120px] truncate">
              {admin.username}
            </span>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500
                       rounded-lg text-xs sm:text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3
                   3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

        {/* Mobile backdrop */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden bg-black/50"
            onClick={() => setMobileOpen(false)} />
        )}

        {/* Mobile drawer */}
        <aside className={`
          fixed top-14 bottom-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col
          transform transition-transform duration-300 ease-in-out lg:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-sm font-bold text-gray-700">Menu</p>
            <button onClick={() => setMobileOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <NavContent navGroups={navGroups} activeId={activeId} onNav={onNav}
            expanded={true} onClose={() => setMobileOpen(false)} />
        </aside>

        {/* Desktop sidebar */}
        <aside className={`
          hidden lg:flex flex-col shrink-0 bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out overflow-hidden
          ${expanded ? 'w-60' : 'w-16'}
        `}>
          {/* Expand / collapse toggle */}
          <button onClick={() => setExpanded(!expanded)} title={expanded ? 'Collapse menu' : 'Expand menu'}
            className="flex items-center justify-center h-10 shrink-0 border-b border-gray-100
                       text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
            <svg className={`w-4 h-4 transition-transform duration-300 ${expanded ? '' : 'rotate-180'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <NavContent navGroups={navGroups} activeId={activeId} onNav={onNav}
            expanded={expanded} onClose={null} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
