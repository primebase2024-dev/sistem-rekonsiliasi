import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const baseNavItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Kelola Pekan', path: '/admin/pekan' },
    { name: 'Kelola Sesi', path: '/admin/sesi' },
    { name: 'Kelola Ruang', path: '/admin/ruang' },
	{ name: 'Kelola User', path: '/admin/user' },
	{ name: 'Kelola Petugas', path: '/admin/petugas' },
  ]
  // Tambahkan menu "Kelola Paroki" HANYA jika role-nya ADMINISTRATOR
  const navItems = profile?.role === 'ADMINISTRATOR' 
    ? [{ name: 'Kelola Paroki', path: '/admin/paroki' }, ...baseNavItems]
    : baseNavItems
	
  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 border-b border-indigo-800">
          <h1 className="text-xl font-bold">SAR Admin</h1>
          <p className="text-xs text-indigo-300 mt-1">{profile?.full_name}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 rounded-lg transition ${
                  isActive 
                    ? 'bg-indigo-700 text-white font-semibold' 
                    : 'text-indigo-200 hover:bg-indigo-800'
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-indigo-800">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-indigo-300 hover:text-white hover:bg-indigo-800 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-800">
            {navItems.find(i => i.path === location.pathname)?.name || 'Admin'}
          </h2>
          <div className="text-sm text-gray-500">
            Mode: Development
          </div>
        </header>
        
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}