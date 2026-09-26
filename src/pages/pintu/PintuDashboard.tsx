import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Sesi {
  id_sesi: string
  sesi: string
  nama_paroki: string // Dari relasi pekan
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
  const [lastRegisteredNumber, setLastRegisteredNumber] = useState<number | null>(null)

  useEffect(() => {
    fetchOpenSesi()
  }, [])

  async function fetchOpenSesi() {
    setLoading(true)
    
    // 1. AMANKAN DENGAN TENANT_ID
    const { data, error } = await supabase
      .from('rekonsiliasi_sesi')
      .select(`
        id_sesi, sesi, jam_mulai, jam_selesai, nomor_terakhir,
        rekonsiliasi_pekan (nama_paroki)
      `)
      .eq('status', 'OPEN')
      .eq('tenant_id', profile?.tenant_id) // <--- KUNCI PENGAMAN TAMBAHKAN DI SINI
      .order('tanggal', { ascending: true })

    if (error) {
      console.error('Error fetch sesi:', error)
    } else {
      // Flatten data agar sesuai dengan interface Sesi
      const flattenedData = (data || []).map((item: any) => ({
        id_sesi: item.id_sesi,
        sesi: item.sesi,
        jam_mulai: item.jam_mulai,
        jam_selesai: item.jam_selesai,
        nomor_terakhir: item.nomor_terakhir,
        // 2. PERBAIKAN: Hapus [0] karena relasi ini mengembalikan Objek, bukan Array
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
      // Panggil RPC Function yang kita buat di database
      const { data, error } = await supabase
        .rpc('rpc_register_peserta', { p_id_sesi: selectedSesiId })

      if (error) {
        throw error
      }

      // Sukses
      setLastRegisteredNumber(data.nomor_antrian)
      
      // Refresh data sesi untuk update nomor_terakhir di UI
      fetchOpenSesi() 
      
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

  // Format nomor dengan leading zero (misal: 1 -> #001)
  const formatNomor = (nomor: number) => {
    return `#${nomor.toString().padStart(3, '0')}`
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
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

        {/* Tombol Registrasi Besar */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 text-center space-y-6">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Nomor Terakhir</p>
            <p className="text-4xl font-bold text-gray-300 mt-1">
              {lastRegisteredNumber ? formatNomor(lastRegisteredNumber) : '-'}
            </p>
          </div>

          <button
            onClick={handleRegister}
            disabled={registering || sesiList.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xl py-6 rounded-xl shadow-lg transition transform active:scale-95"
          >
            {registering ? 'MENDAFTARKAN...' : '+ DAFTAR NOMOR'}
          </button>
        </div>

        {/* Info Kapasitas (Placeholder untuk Phase 6) */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
          <p className="text-sm text-blue-800">
            Sistem siap menerima jemaat.
          </p>
        </div>

      </main>
    </div>
  )
}