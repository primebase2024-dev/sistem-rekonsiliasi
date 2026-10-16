import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Sesi {
  id_sesi: string
  sesi: string
  nama_paroki: string
  jam_mulai: string
  jam_selesai: string
  nomor_terakhir: number
}

export function PintuDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [selectedSesiId, setSelectedSesiId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  
  // State baru untuk jenis antrian dan tampilan nomor
  const [ticketType, setTicketType] = useState<'normal' | 'priority'>('normal')
  const [lastRegisteredDisplay, setLastRegisteredDisplay] = useState<string | null>(null)

  useEffect(() => {
    fetchOpenSesi()
  }, [])

  async function fetchOpenSesi() {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('rekonsiliasi_sesi')
      .select(`
        id_sesi, sesi, jam_mulai, jam_selesai, nomor_terakhir,
        rekonsiliasi_pekan (nama_paroki)
      `)
      .eq('status', 'OPEN')
      .eq('tenant_id', profile?.tenant_id)
      .order('tanggal', { ascending: true })

    if (error) {
      console.error('Error fetch sesi:', error)
    } else {
      const flattenedData = (data || []).map((item: any) => ({
        id_sesi: item.id_sesi,
        sesi: item.sesi,
        jam_mulai: item.jam_mulai,
        jam_selesai: item.jam_selesai,
        nomor_terakhir: item.nomor_terakhir,
        nama_paroki: item.rekonsiliasi_pekan?.nama_paroki || 'Paroki' 
      }))
      
      setSesiList(flattenedData)
      
      if (flattenedData.length > 0 && !selectedSesiId) {
        setSelectedSesiId(flattenedData[0].id_sesi)
      }
    }
    setLoading(false)
  }

  async function handleRegister() {
    if (!selectedSesiId) {
      alert('Pilih sesi terlebih dahulu!')
      return
    }

    setRegistering(true)
    try {
      const isPriority = ticketType === 'priority'
      
      // Kirim parameter p_is_priority ke RPC
      const { data, error } = await supabase
        .rpc('rpc_register_peserta', { 
          p_id_sesi: selectedSesiId,
          p_is_priority: isPriority 
        })

      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Gagal registrasi')
      }

      // Tampilkan format nomor yang sudah jadi (misal: "A-001" atau "P-001")
      setLastRegisteredDisplay(data.display_number)
      
      fetchOpenSesi() 
      
      // Opsional: Reset ke normal setelah berhasil agar tidak lupa
      setTicketType('normal') 
      
    } catch (err: any) {
      alert('Gagal registrasi: ' + (err.message || err))
    } finally {
      setRegistering(false)
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center border-b border-gray-200">
        <div>
          <h1 className="text-lg font-bold text-indigo-700">SAR - Petugas Pintu</h1>
          <p className="text-xs text-gray-500">{profile?.full_name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">Logout</button>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6">
        
        {/* Pilih Sesi */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Sesi Aktif:</label>
          {sesiList.length === 0 ? (
            <p className="text-gray-500 italic">Tidak ada sesi yang OPEN.</p>
          ) : (
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={selectedSesiId}
              onChange={(e) => setSelectedSesiId(e.target.value)}
            >
              {sesiList.map((s) => (
                <option key={s.id_sesi} value={s.id_sesi}>
                  {s.nama_paroki} - {s.sesi} ({s.jam_mulai})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Area Registrasi */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 text-center space-y-6">
          
          {/* Pilihan Jenis Antrian */}
          <div className="grid grid-cols-2 gap-4">
            <label 
              className={`cursor-pointer border-2 rounded-lg p-4 flex flex-col items-center transition-all ${
                ticketType === 'normal' ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input 
                type="radio" 
                name="ticketType" 
                value="normal" 
                checked={ticketType === 'normal'} 
                onChange={(e) => setTicketType(e.target.value as any)}
                className="hidden"
              />
              <span className="text-3xl font-extrabold text-gray-800 mb-1">A</span>
              <span className="text-sm font-medium text-gray-600">Antrian Umum</span>
            </label>

            <label 
              className={`cursor-pointer border-2 rounded-lg p-4 flex flex-col items-center transition-all ${
                ticketType === 'priority' ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input 
                type="radio" 
                name="ticketType" 
                value="priority" 
                checked={ticketType === 'priority'} 
                onChange={(e) => setTicketType(e.target.value as any)}
                className="hidden"
              />
              <span className="text-3xl font-extrabold text-emerald-700 mb-1">P</span>
              <span className="text-sm font-medium text-gray-600">Lansia / Disabilitas</span>
            </label>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Nomor Terakhir Dibuat</p>
            <p className="text-6xl font-extrabold text-gray-800 mt-2 tracking-wider">
              {lastRegisteredDisplay || '-'}
            </p>
            <p className="text-xs text-gray-400 mt-2 italic">*Petugas: Salin nomor di atas ke kartu antrian fisik</p>
          </div>

          <button
            onClick={handleRegister}
            disabled={registering || sesiList.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xl py-5 rounded-xl shadow-lg transition transform active:scale-95"
          >
            {registering ? 'MEMPROSES...' : '🖨️ DAFTAR & CETAK NOMOR'}
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
          <p className="text-sm text-blue-800">
            Sistem siap menerima umat. Pastikan kartu antrian sudah ditulis dengan jelas.
          </p>
        </div>

      </main>
    </div>
  )
}