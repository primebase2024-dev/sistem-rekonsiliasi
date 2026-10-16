import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Tenant {
  id: string
  nama_paroki: string
  created_at: string
  is_active?: boolean
  deleted_at?: string
}

export function TenantList() {
  useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [processing, setProcessing] = useState(false)
  
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
      .select('id, nama_paroki, created_at, is_active, deleted_at')
      .order('is_active', { ascending: true }) // Nonaktif di bawah
      .order('created_at', { ascending: false })
    
    if (!error && data) setTenants(data)
    setLoading(false)
  }

  async function handleCreateParoki(e: FormEvent) {
    e.preventDefault()
    setProcessing(true)

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
      setProcessing(false)
    }
  }

  // FUNGSI BARU: Nonaktifkan Paroki (Soft Delete)
  async function handleDeactivateTenant(id: string, nama_paroki: string) {
    if (!confirm(`️ PERINGATAN PENTING!\n\nAnda akan MENONAKTIFKAN Paroki "${nama_paroki}".\n\nDampak:\n• Semua user di paroki ini tidak bisa login\n• Paroki tidak akan muncul di dashboard\n• Data historis TETAP TERSIMPAN untuk audit\n\nLanjutkan?`)) return

    setProcessing(true)
    try {
      const { data, error } = await supabase.rpc('deactivate_tenant', { tenant_id: id })
      
      if (error) throw error
      if (!data.success) throw new Error(data.message)
      
      alert(`✅ ${data.message}`)
      fetchTenants()
    } catch (err: any) {
      alert('Gagal menonaktifkan paroki: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // FUNGSI BARU: Aktifkan Kembali Paroki
  async function handleActivateTenant(id: string, nama_paroki: string) {
    if (!confirm(`Aktifkan kembali Paroki "${nama_paroki}"?\n\nCatatan: User di paroki ini tetap nonaktif sampai diaktifkan manual satu per satu.`)) return

    setProcessing(true)
    try {
      const { data, error } = await supabase.rpc('activate_tenant', { tenant_id: id })
      
      if (error) throw error
      if (!data.success) throw new Error(data.message)
      
      alert(`✅ ${data.message}`)
      fetchTenants()
    } catch (err: any) {
      alert('Gagal mengaktifkan paroki: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // FUNGSI BARU: Hard Delete (Hanya untuk paroki yang benar-benar kosong)
  async function handleHardDeleteTenant(id: string, nama_paroki: string) {
    // Validasi ekstra keras
    const confirmationText = `HAPUS PERMANEN`
    const userInput = prompt(
      `🚨 INI ADALAH OPERASI BERBAHAYA! 🚨\n\n` +
      `Anda akan MENGHAPUS PERMANEN Paroki "${nama_paroki}" beserta SEMUA datanya.\n\n` +
      `Tindakan ini TIDAK DAPAT DIBATALKAN.\n\n` +
      `Ketik "${confirmationText}" (tanpa tanda kutip) untuk konfirmasi:`
    )

    if (userInput !== confirmationText) {
      alert('Operasi dibatalkan.')
      return
    }

    setProcessing(true)
    try {
      // Cek dulu apakah paroki ini benar-benar kosong
      const { data: stats } = await supabase.rpc('check_tenant_usage', { tenant_id: id })
      
      if (stats && (stats as any).has_data) {
        throw new Error(
          `Paroki masih memiliki data:\n` +
          `- ${stats.sessions || 0} sesi\n` +
          `- ${stats.users || 0} user\n` +
          `- ${stats.participants || 0} peserta\n\n` +
          `Nonaktifkan paroki terlebih dahulu, atau hapus semua data manual.`
        )
      }

      const { error } = await supabase.from('tenants').delete().eq('id', id)
      if (error) throw error
      
      alert(`Paroki "${nama_paroki}" berhasil dihapus permanen.`)
      fetchTenants()
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message)
    } finally {
      setProcessing(false)
    }
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
            <button type="submit" disabled={processing} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium transition">
              {processing ? 'Memproses...' : 'Daftarkan Paroki & Kirim Undangan'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Daftar Paroki</h3>
          <div className="text-sm text-gray-500">
            Total: {tenants.length} | Aktif: {tenants.filter(t => t.is_active !== false).length} | Nonaktif: {tenants.filter(t => t.is_active === false).length}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Paroki</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Dibuat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenants.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Belum ada paroki yang terdaftar.</td></tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className={t.is_active === false ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {t.nama_paroki}
                      {t.is_active === false && <span className="ml-2 text-xs text-red-600 font-normal">(Dinonaktifkan)</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(t.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {t.is_active === false ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Nonaktif
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {t.is_active === false ? (
                        // Tombol untuk paroki nonaktif
                        <>
                          <button 
                            onClick={() => handleActivateTenant(t.id, t.nama_paroki)} 
                            disabled={processing}
                            className="text-green-700 hover:text-green-900 font-medium bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded transition disabled:opacity-50"
                          >
                            ✓ Aktifkan Kembali
                          </button>
                          <button 
                            onClick={() => handleHardDeleteTenant(t.id, t.nama_paroki)} 
                            disabled={processing}
                            className="text-red-700 hover:text-red-900 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition disabled:opacity-50"
                            title="Hapus permanen (hanya untuk paroki kosong)"
                          >
                            🗑️ Hapus Permanen
                          </button>
                        </>
                      ) : (
                        // Tombol untuk paroki aktif
                        <button 
                          onClick={() => handleDeactivateTenant(t.id, t.nama_paroki)} 
                          disabled={processing}
                          className="text-amber-700 hover:text-amber-900 font-medium bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded transition disabled:opacity-50"
                        >
                          ⏸ Nonaktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>ℹ️ Penting:</strong> Tombol "Hapus Paroki" telah diganti menjadi "Nonaktifkan" untuk keamanan data. 
          Paroki yang dinonaktifkan tidak bisa digunakan lagi, tapi data historisnya tetap tersimpan untuk keperluan audit dan laporan.
        </p>
      </div>
    </div>
  )
}