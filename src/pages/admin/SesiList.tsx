import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Pekan {
  id_pekan: string
  kode_pekan: string
  nama_pekan: string
}

interface Sesi {
  id_sesi: string
  id_pekan: string
  hari: string
  tanggal: string
  sesi: string
  jam_mulai: string
  jam_selesai: string
  kapasitas_tunggu: number
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
}

export function SesiList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [pekanList, setPekanList] = useState<Pekan[]>([])
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedPekanId, setSelectedPekanId] = useState('')
  
  // State untuk Modal Transfer
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferSourceId, setTransferSourceId] = useState<string | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    id_pekan: '',
    hari: '',
    tanggal: '',
    sesi: '',
    jam_mulai: '',
    jam_selesai: '',
    kapasitas_tunggu: 5
  })

  useEffect(() => {
    fetchPekan()
    const pekanIdFromUrl = searchParams.get('pekan')
    if (pekanIdFromUrl) setSelectedPekanId(pekanIdFromUrl)
  }, [])

  useEffect(() => {
    if (selectedPekanId) fetchSesi(selectedPekanId)
    else setSesiList([])
  }, [selectedPekanId])

  async function fetchPekan() {
    const { data } = await supabase.from('rekonsiliasi_pekan').select('id_pekan, kode_pekan, nama_pekan').order('created_at', { ascending: false })
    if (data) setPekanList(data)
  }

  async function fetchSesi(id_pekan: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('rekonsiliasi_sesi')
      .select('*')
      .eq('id_pekan', id_pekan)
      .order('tanggal', { ascending: true })

    if (error) console.error('Error fetching sesi:', error)
    else setSesiList(data || [])
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('rekonsiliasi_sesi').insert([{
      ...formData,
      id_pekan: selectedPekanId,
      created_by: user?.id,
      status: 'DRAFT'
    }])

    if (error) alert('Gagal membuat sesi: ' + error.message)
    else {
      alert('Sesi berhasil dibuat!')
      setShowForm(false)
      setFormData({ id_pekan: selectedPekanId, hari: '', tanggal: '', sesi: '', jam_mulai: '', jam_selesai: '', kapasitas_tunggu: 5 })
      fetchSesi(selectedPekanId)
    }
  }
  // --- LOGIKA KONTROL STATUS SESI ---
  async function handleStatusChange(sesiId: string, newStatus: 'OPEN' | 'CLOSED') {
    const actionText = newStatus === 'OPEN' ? 'membuka' : 'menutup'
    if (!confirm(`Yakin ingin ${actionText} sesi ini?`)) return

    try {
      const { data, error } = await supabase.rpc('rpc_update_sesi_status', {
        p_id_sesi: sesiId,
        p_new_status: newStatus
      })

      if (error) throw error

      if (data.success) {
        alert(`Sesi berhasil ${newStatus === 'OPEN' ? 'dibuka' : 'ditutup'}!`)
        fetchSesi(selectedPekanId) // Refresh list
      } else {
        alert('Gagal mengubah status: ' + data.message)
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || err))
    }
  }
  // -----------------------------------
  // --- LOGIKA TRANSFER ---
  function openTransferModal(sesiId: string) {
    setTransferSourceId(sesiId)
    setTransferTargetId('')
    setShowTransferModal(true)
  }

  async function executeTransfer() {
    if (!transferSourceId || !transferTargetId) {
      alert('Pilih sesi tujuan terlebih dahulu!')
      return
    }
    if (transferSourceId === transferTargetId) {
      alert('Sesi sumber dan tujuan tidak boleh sama!')
      return
    }

    setTransferLoading(true)
    try {
      const { data, error } = await supabase.rpc('rpc_transfer_peserta', {
        p_id_sesi_sumber: transferSourceId,
        p_id_sesi_tujuan: transferTargetId
      })

      if (error) throw error

      if (data.success) {
        alert(`Berhasil memindahkan ${data.count} peserta ke sesi tujuan!`)
        setShowTransferModal(false)
        fetchSesi(selectedPekanId) // Refresh list
      } else {
        alert(data.message)
      }
    } catch (err: any) {
      alert('Gagal transfer: ' + (err.message || err))
    } finally {
      setTransferLoading(false)
    }
  }
  // -------------------------

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-gray-600">Kelola sesi rekonsiliasi untuk setiap pekan.</p>
        <button
          onClick={() => {
            if (!selectedPekanId) { alert('Pilih Pekan terlebih dahulu!'); return }
            setShowForm(!showForm)
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          {showForm ? 'Batal' : '+ Buat Sesi Baru'}
        </button>
      </div>

      {/* Filter Pekan */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter berdasarkan Pekan:</label>
        <select
          className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          value={selectedPekanId}
          onChange={(e) => setSelectedPekanId(e.target.value)}
        >
          <option value="">-- Pilih Pekan --</option>
          {pekanList.map((p) => (
            <option key={p.id_pekan} value={p.id_pekan}>{p.kode_pekan} - {p.nama_pekan}</option>
          ))}
        </select>
      </div>

      {/* Form Buat Sesi */}
      {showForm && selectedPekanId && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Form Sesi Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hari</label>
              <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Contoh: Sabtu" value={formData.hari} onChange={e => setFormData({...formData, hari: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
              <input required type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sesi</label>
              <input required type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Contoh: Sesi I" value={formData.sesi} onChange={e => setFormData({...formData, sesi: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kapasitas Tunggu</label>
              <input required type="number" min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={formData.kapasitas_tunggu} onChange={e => setFormData({...formData, kapasitas_tunggu: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai</label>
              <input required type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={formData.jam_mulai} onChange={e => setFormData({...formData, jam_mulai: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jam Selesai</label>
              <input required type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={formData.jam_selesai} onChange={e => setFormData({...formData, jam_selesai: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition">Simpan Sesi</button>
          </div>
        </form>
      )}
	<div className="w-full overflow-x-auto pb-4">
      {/* Tabel Daftar Sesi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-[600px]divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hari / Tanggal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sesi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kapasitas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat data...</td></tr>
            ) : sesiList.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada sesi untuk pekan ini.</td></tr>
            ) : (
              sesiList.map((sesi) => (
                <tr key={sesi.id_sesi} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{sesi.hari}</div>
                    <div className="text-sm text-gray-500">{new Date(sesi.tanggal).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sesi.sesi}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sesi.jam_mulai} - {sesi.jam_selesai}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{sesi.kapasitas_tunggu} orang</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      sesi.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                      sesi.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{sesi.status}</span>
                  </td>
					<td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
					  <button 
						onClick={() => navigate(`/admin/ruang?sesi=${sesi.id_sesi}`)}
						className="text-indigo-600 hover:text-indigo-900 font-semibold"
					  >
						Kelola Ruang →
					  </button>
					  
					  {sesi.status === 'DRAFT' && (
						<button 
						  onClick={() => handleStatusChange(sesi.id_sesi, 'OPEN')}
						  className="text-green-600 hover:text-green-900 font-semibold bg-green-50 px-2 py-1 rounded"
						  title="Aktifkan sesi ini"
						>
						  Buka Sesi
						</button>
					  )}
					  
					  {sesi.status === 'OPEN' && (
						<button 
						  onClick={() => handleStatusChange(sesi.id_sesi, 'CLOSED')}
						  className="text-red-600 hover:text-red-900 font-semibold bg-red-50 px-2 py-1 rounded"
						  title="Tutup sesi ini"
						>
						  Tutup Sesi
						</button>
					  )}
					  
					  <button 
						onClick={() => openTransferModal(sesi.id_sesi)}
						className="text-orange-600 hover:text-orange-900 font-semibold bg-orange-50 px-2 py-1 rounded"
						title="Pindahkan sisa antrian ke sesi lain"
					  >
						Transfer Sisa
					  </button>
					</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
	</div>
      {/* MODAL TRANSFER SESI */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Transfer Sisa Antrian</h3>
            <p className="text-sm text-gray-600">
              Pindahkan semua peserta yang belum dilayani (Waiting, Allocated, Called, Deferred) dari sesi ini ke sesi tujuan. 
              Status mereka akan direset menjadi <strong>WAITING</strong>.
            </p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Sesi Tujuan:</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
              >
                <option value="">-- Pilih Sesi Tujuan --</option>
                {sesiList
                  .filter(s => s.id_sesi !== transferSourceId) // Jangan tampilkan sesi sumber
                  .map((s) => (
                    <option key={s.id_sesi} value={s.id_sesi}>
                      {s.hari}, {new Date(s.tanggal).toLocaleDateString('id-ID')} - {s.sesi} ({s.jam_mulai})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                Batal
              </button>
              <button
                onClick={executeTransfer}
                disabled={transferLoading || !transferTargetId}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white font-bold rounded-lg transition flex items-center gap-2"
              >
                {transferLoading ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Memproses...</>
                ) : 'Ya, Pindahkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}