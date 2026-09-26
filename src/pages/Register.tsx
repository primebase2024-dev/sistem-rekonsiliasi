import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext' 

export function Register() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '' })
  
  // HAPUS: const [message, setMessage] = useState('') karena kita pakai alert

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  // Fungsi untuk mengecek apakah email punya undangan aktif
  async function checkInvitation(emailToCheck: string) {
    const { data, error } = await supabase
      .from('user_invites')
      .select('*')
      .eq('email', emailToCheck)
      .eq('status', 'PENDING')
      .maybeSingle() // Aman, tidak akan error jika data tidak ditemukan

    if (error) {
      console.error("Gagal mengecek undangan:", error)
      return null
    }
    return data // Mengembalikan data undangan jika ada, atau null jika tidak ada
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    // LANGKAH 1: CEK UNDANGAN DULU SEBELUM REGISTER
    const invite = await checkInvitation(formData.email)
    
    if (!invite) {
      // BLOKIR PROSES DI SINI!
      alert('❌ Email ini tidak memiliki undangan aktif.\n\nSilakan hubungi Admin Paroki untuk mendapatkan undangan terlebih dahulu.')
      setLoading(false)
      return // Hentikan eksekusi, jangan lanjut ke Supabase Auth
    }

    // LANGKAH 2: JIKA UNDANGAN ADA, LANJUTKAN REGISTER
    // PERBAIKAN: Hanya ambil 'error', buang 'data' agar tidak error TS6133
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name,
          tenant_id: invite.tenant_id, // <--- AMBIL DARI DATA UNDANGAN
          role: invite.role            // <--- AMBIL DARI DATA UNDANGAN
        }
      }
    })

    if (error) {
      alert('Gagal mendaftar: ' + error.message)
    } else {
      alert('✅ Registrasi berhasil! Silakan login.')
      navigate('/login')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-700">SAR</h1>
          <h2 className="text-xl font-semibold text-gray-800 mt-2">Daftar Akun Petugas</h2>
          <p className="text-sm text-gray-500 mt-1">Gunakan email yang telah diundang oleh Admin</p>
        </div>

        {/* HAPUS: Blok message karena kita sudah pakai alert() */}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input
              required
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.full_name}
              onChange={e => setFormData({...formData, full_name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buat Password Baru</label>
            <input
              required
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition"
          >
            {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600">
          Sudah punya akun? <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">Login di sini</Link>
        </div>
      </div>
    </div>
  )
}