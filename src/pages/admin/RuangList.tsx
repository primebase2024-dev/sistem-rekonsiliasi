import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useSearchParams } from 'react-router-dom'

interface Sesi {
  id_sesi: string
  sesi: string
  hari: string
  tanggal: string
  nama_pekan: string
}

interface Ruang {
  id_ruang: string
  id_sesi: string
  nomor_ruang: number
  nama_ruang: string
  romo_nama: string
  petugas_nama: string
  status: string
  is_priority_room?: boolean
}

export function RuangList() {
  useAuth()
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [ruangList, setRuangList] = useState<Ruang[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedSesiId, setSelectedSesiId] = useState('')
  const [searchParams] = useSearchParams()
  
  const [formData, setFormData] = useState({
    id_sesi: '',
    nomor_ruang: 1,
    nama_ruang: '',
    romo_nama: '',
    petugas_nama: '',
    is_priority_room: false
  })

  useEffect(() => {
    fetchSesi()
  }, [])

  useEffect(() => {
    const sesiIdFromUrl = searchParams.get('sesi')
    if (sesiIdFromUrl) {
      setSelectedSesiId(sesiIdFromUrl)
    }
  }, [searchParams])

  async function fetchSesi() {
    const { data } = await supabase
      .from('rekonsiliasi_sesi')
      .select('id_sesi, sesi, hari, tanggal, rekonsiliasi_pekan(nama_pekan)')
      .order('tanggal', { ascending: false })
    
    if (data) {
      const flattened = data.map((item: any) => ({
        id_sesi: item.id_sesi,
        sesi: item.sesi,
        hari: item.hari,
        tanggal: item.tanggal,
        nama_pekan: item.rekonsiliasi_pekan?.nama_pekan || 'Unknown'
      }))
      setSesiList(flattened)
    }
  }

  async function fetchRuang(id_sesi: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('rekonsiliasi_ruang')
      .select('*')
      .eq('id_sesi', id_sesi)
      .order('nomor_ruang', { ascending: true })

    if (error) console.error('Error fetching ruang:', error)
    else setRuangList(data || [])
    
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    
    const { error } = await supabase.from('rekonsiliasi_ruang').insert([
      {
        nomor_ruang: formData.nomor_ruang,
        nama_ruang: formData.nama_ruang,
        romo_nama: formData.romo_nama,
        petugas_nama: formData.petugas_nama,
        id_sesi: selectedSesiId,
        status: 'OFFLINE',
        is_priority_room: formData.is_priority_room
      }
    ])

    if (error) {
      alert('Gagal membuat ruang: ' + error.message)
    } else {
      alert('Ruang berhasil ditambahkan!')
      setShowForm(false)
      setFormData({ 
        id_sesi: selectedSesiId, 
        nomor_ruang: Number(formData.nomor_ruang) + 1, 
        nama_ruang: '', 
        romo_nama: '', 
        petugas_nama: '',
        is_priority_room: false
      })
      fetchRuang(selectedSesiId)
    }
  }

  async function handleStatusChange(id_ruang: string, newStatus: string) {
    try {
      const { error } = await supabase.rpc('rpc_update_ruang_status', {
        p_id_ruang: id_ruang,
        p_new_status: newStatus
      })
      if (error) throw error
      if (selectedSesiId) fetchRuang(selectedSesiId)
    } catch (err: any) {
      alert('Gagal mengubah status: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-gray-600">Kelola ruang pengakuan untuk setiap sesi.</p>
        <div className="flex gap-2">
          <button
            onClick={() => { if (selectedSesiId) fetchRuang(selectedSesiId); }}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            🔄 Refresh Data
          </button>
          <button
            onClick={() => {
              if (!selectedSesiId) {
                alert('Pilih Sesi terlebih dahulu di filter atas!')
                return
              }
              setShowForm(!showForm)
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            {showForm ? 'Batal' : '+ Tambah Ruang'}
          </button>
        </div>
      </div>

      {/* Filter Sesi */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter berdasarkan Sesi:</label>
        <select
          className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          value={selectedSesiId}
          onChange={(e) => {
            setSelectedSesiId(e.target.value)
            if (e.target.value) fetchRuang(e.target.value)
          }}
        >
          <option value="">-- Pilih Sesi --</option>
          {sesiList.map((s) => (
            <option key={s.id_sesi} value={s.id_sesi}>
              {s.nama_pekan} - {s.hari}, {new Date(s.tanggal).toLocaleDateString('id-ID')} ({s.sesi})
            </option>
          ))}
        </select>
      </div>

      {/* Form Tambah Ruang */}
      {showForm && selectedSesiId && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Ruang Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Ruang</label>
              <input required type="number" min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={formData.nomor_ruang} onChange={e => setFormData({...formData, nomor_ruang: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Ruang</label>
              <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Contoh: Ruang St. Yosef" value={formData.nama_ruang} onChange={e => setFormData({...formData, nama_ruang: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Romo</label>
              <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Contoh: Romo Antonius" value={formData.romo_nama} onChange={e => setFormData({...formData, romo_nama: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Petugas</label>
              <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Contoh: Budi" value={formData.petugas_nama} onChange={e => setFormData({...formData, petugas_nama: e.target.value})} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <input 
              type="checkbox" 
              id="is_priority_room"
              checked={formData.is_priority_room}
              onChange={(e) => setFormData({...formData, is_priority_room: e.target.checked})}
              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
            />
            <label htmlFor="is_priority_room" className="text-sm font-medium text-gray-800 cursor-pointer select-none">
              Jadikan sebagai <span className="text-emerald-700 font-bold">Ruang Khusus Prioritas</span> (Lansia/Disabilitas)
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition">Simpan Ruang</button>
          </div>
        </form>
      )}

      {/* Tabel Daftar Ruang */}
      <div className="w-full overflow-x-auto pb-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-[800px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Ruang</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Ruang</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Romo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Petugas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe Ruang</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : ruangList.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada ruang untuk sesi ini.</td></tr>
              ) : (
                ruangList.map((ruang) => (
                  <tr key={ruang.id_ruang} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Ruang {ruang.nomor_ruang}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ruang.nama_ruang}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ruang.romo_nama}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ruang.petugas_nama}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ruang.is_priority_room ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ⭐ Prioritas
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Umum
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={ruang.status}
                        onChange={(e) => handleStatusChange(ruang.id_ruang, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                          ruang.status === 'READY' ? 'bg-green-100 text-green-800' :
                          ruang.status === 'SERVING' ? 'bg-blue-100 text-blue-800' :
                          ruang.status === 'PAUSE' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <option value="OFFLINE">OFFLINE</option>
                        <option value="READY">READY</option>
                        <option value="PAUSE">PAUSE</option>
                      </select>
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