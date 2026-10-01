import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Profile {
  id: string
  full_name: string
  email?: string
  role: string
}

interface Invite {
  id: string
  email: string
  full_name?: string
  role: string
  status: string
  created_at: string
  invited_by?: string
}

export function UserManagement() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteData, setInviteData] = useState({ full_name: '', email: '', role: 'PETUGAS_PINTU' })
  
  // State untuk menyimpan pesan lengkap yang akan di-copy
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData()
    }
  }, [profile])

  async function fetchData() {
    setLoading(true)
    
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role') 
      .eq('tenant_id', profile?.tenant_id)
      .order('full_name')

    if (usersError) console.error('Error fetching users:', usersError)

    const { data: invitesData, error: invitesError } = await supabase
      .from('user_invites')
      .select('*, profiles!invited_by(full_name)')
      .eq('tenant_id', profile?.tenant_id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    if (invitesError) console.error('Error fetching invites:', invitesError)

    setUsers(usersData || [])
    setInvites(invitesData || [])
    setLoading(false)
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return

    setInviteLoading(true)
    setInviteResult(null) // Reset hasil sebelumnya

    try {
      const { error: dbError } = await supabase
        .from('user_invites')
        .insert({
          email: inviteData.email,
          full_name: inviteData.full_name,
          role: inviteData.role,
          tenant_id: profile.tenant_id,
          invited_by: profile.id, // <--- TAMBAHKAN INI (ID Admin yang mengundang)
          status: 'PENDING'
        })

      if (dbError) throw new Error(dbError.message)

      // 1. Buat Link Pendaftaran
      const registerUrl = `${window.location.origin}/register`

      // 2. BUAT PESAN LENGKAP DI SINI (Tempat meletakkan variabel message)
      const message = `Salve  *${inviteData.full_name}*,\n\nAnda diundang untuk menjadi *${inviteData.role}* di Sistem Antrian Rekonsiliasi.\n\nSilakan lakukan pendaftaran menggunakan email ini: \n *${inviteData.email}*\n\nLink Pendaftaran:\n*${registerUrl}*\n\n Selamat melayani. Berkah Dalem. `

      // 3. Simpan pesan ke state untuk ditampilkan di UI
      setInviteResult(message)

      // 4. Otomatis salin PESAN LENGKAP ke clipboard
      try {
        await navigator.clipboard.writeText(message)
        setCopyStatus('Pesan Tersalin!')
        setTimeout(() => setCopyStatus(''), 2000)
      } catch (err) {
        console.log('Gagal auto-copy, user bisa klik tombol salin manual.')
      }

      // Reset form
      setInviteData({ full_name: '', email: '', role: 'PETUGAS_PINTU' })
      fetchData()
      
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setInviteLoading(false)
    }
  }

  async function deleteInvite(id: string) {
    if (!confirm('Batalkan undangan ini?')) return
    await supabase.from('user_invites').delete().eq('id', id)
    fetchData()
  }

  function handleCopyLink(text: string) {
    navigator.clipboard.writeText(text)
    setCopyStatus('Pesan Tersalin!')
    setTimeout(() => setCopyStatus(''), 2000)
  }

  if (loading) return <div className="text-center py-10 text-gray-500">Memuat data...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Kelola User & Undangan</h2>
        <button
          onClick={() => { setShowInviteForm(!showInviteForm); setInviteResult(null) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          {showInviteForm ? 'Batal' : '+ Undang User Baru'}
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-700">
        <strong>Cara Kerja:</strong> Masukkan Nama dan Email petugas. Sistem akan menyimpan data undangan dan menyalin <strong>Pesan Undangan Lengkap</strong> ke clipboard Anda. Anda tinggal menempel (paste) pesan tersebut ke WhatsApp petugas.
      </div>

      {/* KOTAK HASIL UNDANGAN (Menampilkan Pesan Lengkap) */}
      {inviteResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">✅</div>
            <div>
              <h3 className="text-lg font-bold text-green-900">Undangan Berhasil Disimpan!</h3>
              <p className="text-sm text-green-700 mt-1">Pesan di bawah ini telah otomatis disalin. Silakan tempel (paste) di WhatsApp.</p>
            </div>
          </div>
          
          {/* Tampilan Pesan yang akan di-copy */}
          <div className="bg-white border border-green-300 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
              {inviteResult}
            </p>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={() => handleCopyLink(inviteResult)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              📋 {copyStatus || 'Salin Pesan'}
            </button>
          </div>
        </div>
      )}

      {/* FORM UNDANGAN */}
      {showInviteForm && !inviteResult && (
        <form onSubmit={handleInvite} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Undangan Petugas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap Petugas <span className="text-red-500">*</span></label>
              <input
                required
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Contoh: Budi Santoso"
                value={inviteData.full_name}
                onChange={e => setInviteData({...inviteData, full_name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Email <span className="text-red-500">*</span></label>
              <input
                required
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="contoh: budi@paroki.com"
                value={inviteData.email}
                onChange={e => setInviteData({...inviteData, email: e.target.value})}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role / Peran</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={inviteData.role}
                onChange={e => setInviteData({...inviteData, role: e.target.value})}
              >
                <option value="PETUGAS_PINTU">Petugas Pintu</option>
                <option value="PETUGAS_RUANG">Petugas Ruang</option>
                <option value="DISPLAY">Display (Layar TV)</option>
                <option value="ADMIN">Admin Paroki</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              disabled={inviteLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 min-w-[200px]"
            >
              {inviteLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </>
              ) : '💾 Simpan & Salin Pesan'}
            </button>
          </div>
        </form>
      )}

      {/* TABEL UNDANGAN PENDING */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
            <h3 className="text-lg font-semibold text-yellow-800">Menunggu Pendaftaran ({invites.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[700px] divide-y divide-gray-200">  
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Lengkap</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
				  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diundang Oleh</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.full_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inv.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">{inv.role}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(inv.created_at).toLocaleDateString('id-ID')}</td>
					<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"> {(inv as any).profiles?.full_name || '-'}
					</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => deleteInvite(inv.id)} className="text-red-600 hover:text-red-900 font-medium">Batalkan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABEL PETUGAS AKTIF */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Petugas Aktif di Paroki Ini</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[700px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Lengkap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada user aktif.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {u.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {u.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        u.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                        u.role === 'PETUGAS_PINTU' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'PETUGAS_RUANG' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}