import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext' // Kembalikan useAuth
import { useSearchParams } from 'react-router-dom'

interface Peserta {
  id_peserta: string
  nomor_antrian: number
  status: string
  id_ruang?: string
}

interface Ruang {
  id_ruang: string
  nomor_ruang: number
  nama_ruang: string
  status: string
  peserta: Peserta[]
}

export function Display() {
  const { profile } = useAuth() // Ambil profile untuk tenant_id otomatis
  const [searchParams] = useSearchParams()
  
  const [infoSesi, setInfoSesi] = useState({ nama_paroki: '', sesi: '', hari: '', tanggal: '', jam_mulai: '', jam_selesai: '' })
  const [ruangList, setRuangList] = useState<Ruang[]>([])
  const [deferredList, setDeferredList] = useState<Peserta[]>([])
  const [totalWaiting, setTotalWaiting] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // State baru untuk pesan error/peringatan (misal: ada 2 sesi OPEN)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchData() 
    const intervalId = setInterval(() => {
      fetchData() // Auto-refresh setiap 10 detik
    }, 10000)
    return () => clearInterval(intervalId)
  }, [])

  async function fetchData() {
    setErrorMessage('') // Reset pesan error setiap kali fetch

    // 1. TENTUKAN TENANT ID (Prioritas: Profile Login > URL Parameter)
    const currentTenantId = profile?.tenant_id || searchParams.get('tenant_id')

    if (!currentTenantId) {
      setErrorMessage("Akses Ditolak: Tidak ada ID Paroki. Silakan Login atau gunakan URL dengan parameter ?tenant_id=")
      return
    }

    // 2. AMBIL SEMUA SESI YANG OPEN (Jangan pakai limit(1) dulu, kita perlu hitung)
    const { data: sesiData, error } = await supabase
      .from('rekonsiliasi_sesi')
      .select('id_sesi, hari, tanggal, jam_mulai, jam_selesai, rekonsiliasi_pekan(nama_paroki, nama_pekan)')
      .eq('status', 'OPEN')
      .eq('tenant_id', currentTenantId)
      .order('tanggal', { ascending: true })

    if (error) {
      console.error("Error fetching sesi:", error)
      return
    }

    // 3. LOGIKA BARU: CEK APAKAH ADA LEBIH DARI 1 SESI OPEN
    if (sesiData && sesiData.length > 1) {
      setErrorMessage("⚠️ PERINGATAN: Ditemukan lebih dari 1 Sesi berstatus OPEN. Harap nonaktifkan (CLOSE) salah satu sesi di menu Admin agar Display dapat menampilkan antrian dengan benar.")
      setRuangList([])
      setDeferredList([])
      setTotalWaiting(0)
      return // Hentikan eksekusi di sini
    }

    // 4. JIKA HANYA 1 SESI OPEN (Kondisi Normal)
    if (sesiData && sesiData.length === 1) {
      const sesi = sesiData[0]
      const pekanData = (sesi.rekonsiliasi_pekan as any)?.[0]

      setInfoSesi({
        nama_paroki: pekanData?.nama_paroki || 'Paroki',
        sesi: (pekanData?.nama_pekan || 'Sesi') + ' - ' + sesi.hari,
        hari: sesi.hari || '',
        tanggal: sesi.tanggal || '',
        jam_mulai: sesi.jam_mulai || '',
        jam_selesai: sesi.jam_selesai || ''
      })

      const { count } = await supabase
        .from('rekonsiliasi_peserta')
        .select('*', { count: 'exact', head: true })
        .eq('id_sesi', sesi.id_sesi)
        .eq('status', 'WAITING')
      setTotalWaiting(count || 0)

      const { data: ruangData } = await supabase
        .from('rekonsiliasi_ruang')
        .select('id_ruang, nomor_ruang, nama_ruang, status')
        .eq('id_sesi', sesi.id_sesi)
        .order('nomor_ruang', { ascending: true })

      if (ruangData && ruangData.length > 0) {
        const ruangIds = ruangData.map((r: any) => r.id_ruang)
        
        const { data: pesertaData } = await supabase
          .from('rekonsiliasi_peserta')
          .select('id_peserta, nomor_antrian, status, id_ruang')
          .in('id_ruang', ruangIds)
          .in('status', ['ALLOCATED', 'CALLED', 'SERVING'])
          .order('nomor_antrian', { ascending: true })

        const { data: deferData } = await supabase
          .from('rekonsiliasi_peserta')
          .select('id_peserta, nomor_antrian, status, id_ruang')
          .in('id_ruang', ruangIds)
          .eq('status', 'DEFERRED')
          .eq('deferred_ready', true)
          .order('nomor_antrian', { ascending: true })

        const mappedRuang: Ruang[] = ruangData.map((r: any) => ({
          ...r,
          peserta: (pesertaData || []).filter((p: any) => p.id_ruang === r.id_ruang)
        }))

        setRuangList(mappedRuang)
        setDeferredList(deferData || [])
      } else {
        setRuangList([])
        setDeferredList([])
      }
    } 
    // 5. JIKA TIDAK ADA SESI OPEN
    else {
      setInfoSesi({ nama_paroki: 'Belum Ada Sesi', sesi: '', hari: '', tanggal: '', jam_mulai: '', jam_selesai: '' })
      setTotalWaiting(0)
      setRuangList([])
      setDeferredList([])
    }
  }

  const formatNomor = (nomor: number) => `#${nomor.toString().padStart(3, '0')}`
  const formatTanggal = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col overflow-hidden font-sans">
      {/* HEADER */}
      <header className="bg-slate-800 border-b-4 border-indigo-600 px-8 py-5 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-4xl font-extrabold text-indigo-400 tracking-wide">SISTEM ANTRIAN REKONSILIASI</h1>
          <p className="text-2xl text-slate-200 mt-2 font-medium">{infoSesi.nama_paroki}</p>
          <p className="text-xl text-slate-400">{infoSesi.sesi} • {formatTanggal(infoSesi.tanggal)}</p>
          <p className="text-lg text-slate-500 mt-1">Pukul {infoSesi.jam_mulai} - {infoSesi.jam_selesai} WIB</p>
        </div>
        <div className="text-right">
          <p className="text-6xl font-mono font-bold text-white tracking-widest">
            {currentTime.toLocaleTimeString('id-ID')}
          </p>
          <p className="text-lg text-slate-400 mt-2">Sisa Antrian Global: <span className="text-yellow-400 font-bold text-2xl">{totalWaiting} Orang</span></p>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 flex gap-6 overflow-hidden relative">
        
        {/* TAMPILKAN PESAN ERROR JIKA ADA (Misal: 2 Sesi Open) */}
        {errorMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-8">
            <div className="bg-red-900/50 border-4 border-red-500 rounded-2xl p-8 max-w-2xl text-center shadow-2xl animate-pulse">
              <h2 className="text-3xl font-extrabold text-red-400 mb-4">⚠️ PERHATIAN</h2>
              <p className="text-xl text-white font-medium leading-relaxed">{errorMessage}</p>
              <p className="text-sm text-slate-400 mt-6">Halaman ini akan otomatis memperbarui setelah masalah diselesaikan.</p>
            </div>
          </div>
        )}

        {/* TAMPILAN NORMAL JIKA TIDAK ADA ERROR */}
        {!errorMessage && (
          <>
            <div className="flex-1 grid grid-cols-2 gap-6 overflow-y-auto pr-2">
              {ruangList.length === 0 ? (
                <div className="col-span-2 flex items-center justify-center h-64 text-slate-500 text-3xl animate-pulse">
                  {infoSesi.nama_paroki === 'Belum Ada Sesi' ? 'Belum ada sesi yang dibuka.' : 'Belum ada ruang aktif untuk sesi ini.'}
                </div>
              ) : (
                ruangList.map(ruang => {
                  const serving = ruang.peserta.find((p: any) => p.status === 'SERVING')
                  const called = ruang.peserta.filter((p: any) => p.status === 'CALLED')
                  const allocated = ruang.peserta.filter((p: any) => p.status === 'ALLOCATED')

                  return (
                    <div key={ruang.id_ruang} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex flex-col shadow-xl relative overflow-hidden transition-all duration-300 hover:border-slate-600">
                      <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-sm font-bold ${
                        ruang.status === 'SERVING' ? 'bg-green-600 text-white' : 
                        ruang.status === 'READY' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                      }`}>
                        {ruang.status}
                      </div>

                      <h2 className="text-2xl font-bold text-white mb-1 border-b border-slate-700 pb-3">
                        RUANG {ruang.nomor_ruang} <span className="text-slate-400 text-lg font-normal">- {ruang.nama_ruang}</span>
                      </h2>

                      <div className="mt-4 mb-4">
                        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Sedang Dilayani</p>
                        {serving ? (
                          <div className="bg-green-900/40 border-2 border-green-500 rounded-xl p-4 text-center animate-pulse">
                            <span className="text-7xl font-extrabold text-green-400">{formatNomor(serving.nomor_antrian)}</span>
                          </div>
                        ) : (
                          <div className="bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl p-4 text-center text-slate-600 text-xl">Kosong</div>
                        )}
                      </div>

                      {called.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-yellow-400 uppercase tracking-widest mb-2">Harap Segera Masuk</p>
                          <div className="flex flex-wrap gap-2">
                            {called.map((p: any) => (
                              <span key={p.id_peserta} className="text-3xl font-extrabold text-yellow-400 bg-yellow-900/30 border border-yellow-600 px-4 py-2 rounded-lg animate-bounce">
                                {formatNomor(p.nomor_antrian)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="text-xs text-blue-400 uppercase tracking-widest mb-2">Menunggu di Ruang Tunggu</p>
                        {allocated.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {allocated.map((p: any) => (
                              <span key={p.id_peserta} className="text-2xl font-bold text-blue-300 bg-blue-900/30 border border-blue-800 px-3 py-1 rounded-lg transition-transform hover:scale-105">
                                {formatNomor(p.nomor_antrian)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-600 text-sm italic">Belum ada yang menunggu.</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="w-1/3 bg-slate-800 rounded-2xl p-6 border border-slate-700 flex flex-col shadow-xl">
              <h2 className="text-2xl font-bold text-emerald-400 mb-4 border-b border-slate-700 pb-3">✅ Telah Kembali (Siap)</h2>
              <div className="flex-1 overflow-y-auto space-y-3">
                {deferredList.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-600 text-xl text-center">Tidak ada peserta yang kembali dari tunda.</div>
                ) : (
                  deferredList.map((p: any) => {
                    const ruang = ruangList.find((r: any) => r.id_ruang === p.id_ruang)
                    return (
                      <div key={p.id_peserta} className="bg-emerald-900/30 border-2 border-emerald-600 rounded-xl p-4 flex justify-between items-center transition-transform hover:scale-[1.02]">
                        <span className="text-4xl font-extrabold text-emerald-400">{formatNomor(p.nomor_antrian)}</span>
                        <span className="text-lg font-bold text-slate-300">{ruang ? `R. ${ruang.nomor_ruang}` : '?'}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="bg-indigo-900 text-white py-3 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee text-lg font-medium tracking-wide">
          Harap mempersiapkan hati dan menjaga ketenangan. • Pastikan nomor antrian Anda sudah terpanggil sebelum memasuki ruang. • Tuhan memberkati.
        </div>
      </footer>
    </div>
  )
}