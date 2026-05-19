import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

function todayStr()      { return new Date().toISOString().split('T')[0]; }
function monthStart(d)   { return d.slice(0, 7) + '-01'; }

const TEMPLATES = [
  {
    key:         'daily_summary',
    name:        'Daily Summary',
    icon:        '📅',
    description: 'Complete picture for a single school day — student counts by class and teacher check-ins.',
    rangeType:   'single',
  },
  {
    key:         'period_report',
    name:        'Attendance Period Report',
    icon:        '📊',
    description: 'Multi-day trend analysis — daily counts, class breakdown, and most-frequent absentees.',
    rangeType:   'range',
  },
  {
    key:         'staff_report',
    name:        'Staff Attendance Report',
    icon:        '👩‍🏫',
    description: 'Period-level attendance and punctuality for every teaching staff member.',
    rangeType:   'range',
  },
];

// ── Modal ─────────────────────────────────────────────────────────────────────

function ReportModal({ onClose }) {
  const today = todayStr();
  const [step,        setStep]        = useState(1); // 1=choose, 2=config, 3=preview
  const [template,    setTemplate]    = useState(null);
  const [start,       setStart]       = useState(today);
  const [end,         setEnd]         = useState(today);
  const [schoolName,  setSchoolName]  = useState('Lekki Peculiar School');
  const [generating,  setGenerating]  = useState(false);
  const [pdfUrl,      setPdfUrl]      = useState(null);
  const [pdfFilename, setPdfFilename] = useState('report.pdf');
  const urlRef = useRef(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  function pickTemplate(tpl) {
    setTemplate(tpl);
    if (tpl.rangeType === 'single') {
      setEnd(today);
      setStart(today);
    } else {
      setStart(monthStart(today));
      setEnd(today);
    }
    setStep(2);
  }

  async function handleGenerate() {
    setGenerating(true);
    setPdfUrl(null);
    try {
      const resp = await api.post(
        '/api/admin/reports/generate',
        {
          template:   template.key,
          date_range: { start, end },
          options:    { school_name: schoolName.trim() || 'Lekki Peculiar School' },
        },
        { responseType: 'blob', timeout: 60_000 },
      );
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      urlRef.current = url;
      const disp = resp.headers['content-disposition'] || '';
      const match = disp.match(/filename="?([^"]+)"?/);
      if (match) setPdfFilename(match[1]);
      setPdfUrl(url);
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate report';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href     = pdfUrl;
    a.download = pdfFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900">Generate Report</h2>
            <div className="flex items-center gap-1 text-xs">
              {['Choose', 'Configure', 'Preview'].map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </span>
                  <span className={step === i + 1 ? 'text-blue-700 font-semibold' : 'text-gray-400'}>{s}</span>
                  {i < 2 && <span className="text-gray-300 mx-1">›</span>}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Step 1 — Choose template */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Select the type of report you want to generate.</p>
              {TEMPLATES.map((tpl) => (
                <button key={tpl.key} onClick={() => pickTemplate(tpl)}
                  className="w-full text-left bg-white border-2 border-gray-200 hover:border-blue-400
                             hover:bg-blue-50 rounded-xl p-4 flex items-start gap-4 transition-all group">
                  <span className="text-3xl shrink-0">{tpl.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-blue-700">{tpl.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 ml-auto shrink-0 mt-0.5"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Configure */}
          {step === 2 && template && (
            <div className="space-y-5 max-w-md">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{template.icon}</span>
                <div>
                  <p className="font-bold text-gray-900">{template.name}</p>
                  <p className="text-xs text-gray-400">{template.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                {template.rangeType === 'single' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                    <input type="date" value={start} max={today}
                      onChange={(e) => { setStart(e.target.value); setEnd(e.target.value); }}
                      className={inputCls()} />
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                      <input type="date" value={start} max={end}
                        onChange={(e) => setStart(e.target.value)}
                        className={inputCls()} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                      <input type="date" value={end} min={start} max={today}
                        onChange={(e) => setEnd(e.target.value)}
                        className={inputCls()} />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">School Name on Report</label>
                  <input value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className={inputCls()} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Preview */}
          {step === 3 && pdfUrl && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Your PDF is ready. Preview it below or download it directly.
              </p>
              <iframe
                src={pdfUrl}
                title="Report Preview"
                className="w-full rounded-xl border border-gray-200 shadow-sm"
                style={{ height: '55vh' }}
              />
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => { if (step > 1) setStep(step - 1); else onClose(); }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <div className="flex gap-3">
            {step === 2 && (
              <button onClick={handleGenerate} disabled={generating}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {generating ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg> Generating…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg> Generate PDF</>
                )}
              </button>
            )}
            {step === 3 && (
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700
                           text-white text-sm font-semibold rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Download PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function inputCls() {
  return 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ReportsPanel({ isEmbedded = false }) {
  const [showModal, setShowModal] = useState(false);

  const content = (
    <div className="space-y-6">
      {!isEmbedded && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate insightful PDF reports for any time period.</p>
        </div>
      )}

      {/* Generate button */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200
                      rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow flex items-center justify-center text-3xl">
          📄
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">Generate a PDF Report</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Choose a template, set your date range, preview the report, and download it as a PDF.
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700
                     text-white font-semibold rounded-xl shadow transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v16m8-8H4" />
          </svg>
          New Report
        </button>
      </div>

      {/* Template cards */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Available Templates</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <div key={tpl.key}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer
                         hover:border-blue-300 hover:shadow-sm transition-all"
              onClick={() => setShowModal(true)}>
              <p className="text-2xl mb-2">{tpl.icon}</p>
              <p className="text-sm font-semibold text-gray-800">{tpl.name}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tpl.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
        <p className="font-semibold mb-1">About PDF Reports</p>
        <ul className="space-y-0.5 text-amber-600">
          <li>• Reports are generated as professional PDFs ready to share or print.</li>
          <li>• Daily Summary covers a single day; Period and Staff reports cover a date range.</li>
          <li>• Preview the report before downloading to confirm the content.</li>
        </ul>
      </div>

      {showModal && <ReportModal onClose={() => setShowModal(false)} />}
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
