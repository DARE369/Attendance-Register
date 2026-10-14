import { useState, useEffect } from 'react';

const STORAGE_KEY = 'peculiar_recent_scans';
const MAX_SCANS   = 50;

function todayPrefix() {
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function loadTodayScans() {
  try {
    const today  = todayPrefix();
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Only keep scans from today — drop anything older automatically
    return parsed.filter((s) => (s.scanned_at || '').startsWith(today));
  } catch {
    return [];
  }
}

export function usePersistentScans() {
  const [scans, setScans] = useState(loadTodayScans);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
    } catch {}
  }, [scans]);

  function addScan(result) {
    const stamped = { ...result, scanned_at: new Date().toISOString() };
    const today   = todayPrefix();
    setScans((prev) =>
      [stamped, ...prev]
        .filter((s) => (s.scanned_at || '').startsWith(today)) // always prune old days
        .slice(0, MAX_SCANS)
    );
  }

  function clearScans() {
    setScans([]);
  }

  return { scans, addScan, clearScans };
}
