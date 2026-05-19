import { useState } from 'react';
import toast from 'react-hot-toast';
import { exportCSV } from '../services/api';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function mondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function sundayOfWeek(dateStr) {
  const d = new Date(mondayOfWeek(dateStr) + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function monthStart(dateStr) {
  return dateStr.slice(0, 7) + '-01';
}

function monthEnd(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function fmtDisplay(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return d; }
}

// ── Report type card ──────────────────────────────────────────────────────────
function ReportCard({ icon, title, description, onDownload, downloading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5
                    flex items-start gap-4">
      <div className="text-2xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button onClick={onDownload} disabled={downloading}
        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                   text-white text-xs font-semibold rounded-lg transition-colors
                   disabled:opacity-60 disabled:cursor-not-allowed">
        {downloading ? (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        )}
        Download CSV
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsPanel({ isEmbedded = false }) {
  const today = todayStr();
  const [customStart, setCustomStart] = useState(today);
  const [customEnd,   setCustomEnd]   = useState(today);
  const [downloading, setDownloading] = useState(null);

  async function download(date, label) {
    setDownloading(label);
    try {
      await exportCSV(date);
    } catch {
      toast.error('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadCustom() {
    if (!customStart || !customEnd) return toast.error('Select start and end dates');
    if (customStart > customEnd)    return toast.error('Start date must be before end date');
    // Download day-by-day: for simplicity, download just the start date
    // (a multi-day export would need a backend range endpoint)
    setDownloading('custom');
    try {
      await exportCSV(customStart);
      if (customStart !== customEnd) {
        toast(`Downloaded report for ${fmtDisplay(customStart)}. For multi-day reports, download each date separately.`,
          { duration: 6000 });
      }
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  }

  const mon = mondayOfWeek(today);
  const sun = sundayOfWeek(today);
  const mStart = monthStart(today);
  const mEnd   = monthEnd(today);

  const content = (
    <div className="space-y-6">
      {!isEmbedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">Download attendance data as CSV files</p>
        </div>
      )}

      {/* Quick downloads */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Downloads</h3>
        <div className="space-y-3">
          <ReportCard
            icon="📅"
            title="Today's Report"
            description={`Attendance for ${fmtDisplay(today)}`}
            onDownload={() => download(today, 'today')}
            downloading={downloading === 'today'}
          />
          <ReportCard
            icon="📆"
            title="This Week (Monday)"
            description={`Attendance for ${fmtDisplay(mon)} — current week start`}
            onDownload={() => download(mon, 'week')}
            downloading={downloading === 'week'}
          />
          <ReportCard
            icon="🗓️"
            title="This Month (1st)"
            description={`Attendance for ${fmtDisplay(mStart)} — current month start`}
            onDownload={() => download(mStart, 'month')}
            downloading={downloading === 'month'}
          />
        </div>
      </div>

      {/* Custom date range */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Custom Date</h3>
        <p className="text-xs text-gray-400 mb-4">
          Select a specific date to download its attendance report.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input type="date" value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              max={today}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={downloadCustom} disabled={!!downloading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-semibold rounded-lg transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed">
            {downloading === 'custom' ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
            )}
            Download
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-semibold mb-1">About CSV Reports</p>
        <ul className="space-y-0.5 text-blue-600">
          <li>• Each report contains all students with their arrival time, departure time, and status.</li>
          <li>• Reports can be opened in Microsoft Excel, Google Sheets, or any spreadsheet app.</li>
          <li>• For historical data, use the Analytics tab to view trends over time.</li>
        </ul>
      </div>
    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-md"
        style={{ background: 'linear-gradient(to right, #1a3a52, #2d5a7a)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">Reports</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">{content}</main>
    </div>
  );
}
