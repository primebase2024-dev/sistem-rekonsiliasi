import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Tenant {
  id: string
  nama_paroki: string
  created_at: string
}

export function TenantList() {
  useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  const [formData, setFormData] = useState({ 
    nama_paroki: '', 
    admin_email: '', 
    admin_name: '' 
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  async function fetchTenants() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .select('id, nama_paroki, created_at')
      .order('created_at', { ascending: false })
    
    if (!error && data) setTenants(data)
    setLoading(false)
  }

  async function handleCreateParoki(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Buat Paroki (Tenant) Baru
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert([{ nama_paroki: formData.nama_paroki }])
        .select()
        .single()

      if (tenantError) throw tenantError

      // 2. Panggil Edge Function untuk simpan undangan & kirim email
      const { data, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: formData.admin_email,
          full_name: formData.admin_name,
          role: 'ADMIN',
          tenant_id: tenantData.id
        }
      })

      if (fnError) throw new Error(fnError.message)
      if (!data.success) throw new Error(data.error)

      alert(`✅ BERHASIL!\n\nParoki "${formData.nama_paroki}" telah dibuat.\nEmail undangan otomatis telah dikirim ke ${formData.admin_email}.\n\nMereka tinggal klik link di email untuk membuat password.`)
      
      setShowForm(false)
      setFormData({ nama_paroki: '', admin_email: '', admin_name: '' })
      fetchTenants()
      
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteTenant(id: string) {
    if (!confirm('PERINGATAN: Menghapus paroki akan menghapus semua data sesi, ruang, dan user di paroki ini. Lanjutkan?')) return
    
    // Catatan: Di production, sebaiknya gunakan soft-delete atau cascade delete yang hati-hati
    const { error } = await supabase.from('tenants').delete().eq('id', id)
    if (error) alert('Gagal menghapus: ' + error.message)
    else fetchTenants()
  }

  if (loading && tenants.length === 0) return <div className="text-center py-10">Memuat data...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Kelola Paroki (Multi-Tenant)</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          {showForm ? 'Batal' : '+ Daftarkan Paroki & Admin Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateParoki} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Pendaftaran Paroki Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Paroki</label>
              <input
                required
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Contoh: Paroki Santo Yosef Sunter"
                value={formData.nama_paroki}
                onChange={e => setFormData({...formData, nama_paroki: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Admin Pertama</label>
              <input
                required
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="agus@gmail.com"
                value={formData.admin_email}
                onChange={e => setFormData({...formData, admin_email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap Admin</label>
              <input
                required
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Agus"
                value={formData.admin_name}
                onChange={e => setFormData({...formData, admin_name: e.target.value})}
              />
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
            ℹ️ Sistem akan otomatis membuat Paroki ini, dan mengunci email {formData.admin_email || '...'} sebagai ADMIN yang hanya bisa mengelola paroki ini.
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium transition">
              {loading ? 'Memproses...' : 'Daftarkan Paroki & Kirim Undangan'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Paroki</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Dibuat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tenants.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada paroki yang terdaftar.</td></tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{t.nama_paroki}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                      onClick={() => deleteTenant(t.id)} 
                      className="text-red-600 hover:text-red-900 font-medium bg-red-50 px-3 py-1 rounded"
                    >
                      Hapus Paroki
                    </button>
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