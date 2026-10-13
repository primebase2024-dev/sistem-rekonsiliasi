import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  
  const [infoSesi, setInfoSesi] = useState({ nama_paroki: '', sesi: '', hari: '', tanggal: '', jam_mulai: '', jam_selesai: '' })
  const [ruangList, setRuangList] = useState<Ruang[]>([])
  const [deferredList, setDeferredList] = useState<Peserta[]>([])
  const [totalWaiting, setTotalWaiting] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [errorMessage, setErrorMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchData() 
    // PERUBAHAN #5: Refresh lebih cepat (2 detik)
    const intervalId = setInterval(() => {
      fetchData()
    }, 2000) // Dari 10000ms jadi 2000ms
    return () => clearInterval(intervalId)
  }, [])

  async function fetchData() {
    setErrorMessage('')

    const currentTenantId = profile?.tenant_id || searchParams.get('tenant_id')

    if (!currentTenantId) {
      setErrorMessage("Akses Ditolak: Tidak ada ID Paroki. Silakan Login atau gunakan URL dengan parameter ?tenant_id=")
      return
    }

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

    if (sesiData && sesiData.length > 1) {
      setErrorMessage("⚠️ PERINGATAN: Ditemukan lebih dari 1 Sesi berstatus OPEN. Harap nonaktifkan (CLOSE) salah satu sesi di menu Admin.")
      setRuangList([])
      setDeferredList([])
      setTotalWaiting(0)
      return
    }

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
    } else {
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

  // PERUBAHAN #2: Mobile view - tampilkan per ruang
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold text-indigo-400">SISTEM ANTRIAN REKONSILIASI</h1>
          <p className="text-sm text-slate-400">{infoSesi.nama_paroki}</p>
          <p className="text-xs text-slate-500">{formatTanggal(infoSesi.tanggal)}</p>
        </div>
        
        {ruangList.map(ruang => {
          const serving = ruang.peserta.find((p: any) => p.status === 'SERVING')
          const called = ruang.peserta.filter((p: any) => p.status === 'CALLED')
          const allocated = ruang.peserta.filter((p: any) => p.status === 'ALLOCATED')
          
          return (
            <div key={ruang.id_ruang} className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-2">Ruang {ruang.nomor_ruang} - {ruang.nama_ruang}</h3>
              {serving && (
                <div className="mb-2">
                  <span className="text-xs text-slate-400">Dilayani:</span>
                  <span className="ml-2 text-3xl font-bold text-green-400">{formatNomor(serving.nomor_antrian)}</span>
                </div>
              )}
              {called.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-yellow-400">Dipanggil:</span>
                  <div className="flex gap-2 mt-1">
                    {called.map((p: any) => (
                      <span key={p.id_peserta} className="text-xl font-bold text-yellow-400">{formatNomor(p.nomor_antrian)}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-slate-500">Menunggu: {allocated.length} orang</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col overflow-hidden font-sans">
      {/* PERUBAHAN #1: Header lebih compact */}
      <header className="bg-slate-800 border-b-2 border-indigo-600 px-6 py-3 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">SISTEM ANTRIAN REKONSILIASI</h1>
          <p className="text-lg text-slate-300">{infoSesi.nama_paroki} • {infoSesi.sesi}</p>
          <p className="text-sm text-slate-300">{formatTanggal(infoSesi.tanggal)} | {infoSesi.jam_mulai} - {infoSesi.jam_selesai} WIB</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-white">
            {currentTime.toLocaleTimeString('id-ID')}
          </p>
          <p className="text-sm text-slate-500 mt-1">Sisa Antrian: <span className="text-yellow-500 font-bold">{totalWaiting}</span></p>
        </div>
      </header>

      <main className="flex-1 p-4 flex gap-4 overflow-hidden relative">
        {errorMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-8">
            <div className="bg-red-900/50 border-4 border-red-500 rounded-2xl p-8 max-w-2xl text-center shadow-2xl animate-pulse">
              <h2 className="text-3xl font-bold text-red-400 mb-4">⚠️ PERHATIAN</h2>
              <p className="text-xl text-white font-medium">{errorMessage}</p>
            </div>
          </div>
        )}

        {!errorMessage && (
          <>
            {/* PERUBAHAN #2: Grid responsif untuk handle 8 ruang */}
			<div
			  className={`flex-1 grid grid-auto-rows-fr gap-3 overflow-y-auto pr-2 ${
				ruangList.length > 4
				  ? 'grid-cols-3'
				  : ruangList.length > 2
					? 'grid-cols-2'
					: 'grid-cols-1'
			  }`}
			>
              {ruangList.length === 0 ? (
                <div className="col-span-full flex items-center justify-center h-48 text-slate-500 text-xl">
                  {infoSesi.nama_paroki === 'Belum Ada Sesi' ? 'Belum ada sesi yang dibuka.' : 'Belum ada ruang aktif.'}
                </div>
              ) : (
                ruangList.map(ruang => {
                  const serving = ruang.peserta.find((p: any) => p.status === 'SERVING')
                  const called = ruang.peserta.filter((p: any) => p.status === 'CALLED')
                  const allocated = ruang.peserta.filter((p: any) => p.status === 'ALLOCATED')
                  
                  // PERUBAHAN #4: Visual disabled saat pause
                  const isPaused = ruang.status === 'PAUSE'
                  
                  return (
                    <div 
                      key={ruang.id_ruang} 
                      className={`rounded-xl p-4 border flex flex-col shadow-lg transition-all duration-300 ${
                        isPaused 
                          ? 'bg-slate-800/50 border-slate-600 opacity-60 grayscale' // Disabled appearance
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-bold ${
                        ruang.status === 'SERVING' ? 'bg-green-600 text-white' : 
                        ruang.status === 'READY' ? 'bg-blue-600 text-white' : 
                        ruang.status === 'PAUSE' ? 'bg-orange-600 text-white' :
                        'bg-slate-600 text-slate-300'
                      }`}>
                        {ruang.status}
                      </div>

                      <h2 className="text-xl font-bold text-white mb-2 border-b border-slate-700 pb-2">
                        RUANG {ruang.nomor_ruang} <span className="text-slate-400 text-base font-normal">- {ruang.nama_ruang}</span>
                      </h2>

                      <div className="mb-3">
                        <p className="text-xs text-slate-400 uppercase mb-1">Dilayani</p>
                        {serving ? (
                          <div className={`rounded-lg p-3 text-center ${isPaused ? 'bg-slate-700' : 'bg-green-900/40 border-2 border-green-500'}`}>
                            <span className={`text-5xl font-bold ${isPaused ? 'text-slate-500' : 'text-green-400'}`}>
                              {formatNomor(serving.nomor_antrian)}
                            </span>
                          </div>
                        ) : (
                          <div className="bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-lg p-3 text-center text-slate-600">
                            Kosong
                          </div>
                        )}
                      </div>

                      {called.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-yellow-400 uppercase mb-1">Dipanggil</p>
                          <div className="flex flex-wrap gap-1">
                            {called.map((p: any) => (
                              <span key={p.id_peserta} className="text-2xl font-bold text-yellow-400 bg-yellow-900/30 border border-yellow-600 px-3 py-1 rounded">
                                {formatNomor(p.nomor_antrian)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-h-0">
                        <p className="text-xs text-blue-400 uppercase mb-1">Menunggu ({allocated.length})</p>
                        {allocated.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {allocated.map((p: any) => (
                              <span key={p.id_peserta} className="text-lg font-semibold text-blue-300 bg-blue-900/30 border border-blue-800 px-2 py-1 rounded">
                                {formatNomor(p.nomor_antrian)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-600 text-xs">-</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* PERUBAHAN #3: Bagian Tunda diperkecil (dari w-1/3 jadi w-1/5) */}
            <div className="w-1/5 bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col shadow-lg">
              <h2 className="text-lg font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-2">✅ Tunda (Siap)</h2>
              <div className="flex-1 overflow-y-auto space-y-2">
                {deferredList.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-600 text-sm text-center">
                    Tidak ada
                  </div>
                ) : (
                  deferredList.map((p: any) => {
                    const ruang = ruangList.find((r: any) => r.id_ruang === p.id_ruang)
                    return (
                      <div key={p.id_peserta} className="bg-emerald-900/30 border-2 border-emerald-600 rounded-lg p-3 flex justify-between items-center">
                        <span className="text-2xl font-bold text-emerald-400">{formatNomor(p.nomor_antrian)}</span>
                        <span className="text-sm font-semibold text-slate-300">{ruang ? `R.${ruang.nomor_ruang}` : '?'}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="bg-indigo-900 text-white py-2 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee text-sm font-medium">
          Silentium Sacrum • Harap mempersiapkan hati dan menjaga ketenangan. • Pastikan nomor antrian Anda sudah terpanggil sebelum memasuki ruang. • Tuhan memberkati.
        </div>
      </footer>
    </div>
  )
}