import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function Home() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  
  const [passwordForm, setPasswordForm] = useState({ newPass: '', confirmPass: '' })
  const [passLoading, setPassLoading] = useState(false)
  const [passMessage, setPassMessage] = useState('')

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault()
    setPassMessage('')
    
    if (passwordForm.newPass.length < 6) {
      setPassMessage('❌ Password minimal 6 karakter.')
      return
    }
    if (passwordForm.newPass !== passwordForm.confirmPass) {
      setPassMessage('❌ Konfirmasi password tidak cocok.')
      return
    }

    setPassLoading(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass })
    setPassLoading(false)

    if (error) {
      setPassMessage(`❌ Gagal: ${error.message}`)
    } else {
      setPassMessage('✅ Password berhasil disimpan! Anda sekarang bisa login manual.')
      setPasswordForm({ newPass: '', confirmPass: '' })
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

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
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-8">
          
          {/* Kartu Atur Password (Hanya muncul jika user baru login via invite) */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border-l-4 border-yellow-400">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              🔐 Langkah Terakhir: Atur Password Anda
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Akun Anda sudah aktif. Silakan buat password agar Anda bisa login secara manual di lain waktu tanpa link email.
            </p>
            
            {passMessage && (
              <div className={`p-3 rounded-lg text-sm mb-4 ${passMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {passMessage}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password Baru (min. 6 karakter)</label>
                <input
                  type="password"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={passwordForm.newPass}
                  onChange={e => setPasswordForm({...passwordForm, newPass: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={passwordForm.confirmPass}
                  onChange={e => setPasswordForm({...passwordForm, confirmPass: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <button 
                  type="submit" 
                  disabled={passLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-2.5 rounded-lg transition"
                >
                  {passLoading ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Menu Grid Portal */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Pilih Portal Akses</h2>
            <p className="text-white/80">Silakan masuk sesuai peran Anda</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/admin/pekan" className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl">
              <div className="text-4xl mb-3">⚙️</div>
              <h3 className="text-xl font-bold text-white mb-1">Admin Portal</h3>
              <p className="text-white/70 text-sm">Kelola Pekan, Sesi, Ruang, dan User</p>
            </Link>

            <Link to="/pintu" className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl">
              <div className="text-4xl mb-3">🚪</div>
              <h3 className="text-xl font-bold text-white mb-1">Petugas Pintu</h3>
              <p className="text-white/70 text-sm">Daftarkan jemaat dan keluarkan nomor antrian</p>
            </Link>

            <Link to="/ruang" className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl">
              <div className="text-4xl mb-3">🛐</div>
              <h3 className="text-xl font-bold text-white mb-1">Petugas Ruang</h3>
              <p className="text-white/70 text-sm">Kelola antrian ruang pengakuan dan pelayanan</p>
            </Link>

            <Link to="/display" className="group bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/30 rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl">
              <div className="text-4xl mb-3">📺</div>
              <h3 className="text-xl font-bold text-white mb-1">Display TV</h3>
              <p className="text-white/70 text-sm">Tampilan layar realtime untuk jemaat</p>
            </Link>
          </div>

          {/* Footer */}
          <div className="text-center text-white/60 text-sm pt-4">
            <p>Sistem Antrian Rekonsiliasi © {new Date().getFullYear()}</p>
            <p className="mt-1">Dibuat untuk pelayanan penerimaan Sakramen Rekonsiliasi yang lebih tertib dan nyaman.</p>
          </div>
        </div>
      </main>
    </div>
  )
}