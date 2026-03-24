import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError('Please enter an admin token.');
      return;
    }
    localStorage.setItem('adminToken', trimmed);
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">WP Order Bot</h1>
          <p className="mt-1 text-sm text-gray-500">Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">
              Admin Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError('');
              }}
              placeholder="Enter your admin token"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
