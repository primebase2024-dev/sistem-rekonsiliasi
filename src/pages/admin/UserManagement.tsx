import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Profile {
  id: string
  full_name: string
  email?: string
  role: string
  is_active?: boolean // Ditambahkan untuk fitur nonaktifkan
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
  
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState('')

  // State baru untuk Edit User & Reset Password
  const [processing, setProcessing] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({ role: '', is_active: true })

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData()
    }
  }, [profile])

  async function fetchData() {
    setLoading(true)
    
    // 1. Ambil user aktif (tambahkan is_active)
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active') 
      .eq('tenant_id', profile?.tenant_id)
      .order('full_name')

    if (usersError) console.error('Error fetching users:', usersError)

    // 2. Ambil undangan
    const { data: invitesData, error: invitesError } = await supabase
      .from('user_invites')
      .select('*') 
      .eq('tenant_id', profile?.tenant_id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    if (invitesError) console.error('Error fetching invites:', invitesError)

    setUsers(usersData || [])
    setInvites(invitesData || [])
    setLoading(false)
  }

  function getInviterName(inviterId: string | undefined) {
    if (!inviterId) return 'Sistem / Data Lama'
    const inviter = users.find(u => u.id === inviterId)
    return inviter ? inviter.full_name : 'Admin (ID tidak dikenal)'
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return

    setInviteLoading(true)
    setInviteResult(null)

    try {
      const { error: dbError } = await supabase
        .from('user_invites')
        .insert({
          email: inviteData.email,
          full_name: inviteData.full_name,
          role: inviteData.role,
          tenant_id: profile.tenant_id,
          invited_by: profile.id,
          status: 'PENDING'
        })

      if (dbError) throw new Error(dbError.message)

      const registerUrl = `${window.location.origin}/register`
      const message = `Salve *${inviteData.full_name}*,\n\nAnda diundang untuk menjadi *${inviteData.role}* di Sistem Antrian Rekonsiliasi.\n\nSilakan lakukan pendaftaran menggunakan email ini: \n *${inviteData.email}*\n\nLink Pendaftaran:\n*${registerUrl}*\n\n Selamat melayani. Berkah Dalem.`

      setInviteResult(message)

      try {
        await navigator.clipboard.writeText(message)
        setCopyStatus('Pesan Tersalin!')
        setTimeout(() => setCopyStatus(''), 2000)
      } catch (err) {
        console.log('Gagal auto-copy')
      }

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

  // --- FITUR BARU: RESET PASSWORD ---
  async function handleResetPassword(email: string, fullName: string) {
    if (!email) {
      alert('User ini tidak memiliki email yang terdaftar.')
      return
    }
    if (!confirm(`Kirim link reset password ke email ${email} untuk ${fullName}?\n\nPetunjuk: Buka inbox email tersebut, klik linknya, dan buat password baru.`)) return
    
    setProcessing(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`, // Akan mengarah ke halaman dengan hash reset dari Supabase
      })
      
      if (error) throw error
      
      alert(`✅ Berhasil!\n\nLink reset password telah dikirim ke ${email}.\nSilakan cek inbox/spam email tersebut untuk mengatur password baru.`)
    } catch (err: any) {
      alert('Gagal mengirim link reset: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // --- FITUR BARU: UPDATE ROLE & STATUS ---
  async function handleUpdateUser(userId: string) {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: editFormData.role,
          is_active: editFormData.is_active
        })
        .eq('id', userId)

      if (error) throw error
      
      alert('Data petugas berhasil diperbarui!')
      setEditingUserId(null)
      fetchData()
    } catch (err: any) {
      alert('Gagal memperbarui data: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  function handleCopyLink(text: string) {
    navigator.clipboard.writeText(text)
    setCopyStatus('Pesan Tersalin!')
    setTimeout(() => setCopyStatus(''), 2000)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800 border-red-200'
      case 'PETUGAS_PINTU': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'PETUGAS_RUANG': return 'bg-green-100 text-green-800 border-green-200'
      case 'DISPLAY': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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
        <strong>Cara Kerja:</strong> Masukkan Nama dan Email petugas. Sistem akan menyimpan data undangan dan menyalin <strong>Pesan Undangan Lengkap</strong> ke clipboard Anda.
      </div>

      {/* --- HASIL UNDANGAN --- */}
      {inviteResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">✅</div>
            <div>
              <h3 className="text-lg font-bold text-green-900">Undangan Berhasil Disimpan!</h3>
              <p className="text-sm text-green-700 mt-1">Pesan di bawah ini telah otomatis disalin. Silakan tempel (paste) di WhatsApp.</p>
            </div>
          </div>
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

      {/* --- FORM UNDANGAN --- */}
      {showInviteForm && !inviteResult && (
        <form onSubmit={handleInvite} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Undangan Petugas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap Petugas <span className="text-red-500">*</span></label>
              <input
                required type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Contoh: Budi Santoso"
                value={inviteData.full_name}
                onChange={e => setInviteData({...inviteData, full_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Email <span className="text-red-500">*</span></label>
              <input
                required type="email"
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
              type="submit" disabled={inviteLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 min-w-[200px]"
            >
              {inviteLoading ? 'Memproses...' : '💾 Simpan & Salin Pesan'}
            </button>
          </div>
        </form>
      )}

      {/* --- TABEL UNDANGAN PENDING --- */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
            <h3 className="text-lg font-semibold text-yellow-800">Menunggu Pendaftaran ({invites.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] divide-y divide-gray-200">  
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {getInviterName(inv.invited_by)}
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

      {/* --- TABEL PETUGAS AKTIF (DITAMBAHKAN KOLOM AKSI) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Petugas Terdaftar di Paroki Ini</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{users.length} User</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Lengkap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada user aktif.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={`${u.is_active === false ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {u.full_name || '-'}
                      {u.is_active === false && <span className="ml-2 text-xs text-red-600 font-bold">(Nonaktif)</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === u.id ? (
                        <select
                          value={editFormData.role}
                          onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                        >
                          <option value="PETUGAS_PINTU">Petugas Pintu</option>
                          <option value="PETUGAS_RUANG">Petugas Ruang</option>
                          <option value="DISPLAY">Display</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getRoleColor(u.role)}`}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === u.id ? (
                        <select
                          value={editFormData.is_active ? 'active' : 'inactive'}
                          onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'active' })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="active">Aktif</option>
                          <option value="inactive">Nonaktif</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          u.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active !== false ? '✓ Aktif' : 'Nonaktif'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {editingUserId === u.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateUser(u.id)}
                            disabled={processing}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            disabled={processing}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingUserId(u.id)
                              setEditFormData({ role: u.role, is_active: u.is_active !== false })
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded text-xs font-medium transition"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleResetPassword(u.email || '', u.full_name)}
                            disabled={processing || !u.email}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-50"
                            title="Kirim link reset password ke email user"
                          >
                            🔑 Reset PW
                          </button>
                        </>
                      )}
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