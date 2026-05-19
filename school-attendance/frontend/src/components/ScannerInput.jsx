import { useRef, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { scanBarcode } from '../services/api';

const STATUS = { IDLE: 'idle', SCANNING: 'scanning', SUCCESS: 'success', ERROR: 'error' };


const MIN_BARCODE_LENGTH = 4;    // auto-submit once this many chars are present
const AUTO_SUBMIT_DELAY  = 50;   // ms of silence after last keystroke before submitting
const SCAN_COOLDOWN_MS   = 2000; // prevent client-side duplicate fires

function friendlyError(err) {
  const msg = err.response?.data?.error || '';
  if (msg.includes('Duplicate'))  return 'Already scanned — please wait 5 seconds';
  if (msg.includes('not found'))  return 'Unknown barcode. Please check and retry.';
  if (msg.includes('Database'))   return 'Database error. Please try again.';
  if (!err.response)              return 'Connection error. Is the server running?';
  return msg || 'Scan failed. Please try again.';
}

export default function ScannerInput({ onResult }) {
  const inputRef    = useRef(null);
  const timeoutRef  = useRef(null);
  const barcodeRef  = useRef('');   // mirrors barcode state for use inside the timeout
  const lastScanRef = useRef(0);    // timestamp of last submitted scan

  const [barcode, setBarcode] = useState('');
  const [status,  setStatus]  = useState(STATUS.IDLE);

  // ── Keep hidden input focused ─────────────────────────────────────────────
  const refocus = useCallback(() => {
    if (status !== STATUS.SCANNING) inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    refocus();
    document.addEventListener('click',   refocus);
    document.addEventListener('keydown', refocus);
    return () => {
      document.removeEventListener('click',   refocus);
      document.removeEventListener('keydown', refocus);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [refocus]);

  // ── Core scan logic ───────────────────────────────────────────────────────
  const doScan = useCallback(async (trimmed) => {
    if (!trimmed || status === STATUS.SCANNING) return;

    // Client-side cooldown prevents double-fire on slow networks
    if (Date.now() - lastScanRef.current < SCAN_COOLDOWN_MS) {
      toast.error('Already scanned — please wait 2 seconds');
      setBarcode('');
      barcodeRef.current = '';
      inputRef.current?.focus();
      return;
    }

    setStatus(STATUS.SCANNING);
    setBarcode('');
    barcodeRef.current = '';

    try {
      const { data } = await scanBarcode(trimmed);
      setStatus(STATUS.SUCCESS);
      lastScanRef.current = Date.now();
      onResult({ ...data, id: Date.now() });

      const action = data.action?.replace('_', ' ').toUpperCase() ?? '';
      const commentLabels = {
        early: 'early',
        late: 'late',
        on_time: 'on time',
        early_departure: 'early out',
        late_checkout: 'late checkout',
      };
      const badge = commentLabels[data.comments] ? ` (${commentLabels[data.comments]})` : '';
      toast.success(`${data.student_name} - ${action}${badge}`);
    } catch (err) {
      setStatus(STATUS.ERROR);
      const errorData = err.response?.data ?? {};
      const friendly  = friendlyError(err);
      onResult({
        id:      Date.now(),
        status:  'error',
        action:  null,
        error:   errorData.error ?? friendly,
        message: friendly,
      });
      toast.error(friendly);
    } finally {
      setTimeout(() => {
        setStatus(STATUS.IDLE);
        inputRef.current?.focus();
      }, 1500);
    }
  }, [status, onResult]);

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const value = e.target.value;
    barcodeRef.current = value;
    setBarcode(value);

    // Reset pending auto-submit on every keystroke
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // As soon as we have MIN_BARCODE_LENGTH chars, start a 50ms countdown.
    // If no new input arrives in that window, submit automatically.
    if (value.length >= MIN_BARCODE_LENGTH) {
      timeoutRef.current = setTimeout(() => {
        if (barcodeRef.current === value && value.trim()) {
          doScan(value.trim().toUpperCase());
        }
      }, AUTO_SUBMIT_DELAY);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const trimmed = barcode.trim();
    if (!trimmed || status === STATUS.SCANNING) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    doScan(trimmed.toUpperCase());
  };

  // ── Visual state ──────────────────────────────────────────────────────────
  const zoneStyle = {
    [STATUS.IDLE]:     'border-blue-400 bg-white animate-pulse-border',
    [STATUS.SCANNING]: 'border-blue-500 bg-blue-50',
    [STATUS.SUCCESS]:  'border-green-500 bg-green-50 animate-flash-green',
    [STATUS.ERROR]:    'border-red-400 bg-red-50 animate-flash-red',
  }[status];

  const cornerColor = {
    [STATUS.IDLE]:     'border-blue-500',
    [STATUS.SCANNING]: 'border-blue-600',
    [STATUS.SUCCESS]:  'border-green-500',
    [STATUS.ERROR]:    'border-red-500',
  }[status];

  const Icon = {
    [STATUS.IDLE]:     <ScanIcon />,
    [STATUS.SCANNING]: <Spinner />,
    [STATUS.SUCCESS]:  <CheckIcon />,
    [STATUS.ERROR]:    <XIcon />,
  }[status];

  const label = {
    [STATUS.IDLE]:     'Ready to Scan',
    [STATUS.SCANNING]: 'Processing…',
    [STATUS.SUCCESS]:  'Scan Recorded',
    [STATUS.ERROR]:    'Scan Failed',
  }[status];

  const sub = {
    [STATUS.IDLE]:     'Scan barcode or press ↵ Enter',
    [STATUS.SCANNING]: 'Please wait…',
    [STATUS.SUCCESS]:  '',
    [STATUS.ERROR]:    'Please try again',
  }[status];

  return (
    <div className="space-y-4">
      {/* Scan zone */}
      <div
        className={`scanner-zone border-2 h-56 ${zoneStyle}`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Corner brackets */}
        <span className={`corner top-3 left-3 border-t-4 border-l-4 rounded-tl-lg ${cornerColor}`} />
        <span className={`corner top-3 right-3 border-t-4 border-r-4 rounded-tr-lg ${cornerColor}`} />
        <span className={`corner bottom-3 left-3 border-b-4 border-l-4 rounded-bl-lg ${cornerColor}`} />
        <span className={`corner bottom-3 right-3 border-b-4 border-r-4 rounded-br-lg ${cornerColor}`} />

        {/* Invisible input — always captures keyboard */}
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-hidden="true"
          className="absolute opacity-0 w-px h-px pointer-events-none"
          tabIndex={-1}
        />

        <div className="mb-3">{Icon}</div>

        <p className={`text-2xl font-bold tracking-tight ${
          status === STATUS.SUCCESS ? 'text-green-700' :
          status === STATUS.ERROR   ? 'text-red-600'   :
          status === STATUS.SCANNING? 'text-blue-600'  :
          'text-gray-800'
        }`}>
          {label}
        </p>

        {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}

        {status === STATUS.IDLE && barcode.length > 0 && (
          <p className="text-xs text-blue-400 mt-2 tracking-widest animate-pulse">
            {'•'.repeat(Math.min(barcode.length, 12))}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ScanIcon() {
  return (
    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 4v1m0 14v1M4 12h1m14 0h1M6.343 6.343l.707.707M16.95
           16.95l.707.707M6.343 17.657l.707-.707M16.95 7.05l.707-.707M12
           8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-12 h-12 text-blue-600" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
      <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

function XIcon() {
  return (
    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
      <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}
