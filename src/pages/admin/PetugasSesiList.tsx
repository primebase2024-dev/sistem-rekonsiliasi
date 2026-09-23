import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Sesi {
  id_sesi: string
  sesi: string
  hari: string
  tanggal: string
}

interface Petugas {
  id: string
  full_name: string
  role: string
}

interface Assignment {
  id: string
  id_petugas: string
  role: string
}

export function PetugasSesiList() {
  const [searchParams] = useSearchParams()
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [selectedSesiId, setSelectedSesiId] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [availablePetugas, setAvailablePetugas] = useState<Petugas[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  
  const [formData, setFormData] = useState({
    id_petugas: '',
    role: 'PETUGAS_PINTU' as 'PETUGAS_PINTU' | 'PETUGAS_RUANG' | 'DISPLAY'
  })

  useEffect(() => {
    fetchSesiList()
    fetchPetugas()
  }, [])

  useEffect(() => {
    if (selectedSesiId) {
      fetchAssignments(selectedSesiId)
    }
  }, [selectedSesiId])

  async function fetchSesiList() {
    const { data } = await supabase
      .from('rekonsiliasi_sesi')
      .select('id_sesi, sesi, hari, tanggal')
      .eq('status', 'OPEN')
      .order('tanggal', { ascending: true })
    
    if (data) {
      setSesiList(data)
      const sesiFromUrl = searchParams.get('sesi')
      if (sesiFromUrl) setSelectedSesiId(sesiFromUrl)
      else if (data.length > 0) setSelectedSesiId(data[0].id_sesi)
    }
  }

  async function fetchPetugas() {
    console.log("🔍 [DEBUG] Mulai fetch petugas...")
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role') // HAPUS 'email' dari sini karena ada di auth.users
      .in('role', ['PETUGAS_PINTU', 'PETUGAS_RUANG', 'DISPLAY'])
      .order('full_name')
    
    if (error) {
      console.error("❌ [DEBUG] Error fetch petugas:", error)
    } else {
      console.log("✅ [DEBUG] Data petugas yang ditemukan:", data)
      setAvailablePetugas(data || [])
    }
  }

  async function fetchAssignments(id_sesi: string) {
    setLoading(true)
    const { data } = await supabase
      .from('rekonsiliasi_petugas_sesi')
      .select('id, id_petugas, role')
      .eq('id_sesi', id_sesi)
    
    if (data) setAssignments(data)
    setLoading(false)
  }

  async function handleAddPetugas(e: React.FormEvent) {
    e.preventDefault()
    
    const { error } = await supabase
      .from('rekonsiliasi_petugas_sesi')
      .insert([{
        id_sesi: selectedSesiId,
        id_petugas: formData.id_petugas,
        role: formData.role
      }])

    if (error) {
      alert('Gagal menambahkan petugas: ' + error.message)
    } else {
      alert('Petugas berhasil ditambahkan!')
      setShowAddForm(false)
      setFormData({ id_petugas: '', role: 'PETUGAS_PINTU' })
      fetchAssignments(selectedSesiId)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Hapus petugas dari sesi ini?')) return
    
    const { error } = await supabase
      .from('rekonsiliasi_petugas_sesi')
      .delete()
      .eq('id', id)
    
    if (error) alert('Gagal menghapus: ' + error.message)
    else fetchAssignments(selectedSesiId)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Kelola Petugas per Sesi</h2>
      </div>

      {/* Pilih Sesi */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Sesi:</label>
        <select
          className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          value={selectedSesiId}
          onChange={(e) => setSelectedSesiId(e.target.value)}
        >
          {sesiList.map((s) => (
            <option key={s.id_sesi} value={s.id_sesi}>
              {s.hari}, {new Date(s.tanggal).toLocaleDateString('id-ID')} - {s.sesi}
            </option>
          ))}
        </select>
      </div>

      {selectedSesiId && (
        <>
          {/* Daftar Petugas yang Ditugaskan */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Petugas yang Ditugaskan</h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                {showAddForm ? 'Batal' : '+ Tambah Petugas'}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddPetugas} className="p-6 border-b border-gray-200 bg-gray-50 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Petugas:</label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={formData.id_petugas}
                    onChange={(e) => setFormData({...formData, id_petugas: e.target.value})}
                  >
                    <option value="">-- Pilih Petugas --</option>
                    {availablePetugas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role untuk Sesi ini:</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  >
                    <option value="PETUGAS_PINTU">Petugas Pintu</option>
                    <option value="PETUGAS_RUANG">Petugas Ruang</option>
                    <option value="DISPLAY">Display</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium">
                    Simpan
                  </button>
                </div>
              </form>
            )}

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Petugas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center">Memuat...</td></tr>
                ) : assignments.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada petugas yang ditugaskan</td></tr>
                ) : (
                  assignments.map((assignment) => {
                    const petugas = availablePetugas.find(p => p.id === assignment.id_petugas)
                    return (
                      <tr key={assignment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {petugas?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            assignment.role === 'PETUGAS_PINTU' ? 'bg-blue-100 text-blue-800' :
                            assignment.role === 'PETUGAS_RUANG' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {assignment.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleRemove(assignment.id)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}