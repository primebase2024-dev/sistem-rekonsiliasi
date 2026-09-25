import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function Home() {
  const { user, profile, signOut } = useAuth()

  // Jika user baru saja login via magic link, kita bisa cek apakah mereka perlu set password
  // (Untuk simplifikasi, kita tampilkan form ini jika user sudah login)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBtn(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
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
    //navigate('/login')
  }
  
  async function handleInstall() {
    console.log("Tombol Install diklik. deferredPrompt ada?", !!deferredPrompt)
    
    if (deferredPrompt) {
      // Jika browser mendukung event install otomatis (Chrome Android/Desktop)
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
          setShowInstallBtn(false)
        }
        setDeferredPrompt(null)
      } catch (err) {
        console.error("Error saat install:", err)
      }
    } else {
      // Jika browser TIDAK mendukung event otomatis (Safari / Chrome Desktop tertentu)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      
      if (isSafari) {
        alert("📱 Cara Install di iPhone (Safari):\n\n1. Ketuk tombol 'Share' (ikon kotak dengan panah ke atas) di bagian bawah browser.\n2. Gulir ke bawah dan pilih 'Add to Home Screen' (Tambah ke Layar Utama).\n3. Ketuk 'Add' (Tambah).")
      } else {
        alert("💻 Cara Install di Desktop / Android:\n\n1. Lihat di pojok kanan atas address bar (bilah alamat URL).\n2. Cari ikon 'Install' (gambar layar komputer/HP dengan panah ke bawah ⬇️).\n3. Klik ikon tersebut, lalu pilih 'Install'.\n\n*Atau, jika di Android, banner 'Add to Home Screen' mungkin muncul otomatis di bagian bawah layar.*")
      }
    }
  }
  
  // --- KONDISI 1: USER BELUM LOGIN (Tampilan Publik) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-2xl w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-10 shadow-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Sistem Antrian Rekonsiliasi
          </h1>
          <p className="text-xl text-white/80 mb-8">
            Fratres sororesque a Deo dilecti, SAR ini dibangun untuk membantu pelayanan Sakramen Rekonsiliasi di paroki menjadi lebih tertib, nyaman, dan terorganisir.
          </p>
          
          {/* Hanya ada satu tombol utama: Masuk */}
          <div className="flex justify-center">
            <Link 
              to="/login" 
              className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-gray-100 transition shadow-lg text-lg"
            >
              Masuk ke Sistem
            </Link>
          </div>

          <div className="mt-8 text-white/60 text-sm space-y-1">
            <p>Sudah mendapat undangan dari Administrator Paroki Harapan Indah?</p>
            <p>
              Silakan login, lalu atur password Anda melalui menu di dashboard.
            </p>
            <p>
              Selamat melayani. Benedicti a Domino.
            </p>
          </div>
        </div>
        
        <div className="absolute bottom-6 text-white/40 text-xs">
          &copy; {new Date().getFullYear()} Sistem Antrian Rekonsiliasi. Dibuat untuk pelayanan Gereja.
        </div>
      </div>
    )
  }

  // --- KONDISI 2: USER SUDAH LOGIN (Tampilan Dashboard Portal) ---
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
	   {/* Tombol Install PWA */}
	  {showInstallBtn && (
		<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
		  <div className="flex items-center justify-between">
			<div>
			  <p className="font-bold text-yellow-800">📱 Install Aplikasi SAR</p>
			  <p className="text-sm text-yellow-700">Pasang di HP Anda untuk akses cepat seperti aplikasi biasa.</p>
			</div>
			<button
			  onClick={handleInstall}
			  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-lg transition whitespace-nowrap ml-4"
			>
			  Install
			</button>
		  </div>
		</div>
	  )}    

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
	  <div className="max-w-4xl w-full space-y-8">
     
          {/* Kartu Atur Password (Hanya muncul jika user baru login via invite) */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border-l-4 border-yellow-400">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              🔐 Atur Password Anda
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Akun Anda sudah aktif. Silakan buat password agar Anda bisa login secara manual di lain waktu.
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