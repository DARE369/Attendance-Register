import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800
                    flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header band */}
          <div className="bg-blue-600 px-8 py-7 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477
                       3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5
                       1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477
                       4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746
                       0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Peculiar Register
              </h1>
            </div>
            <p className="text-blue-100 text-sm">Student Attendance System</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              Admin Sign In
            </h2>
            <LoginForm onSuccess={() => navigate('/scanner', { replace: true })} />
          </div>
        </div>

        <p className="text-center text-blue-200 text-xs mt-6">
          Peculiar School &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
