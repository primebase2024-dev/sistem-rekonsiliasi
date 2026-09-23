import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Home() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Sistem Antrian Rekonsiliasi</h1>
            <p className="text-white/80 text-sm">Selamat datang, {profile?.full_name || 'Guest'}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Pilih Portal Akses
            </h2>
            <p className="text-xl text-white/80">
              Silakan masuk sesuai peran Anda
            </p>
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin */}
            <Link
              to="/admin/pekan"
              className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl"
            >
              <div className="text-5xl mb-4">️</div>
              <h3 className="text-2xl font-bold text-white mb-2">Admin Portal</h3>
              <p className="text-white/70">
                Kelola Pekan, Sesi, Ruang, dan Transfer Antrian
              </p>
              <div className="mt-4 text-indigo-200 group-hover:text-white font-medium">
                Akses →
              </div>
            </Link>

            {/* Petugas Pintu */}
            <Link
              to="/pintu"
              className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl"
            >
              <div className="text-5xl mb-4">🚪</div>
              <h3 className="text-2xl font-bold text-white mb-2">Petugas Pintu</h3>
              <p className="text-white/70">
                Daftarkan jemaat dan keluarkan nomor antrian
              </p>
              <div className="mt-4 text-indigo-200 group-hover:text-white font-medium">
                Akses →
              </div>
            </Link>

            {/* Petugas Ruang */}
            <Link
              to="/ruang"
              className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl"
            >
              <div className="text-5xl mb-4">🛐</div>
              <h3 className="text-2xl font-bold text-white mb-2">Petugas Ruang</h3>
              <p className="text-white/70">
                Kelola antrian ruang pengakuan dan pelayanan
              </p>
              <div className="mt-4 text-indigo-200 group-hover:text-white font-medium">
                Akses →
              </div>
            </Link>

            {/* Display */}
            <Link
              to="/display"
              className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl"
            >
              <div className="text-5xl mb-4">📺</div>
              <h3 className="text-2xl font-bold text-white mb-2">Display TV</h3>
              <p className="text-white/70">
                Tampilan layar untuk jemaat (realtime)
              </p>
              <div className="mt-4 text-indigo-200 group-hover:text-white font-medium">
                Akses →
              </div>
            </Link>
          </div>

          {/* Info Footer */}
          <div className="mt-12 text-center text-white/60 text-sm">
            <p>Sistem Antrian Rekonsiliasi © {new Date().getFullYear()}</p>
          </div>
        </div>
      </main>
    </div>
  )
}