import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/menu', label: 'Menu', icon: '🍽️' },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col bg-gray-900 text-white">
        <div className="flex h-16 items-center border-b border-gray-700 px-6">
          <span className="text-lg font-semibold tracking-tight">WP Order Bot</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
