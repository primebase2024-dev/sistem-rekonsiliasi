import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Jika sudah login, langsung lempar ke Home
  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const [formData, setFormData] = useState({ email: '', password: '' })

  // Mode 1: Login dengan Password (Normal)
  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (error) {
      setMessage('❌ ' + error.message)
    } else {
      setMessage('✅ Login berhasil! Mengalihkan...')
      setTimeout(() => navigate('/'), 1000)
    }
    setLoading(false)
  }

  // Mode 2: Kirim Magic Link (Untuk user undangan yang belum set password / lupa password)
  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email: formData.email,
      options: {
        // Arahkan kembali ke Home setelah klik link di email
        emailRedirectTo: window.location.origin + '/' 
      }
    })

    if (error) {
      setMessage('❌ ' + error.message)
    } else {
      setMessage(`✅ Link berhasil dikirim ke ${formData.email}!\nSilakan cek email Anda dan klik link yang masuk.`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-700">SAR</h1>
          <h2 className="text-xl font-semibold text-gray-800 mt-2">Masuk ke Sistem</h2>
        </div>

        {/* Toggle Mode */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => { setMode('password'); setMessage('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              mode === 'password' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pakai Password
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic'); setMessage('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              mode === 'magic' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kirim Link Email
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm text-center whitespace-pre-line ${
            message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {message}
          </div>
        )}

        {/* Form Password */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                required type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                required type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        )}

        {/* Form Magic Link */}
        {mode === 'magic' && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              💡 <strong>Gunakan ini jika:</strong><br/>
              1. Anda baru diundang Admin dan belum mengatur password.<br/>
              2. Anda lupa password Anda.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Anda</label>
              <input
                required type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="contoh: nama@paroki.com"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition"
            >
              {loading ? 'Mengirim Email...' : 'Kirim Link Login ke Email'}
            </button>
          </form>
        )}

        <div className="text-center text-sm text-gray-600 pt-2 border-t">
          Belum punya akun? Hubungi Administrator Paroki Harapan Indah untuk diundang.
        </div>
      </div>
    </div>
  )
}