import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  // State untuk mengontrol sidebar di HP
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const navItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Kelola Pekan', path: '/admin/pekan' },
    { name: 'Kelola Sesi', path: '/admin/sesi' },
    { name: 'Kelola Ruang', path: '/admin/ruang' },
    { name: 'Kelola User', path: '/admin/user' },
    { name: 'Kelola Paroki', path: '/admin/paroki' },
    { name: 'Laporan', path: '/admin/laporan' },
    { name: 'Backup Data', path: '/admin/backup' },
  ]

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Overlay Gelap untuk HP (Muncul saat sidebar terbuka) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 text-white transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:z-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-indigo-800">
          <h1 className="text-2xl font-bold">SAR Admin</h1>
          <p className="text-indigo-300 text-sm mt-1">Bpk. Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)} // Tutup sidebar saat diklik di HP
              className={`block px-4 py-3 rounded-lg transition ${
                location.pathname === item.path 
                  ? 'bg-indigo-700 text-white font-bold' 
                  : 'text-indigo-200 hover:bg-indigo-800'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-indigo-800">
          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-indigo-300 hover:text-white">
            Logout
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Mobile (Hanya muncul di HP) */}
        <header className="md:hidden bg-white shadow-sm p-4 flex items-center justify-between z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 text-2xl">
            ☰
          </button>
          <h2 className="font-bold text-gray-800">Sistem Antrian</h2>
          <div className="w-8"></div> {/* Spacer agar judul di tengah */}
        </header>

        {/* Area Konten yang bisa di-scroll */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}