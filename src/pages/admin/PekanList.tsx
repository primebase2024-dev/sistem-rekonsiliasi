import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Pekan {
  id_pekan: string
  kode_pekan: string
  nama_pekan: string
  nama_paroki: string
  tgl_mulai: string
  tgl_selesai: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
}

export function PekanList() {
  const { user, profile } = useAuth() 
  const navigate = useNavigate()
  const [namaParokiOtomatis, setNamaParokiOtomatis] = useState('Memuat...')
  const [pekanList, setPekanList] = useState<Pekan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  const [formData, setFormData] = useState({
    kode_pekan: '',
    nama_pekan: '',
    nama_paroki: '',
    tgl_mulai: '',
    tgl_selesai: ''
  })

  useEffect(() => {
    fetchPekan()
  }, [])
  
  useEffect(() => {
    if (profile?.tenant_id) {
      supabase
        .from('tenants')
        .select('nama_paroki')
        .eq('id', profile.tenant_id)
        .single()
        .then(({ data }) => {
          if (data) setNamaParokiOtomatis(data.nama_paroki)
        })
    }
  }, [profile])
  async function fetchPekan() {
    setLoading(true)
    const { data, error } = await supabase
      .from('rekonsiliasi_pekan')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pekan:', error)
    } else {
      setPekanList(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    
    const { error } = await supabase.from('rekonsiliasi_pekan').insert([
      {
        ...formData,
        created_by: user?.id,
        status: 'DRAFT'
      }
    ])

    if (error) {
      alert('Gagal membuat pekan: ' + error.message)
    } else {
      alert('Pekan berhasil dibuat!')
      setShowForm(false)
      setFormData({ kode_pekan: '', nama_pekan: '', nama_paroki: '', tgl_mulai: '', tgl_selesai: '' })
      fetchPekan()
    }
  }

  if (loading) return <div className="text-center py-10">Memuat data...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-gray-600">Kelola periode pekan rekonsiliasi.</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          {showForm ? 'Batal' : '+ Buat Pekan Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Pekan Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kode Pekan (Unik)</label>
              <input
                required
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Contoh: PRA-2026-01"
                value={formData.kode_pekan}
                onChange={e => setFormData({...formData, kode_pekan: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pekan</label>
              <input
                required
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Contoh: Prapaskah 2026"
                value={formData.nama_pekan}
                onChange={e => setFormData({...formData, nama_pekan: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Paroki</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                value={namaParokiOtomatis}
                disabled
                title="Nama paroki otomatis terisi sesuai akun Anda"
              />
              <p className="text-xs text-gray-500 mt-1">*Otomatis terisi berdasarkan paroki Anda</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                <input
                  required
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.tgl_mulai}
                  onChange={e => setFormData({...formData, tgl_mulai: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
                <input
                  required
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.tgl_selesai}
                  onChange={e => setFormData({...formData, tgl_selesai: e.target.value})}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Simpan Pekan
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Pekan / Paroki</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pekanList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Belum ada data pekan. Silakan buat baru.
                </td>
              </tr>
            ) : (
              pekanList.map((pekan) => (
                <tr key={pekan.id_pekan} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pekan.kode_pekan}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{pekan.nama_pekan}</div>
                    <div className="text-sm text-gray-500">{pekan.nama_paroki}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(pekan.tgl_mulai).toLocaleDateString('id-ID')} - {new Date(pekan.tgl_selesai).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      pekan.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                      pekan.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {pekan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => navigate(`/admin/sesi?pekan=${pekan.id_pekan}`)}
                      className="text-indigo-600 hover:text-indigo-900 font-semibold bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100 transition"
                    >
                      Kelola Sesi →
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