import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { importStudentsCSV, importTeachersCSV } from '../services/api';
import AppHeader from '../components/AppHeader';

// ── Sample CSVs ───────────────────────────────────────────────────────────────

const STUDENT_SAMPLE =
  `student_id,full_name,class,parent_phone,parent_email\r\n` +
  `STU001,John Doe,Primary 3A,+2348012345678,john.doe@example.com\r\n` +
  `STU002,Jane Smith,Primary 3B,+2348087654321,jane.smith@example.com\r\n` +
  `STU003,Alice Johnson,Primary 4A,+2348011112222,alice.j@example.com\r\n`;

const TEACHER_SAMPLE =
  `full_name,staff_type,barcode_id,phone,email\r\n` +
  `Mrs. Funke Adeyemi,Teacher,TCH001,+2348012345678,funke@school.edu\r\n` +
  `Mr. Emeka Obi,Teacher,TCH002,+2348087654321,emeka@school.edu\r\n` +
  `Mrs. Ngozi Nwosu,Support Staff,TCH003,+2348011112222,ngozi@school.edu\r\n`;

function downloadSample(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Result summary ────────────────────────────────────────────────────────────

function ResultSummary({ result, keyField = 'student_id' }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
          <p className="text-xs font-semibold text-green-600 mt-1">Added</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
          <p className="text-xs font-semibold text-yellow-600 mt-1">Skipped</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{result.errors}</p>
          <p className="text-xs font-semibold text-red-600 mt-1">Errors</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">{result.total} rows processed</p>

      {result.details?.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {keyField === 'barcode_id' ? 'Barcode ID' : 'Student ID'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.details.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-gray-700">{d[keyField]}</td>
                    <td className="px-4 py-2.5">
                      {d.status === 'success' && (
                        <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                          ✓ Added
                        </span>
                      )}
                      {d.status === 'skipped' && (
                        <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold">
                          ⚠ Skipped — {d.reason}
                        </span>
                      )}
                      {d.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                          ✕ Error — {d.reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── File drop zone ────────────────────────────────────────────────────────────

function FileZone({ file, fileRef, onFileChange }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        CSV File <span className="text-red-500">*</span>
      </label>
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center
                   hover:border-blue-400 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0
                   01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ) : (
          <div>
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none"
                 stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0L8 8m4-4l4 4" />
            </svg>
            <p className="text-sm text-gray-500">
              <span className="text-blue-600 font-semibold">Choose a file</span> or drag it here
            </p>
            <p className="text-xs text-gray-400 mt-1">CSV only · max 5 MB</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} className="hidden" />
    </div>
  );
}

// ── Upload button ─────────────────────────────────────────────────────────────

function UploadBtn({ uploading, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={uploading || disabled}
      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700
                 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors
                 disabled:opacity-60 disabled:cursor-not-allowed">
      {uploading ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Uploading…
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0L8 8m4-4l4 4" />
          </svg>
          Upload
        </>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminBulkImport() {
  const [activeTab, setActiveTab] = useState('students');

  // Students state
  const studentFileRef  = useRef(null);
  const [studentFile,   setStudentFile]  = useState(null);
  const [studentUpload, setStudentUpload]= useState(false);
  const [studentResult, setStudentResult]= useState(null);
  const [studentError,  setStudentError] = useState(null);
  const [showStudentFmt, setShowStudentFmt] = useState(false);

  // Teachers state
  const teacherFileRef  = useRef(null);
  const [teacherFile,   setTeacherFile]  = useState(null);
  const [teacherUpload, setTeacherUpload]= useState(false);
  const [teacherResult, setTeacherResult]= useState(null);
  const [teacherError,  setTeacherError] = useState(null);
  const [showTeacherFmt, setShowTeacherFmt] = useState(false);

  // ── Student handlers ────────────────────────────────────────────────────────

  const handleStudentFile = (e) => {
    setStudentFile(e.target.files?.[0] ?? null);
    setStudentResult(null);
    setStudentError(null);
  };

  const handleStudentUpload = async () => {
    if (!studentFile) return toast.error('Please choose a CSV file');

    const formData = new FormData();
    formData.append('file', studentFile);

    setStudentUpload(true);
    setStudentResult(null);
    setStudentError(null);

    try {
      const { data } = await importStudentsCSV(formData);
      setStudentResult(data);
      if (data.inserted > 0) {
        toast.success(`${data.inserted} student${data.inserted !== 1 ? 's' : ''} imported`);
      } else {
        toast(`Import complete — ${data.skipped} skipped, ${data.errors} errors`, { icon: '⚠️' });
      }
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Upload failed. Please try again.';
      setStudentError(msg);
      toast.error(msg);
    } finally {
      setStudentUpload(false);
    }
  };

  const resetStudents = () => {
    setStudentFile(null);
    setStudentResult(null);
    setStudentError(null);
    if (studentFileRef.current) studentFileRef.current.value = '';
  };

  // ── Teacher handlers ────────────────────────────────────────────────────────

  const handleTeacherFile = (e) => {
    setTeacherFile(e.target.files?.[0] ?? null);
    setTeacherResult(null);
    setTeacherError(null);
  };

  const handleTeacherUpload = async () => {
    if (!teacherFile) return toast.error('Please choose a CSV file');

    const formData = new FormData();
    formData.append('file', teacherFile);

    setTeacherUpload(true);
    setTeacherResult(null);
    setTeacherError(null);

    try {
      const { data } = await importTeachersCSV(formData);
      setTeacherResult(data);
      if (data.inserted > 0) {
        toast.success(`${data.inserted} teacher${data.inserted !== 1 ? 's' : ''} imported`);
      } else {
        toast(`Import complete — ${data.skipped} skipped, ${data.errors} errors`, { icon: '⚠️' });
      }
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Upload failed. Please try again.';
      setTeacherError(msg);
      toast.error(msg);
    } finally {
      setTeacherUpload(false);
    }
  };

  const resetTeachers = () => {
    setTeacherFile(null);
    setTeacherResult(null);
    setTeacherError(null);
    if (teacherFileRef.current) teacherFileRef.current.value = '';
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader subtitle="Bulk Import" />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Tab switcher */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex gap-1">
          {[
            { id: 'students', label: 'Import Students' },
            { id: 'teachers', label: 'Import Teachers' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Students tab ───────────────────────────────────────────────────── */}
        {activeTab === 'students' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Bulk Import Students</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a CSV to add multiple students at once.
                </p>
              </div>

              <FileZone file={studentFile} fileRef={studentFileRef} onFileChange={handleStudentFile} />

              {studentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {studentError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <UploadBtn uploading={studentUpload} disabled={!studentFile} onClick={handleStudentUpload} />
                {(studentFile || studentResult) && (
                  <button onClick={resetStudents} disabled={studentUpload}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white
                               border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors
                               disabled:opacity-50">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {studentResult && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Import Results</h2>
                <ResultSummary result={studentResult} keyField="student_id" />
              </div>
            )}

            {/* Format card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Expected Format</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowStudentFmt((p) => !p)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                    {showStudentFmt ? 'Hide' : 'Show'} Template
                  </button>
                  <button onClick={() => downloadSample(STUDENT_SAMPLE, 'sample_students.csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200
                               text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Sample
                  </button>
                </div>
              </div>

              {showStudentFmt && (
                <div className="mt-4 space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['student_id', 'full_name', 'class', 'parent_phone', 'parent_email'].map((c) => (
                            <th key={c} className="px-3 py-2 text-left text-xs font-semibold
                                                   text-gray-500 uppercase whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="px-3 py-2 font-mono text-gray-700">STU001</td>
                          <td className="px-3 py-2 text-gray-700">John Doe</td>
                          <td className="px-3 py-2 text-gray-700">Primary 3A</td>
                          <td className="px-3 py-2 font-mono text-gray-700">+2348012345678</td>
                          <td className="px-3 py-2 text-gray-700">john@parents.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• <code className="bg-gray-100 px-1 rounded">student_id</code> — alphanumeric, max 20 chars (e.g. STU001)</li>
                    <li>• <code className="bg-gray-100 px-1 rounded">class</code> — each student's class (optional; leave blank to omit class)</li>
                    <li>• <code className="bg-gray-100 px-1 rounded">parent_phone</code> — E.164 format (e.g. +2348012345678)</li>
                    <li>• class, phone, and email are optional; duplicate IDs are skipped</li>
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Teachers tab ───────────────────────────────────────────────────── */}
        {activeTab === 'teachers' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Bulk Import Teachers</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a CSV to add multiple teachers at once. Staff types must already exist in configuration.
                </p>
              </div>

              <FileZone file={teacherFile} fileRef={teacherFileRef} onFileChange={handleTeacherFile} />

              {teacherError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {teacherError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <UploadBtn uploading={teacherUpload} disabled={!teacherFile} onClick={handleTeacherUpload} />
                {(teacherFile || teacherResult) && (
                  <button onClick={resetTeachers} disabled={teacherUpload}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white
                               border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors
                               disabled:opacity-50">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {teacherResult && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Import Results</h2>
                <ResultSummary result={teacherResult} keyField="barcode_id" />
              </div>
            )}

            {/* Format card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Expected Format</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowTeacherFmt((p) => !p)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                    {showTeacherFmt ? 'Hide' : 'Show'} Template
                  </button>
                  <button onClick={() => downloadSample(TEACHER_SAMPLE, 'sample_teachers.csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200
                               text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Sample
                  </button>
                </div>
              </div>

              {showTeacherFmt && (
                <div className="mt-4 space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['full_name', 'staff_type', 'barcode_id', 'phone', 'email'].map((c) => (
                            <th key={c} className="px-3 py-2 text-left text-xs font-semibold
                                                   text-gray-500 uppercase whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="px-3 py-2 text-gray-700">Mrs. Funke Adeyemi</td>
                          <td className="px-3 py-2 text-gray-700">Teacher</td>
                          <td className="px-3 py-2 font-mono text-gray-700">TCH001</td>
                          <td className="px-3 py-2 font-mono text-gray-700">+2348012345678</td>
                          <td className="px-3 py-2 text-gray-700">funke@school.edu</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• <code className="bg-gray-100 px-1 rounded">staff_type</code> — must match an existing active staff type (e.g. Teacher, Support Staff)</li>
                    <li>• <code className="bg-gray-100 px-1 rounded">barcode_id</code> — alphanumeric, max 30 chars; duplicates are skipped</li>
                    <li>• Phone and email are optional</li>
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

      </main>
    </div>
  );
}
