import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Profile {
  id: string
  full_name: string
  email?: string // Kita akan join manual nanti jika perlu, atau pakai data dari auth
  role: string
}

interface Invite {
  id: string
  email: string
  role: string
  status: string
  created_at: string
}

export function UserManagement() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  
  const [inviteData, setInviteData] = useState({ email: '', role: 'PETUGAS_PINTU' })

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData()
    }
  }, [profile])

  async function fetchData() {
    setLoading(true)
    // 1. Ambil daftar user yang sudah aktif di paroki ini
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('tenant_id', profile?.tenant_id)
      .order('full_name')

    // 2. Ambil daftar undangan yang pending
    const { data: invitesData } = await supabase
      .from('user_invites')
      .select('*')
      .eq('tenant_id', profile?.tenant_id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    setUsers(usersData || [])
    setInvites(invitesData || [])
    setLoading(false)
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return

    try {
      // Panggil Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteData.email,
          full_name: 'Petugas Baru', // Bisa ditambahkan field nama di form nanti jika mau
          role: inviteData.role,
          tenant_id: profile.tenant_id
        }
      })

      if (fnError) throw new Error(fnError.message)
      if (!data.success) throw new Error(data.error)

      alert(`✅ Undangan berhasil!\n\nEmail otomatis telah dikirim ke ${inviteData.email}.\nMereka tinggal klik link di email untuk mendaftar.`)

      setShowInviteForm(false)
      setInviteData({ email: '', role: 'PETUGAS_PINTU' })
      fetchData()
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    }
  }

  async function deleteInvite(id: string) {
    if (!confirm('Batalkan undangan ini?')) return
    await supabase.from('user_invites').delete().eq('id', id)
    fetchData()
  }

  if (loading) return <div className="text-center py-10">Memuat data...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Kelola User & Undangan</h2>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          {showInviteForm ? 'Batal' : '+ Undang User Baru'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-700">
        <strong>Cara Kerja:</strong> Tambahkan email petugas di sini. Kemudian, beritahu petugas untuk mendaftar di halaman <code>/register</code> menggunakan email tersebut. Sistem akan otomatis memberikan Role dan Paroki yang sesuai!
      </div>

      {/* Form Undangan */}
      {showInviteForm && (
        <form onSubmit={handleInvite} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Undangan Petugas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Petugas</label>
              <input
                required
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="contoh: budi@paroki.com"
                value={inviteData.email}
                onChange={e => setInviteData({...inviteData, email: e.target.value})}
              />
            </div>
            <div>
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
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition">
              Buat Undangan
            </button>
          </div>
        </form>
      )}

      {/* Daftar Undangan Pending */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
            <h3 className="text-lg font-semibold text-yellow-800">Menunggu Pendaftaran ({invites.length})</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Undangan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inv.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">{inv.role}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(inv.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => deleteInvite(inv.id)} className="text-red-600 hover:text-red-900 font-medium">Batalkan</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daftar User Aktif */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Petugas Aktif di Paroki Ini</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Lengkap</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr><td colSpan={2} className="px-6 py-8 text-center text-gray-500">Belum ada user aktif.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.full_name || '-'}</td>
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
  )
}