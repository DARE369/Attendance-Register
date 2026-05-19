import { useState, useEffect } from 'react';

const STORAGE_KEY = 'peculiar_recent_scans';
const MAX_SCANS = 50;

export function usePersistentScans() {
  const [scans, setScans] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
    } catch {}
  }, [scans]);

  function addScan(result) {
    const stamped = { ...result, scanned_at: new Date().toISOString() };
    setScans((prev) => [stamped, ...prev].slice(0, MAX_SCANS));
  }

  function clearScans() {
    setScans([]);
  }

  return { scans, addScan, clearScans };
}
