import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// --- DEFINISI TIPE DATA ---
interface Pekan { id_pekan: string; nama_pekan: string; kode_pekan?: string }
interface Sesi { id_sesi: string; sesi: string; hari: string; tanggal: string; id_pekan: string }

interface PesertaDetail {
  id_peserta: string
  nomor_antrian: number
  status: string
  waktu_daftar: string
  waktu_waiting: string
  waktu_allocated: string
  waktu_called: string
  waktu_masuk: string
  waktu_deferred: string
  waktu_selesai: string
  deferred_ready: boolean
  keterangan: string
  rekonsiliasi_sesi: { 
    sesi: string; hari: string; tanggal: string; 
    rekonsiliasi_pekan: { nama_pekan: string; kode_pekan: string } | null 
  } | null
  rekonsiliasi_ruang: { 
    nomor_ruang: number; nama_ruang: string; romo_nama?: string; petugas_nama?: string 
  } | null
}

export function Laporan() {
  const { profile } = useAuth()
  const [pekanList, setPekanList] = useState<Pekan[]>([])
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [selectedPekanId, setSelectedPekanId] = useState('')
  const [selectedSesiId, setSelectedSesiId] = useState('')
  
  const [dataPeserta, setDataPeserta] = useState<PesertaDetail[]>([])
  const [loading, setLoading] = useState(false)

  const [rekap, setRekap] = useState({
    totalDaftar: 0,
    totalDilayani: 0,
    perSesi: [] as { name: string; daftar: number; dilayani: number }[],
    perTanggal: [] as { name: string; count: number }[],
    perRomo: [] as { name: string; count: number }[]
  })

  useEffect(() => { fetchPekanAndSesi() }, [])
  useEffect(() => { 
    if (selectedPekanId || selectedSesiId) fetchAndCalculate() 
  }, [selectedPekanId, selectedSesiId])

  async function fetchPekanAndSesi() {
    const { data: pekanData } = await supabase.from('rekonsiliasi_pekan').select('id_pekan, nama_pekan, kode_pekan').eq('tenant_id', profile?.tenant_id).order('created_at', { ascending: false })
    const { data: sesiData } = await supabase.from('rekonsiliasi_sesi').select('id_sesi, sesi, hari, tanggal, id_pekan').eq('tenant_id', profile?.tenant_id).order('tanggal', { ascending: false })
    if (pekanData) setPekanList(pekanData)
    if (sesiData) setSesiList(sesiData)
  }

  async function fetchAndCalculate() {
    setLoading(true)
    let query = supabase
      .from('rekonsiliasi_peserta')
      .select(`
        id_peserta, nomor_antrian, status, waktu_daftar, waktu_waiting, waktu_allocated, waktu_called, waktu_masuk, waktu_deferred, waktu_selesai, deferred_ready, keterangan,
        rekonsiliasi_sesi (sesi, hari, tanggal, rekonsiliasi_pekan (nama_pekan, kode_pekan)),
        rekonsiliasi_ruang (nomor_ruang, nama_ruang, romo_nama, petugas_nama)
      `)
      .eq('tenant_id', profile?.tenant_id)

    if (selectedSesiId) {
      query = query.eq('id_sesi', selectedSesiId)
    } else if (selectedPekanId) {
      const sesiDiPekan = sesiList.filter(s => s.id_pekan === selectedPekanId).map(s => s.id_sesi)
      if (sesiDiPekan.length > 0) query = query.in('id_sesi', sesiDiPekan)
      else { setDataPeserta([]); setRekap({ totalDaftar: 0, totalDilayani: 0, perSesi: [], perTanggal: [], perRomo: [] }); setLoading(false); return }
    }

    const { data, error } = await query.order('waktu_daftar', { ascending: true })

    if (data && !error) {
      // 1. Convert ke unknown dulu, baru ke PesertaDetail[]
      const typedData = data as unknown as PesertaDetail[]
      
      // 2. Gunakan variabel typedData, BUKAN data as PesertaDetail[]
      setDataPeserta(typedData)
      calculateRekap(typedData)
    }
    setLoading(false)
  }

  function calculateRekap(data: PesertaDetail[]) {
    const totalDaftar = data.length
    const totalDilayani = data.filter(d => d.status === 'SELESAI').length

    const sesiMap: any = {}
    data.forEach(d => {
      const sesiName = d.rekonsiliasi_sesi?.sesi || 'Unknown'
      if (!sesiMap[sesiName]) sesiMap[sesiName] = { daftar: 0, dilayani: 0 }
      sesiMap[sesiName].daftar++
      if (d.status === 'SELESAI') sesiMap[sesiName].dilayani++
    })

    const tanggalMap: any = {}
    data.forEach(d => {
      if (d.status === 'SELESAI' && d.waktu_selesai) {
        const tgl = new Date(d.waktu_selesai).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        if (!tanggalMap[tgl]) tanggalMap[tgl] = 0
        tanggalMap[tgl]++
      }
    })

    const romoMap: any = {}
    data.forEach(d => {
      if (d.status === 'SELESAI') {
        const romoName = d.rekonsiliasi_ruang?.romo_nama || d.rekonsiliasi_ruang?.nama_ruang || 'Tidak Diketahui'
        if (!romoMap[romoName]) romoMap[romoName] = 0
        romoMap[romoName]++
      }
    })

    setRekap({
      totalDaftar, totalDilayani,
      perSesi: Object.entries(sesiMap).map(([key, val]) => ({ name: key, ...(val as any) })),
      perTanggal: Object.entries(tanggalMap).map(([key, val]) => ({ name: key, count: val as number })),
      perRomo: Object.entries(romoMap).map(([key, val]) => ({ name: key, count: val as number }))
    })
  }

  // --- FUNGSI HELPER CSV (AMAN DARI KOMA) ---
  const formatCSVCell = (value: any) => {
    if (value === null || value === undefined) return '""'
    const str = String(value).replace(/"/g, '""') // Escape double quotes
    return `"${str}"` // Wrap in double quotes
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return new Date(timeStr).toLocaleString('id-ID')
  }

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return ''
    const diffMs = new Date(end).getTime() - new Date(start).getTime()
    if (diffMs < 0) return ''
    const diffMins = Math.floor(diffMs / 60000)
    const mins = diffMins % 60
    const hours = Math.floor(diffMins / 60)
    return hours > 0 ? `${hours}j ${mins}m` : `${mins}m`
  }

  // --- FUNGSI EXPORT CSV MAKSIMAL ---
  function exportToCSV() {
    if (dataPeserta.length === 0) return alert('Tidak ada data untuk diexport')

    // 1. Headers (20 Kolom Lengkap)
    const headers = [
      'Nama Pekan', 'Kode Pekan', 'Hari', 'Tanggal Sesi', 'Nama Sesi',
      'No. Antrian', 'Nama Ruang', 'No. Ruang', 'Nama Romo', 'Nama Petugas',
      'Status Terakhir', 'Keterangan', 'Deferred Ready',
      'Waktu Daftar', 'Waktu Waiting', 'Waktu Allocated', 'Waktu Called', 
      'Waktu Masuk', 'Waktu Deferred', 'Waktu Selesai', 'Durasi Pelayanan'
    ]

    // 2. Rows Data
    const rows = dataPeserta.map(d => [
      formatCSVCell(d.rekonsiliasi_sesi?.rekonsiliasi_pekan?.nama_pekan || '-'),
      formatCSVCell(d.rekonsiliasi_sesi?.rekonsiliasi_pekan?.kode_pekan || '-'),
      formatCSVCell(d.rekonsiliasi_sesi?.hari || '-'),
      formatCSVCell(d.rekonsiliasi_sesi?.tanggal ? new Date(d.rekonsiliasi_sesi.tanggal).toLocaleDateString('id-ID') : '-'),
      formatCSVCell(d.rekonsiliasi_sesi?.sesi || '-'),
      
      formatCSVCell(d.nomor_antrian),
      formatCSVCell(d.rekonsiliasi_ruang?.nama_ruang || '-'),
      formatCSVCell(d.rekonsiliasi_ruang?.nomor_ruang || '-'),
      formatCSVCell(d.rekonsiliasi_ruang?.romo_nama || '-'),
      formatCSVCell(d.rekonsiliasi_ruang?.petugas_nama || '-'),
      
      formatCSVCell(d.status),
      formatCSVCell(d.keterangan || ''),
      formatCSVCell(d.deferred_ready ? 'Ya' : 'Tidak'),
      
      formatCSVCell(formatTime(d.waktu_daftar)),
      formatCSVCell(formatTime(d.waktu_waiting)),
      formatCSVCell(formatTime(d.waktu_allocated)),
      formatCSVCell(formatTime(d.waktu_called)),
      formatCSVCell(formatTime(d.waktu_masuk)),
      formatCSVCell(formatTime(d.waktu_deferred)),
      formatCSVCell(formatTime(d.waktu_selesai)),
      
      // Kolom Bonus: Kalkulasi Durasi
      formatCSVCell(calculateDuration(d.waktu_masuk, d.waktu_selesai))
    ])

    // 3. Generate File
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `Laporan_Lengkap_Rekonsiliasi_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Laporan & Analisis</h2>
        <button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
          📥 Export Detail Lengkap (CSV)
        </button>
      </div>

      {/* FILTER */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter per Pekan:</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2" value={selectedPekanId} onChange={(e) => { setSelectedPekanId(e.target.value); setSelectedSesiId('') }}>
            <option value="">-- Semua Pekan --</option>
            {pekanList.map(p => <option key={p.id_pekan} value={p.id_pekan}>{p.nama_pekan} ({p.kode_pekan})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter per Sesi Spesifik:</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2" value={selectedSesiId} onChange={(e) => setSelectedSesiId(e.target.value)}>
            <option value="">-- Semua Sesi --</option>
            {sesiList.map(s => <option key={s.id_sesi} value={s.id_sesi}>{s.hari}, {new Date(s.tanggal).toLocaleDateString('id-ID')} - {s.sesi}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Memuat dan menghitung laporan...</div>
      ) : (
        <>
          {/* KARTU RINGKASAN UTAMA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
              <p className="text-blue-100 text-sm font-medium">Total Peserta Mendaftar</p>
              <p className="text-4xl font-bold mt-2">{rekap.totalDaftar}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
              <p className="text-green-100 text-sm font-medium">Total Peserta Dilayani (Selesai)</p>
              <p className="text-4xl font-bold mt-2">{rekap.totalDilayani}</p>
            </div>
          </div>

          {/* REKAPITULASI PER SESI */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900"> Rekapitulasi per Sesi</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Sesi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Mendaftar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Dilayani</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tingkat Pelayanan</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rekap.perSesi.length === 0 ? <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Tidak ada data untuk filter ini</td></tr> : 
                  rekap.perSesi.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.daftar}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-bold">{item.dilayani}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.daftar > 0 ? Math.round((item.dilayani / item.daftar) * 100) : 0}%</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">📅 Dilayani per Tanggal</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  {rekap.perTanggal.length === 0 ? <tr><td className="px-6 py-4 text-center text-gray-500">Belum ada jemaat yang selesai dilayani</td></tr> : 
                    rekap.perTanggal.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3 text-sm text-gray-700">{item.name}</td>
                        <td className="px-6 py-3 text-sm font-bold text-green-600 text-right">{item.count} Jemaat</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">✝️ Dilayani per Romo</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  {rekap.perRomo.length === 0 ? <tr><td className="px-6 py-4 text-center text-gray-500">Belum ada data Romo</td></tr> : 
                    rekap.perRomo.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3 text-sm text-gray-700">{item.name}</td>
                        <td className="px-6 py-3 text-sm font-bold text-blue-600 text-right">{item.count} Jemaat</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}