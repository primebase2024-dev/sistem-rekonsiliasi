import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
  useAuth()
  const [infoSesi, setInfoSesi] = useState({ nama_paroki: '', sesi: '', hari: '', tanggal: '', jam_mulai: '', jam_selesai: '' })
  const [ruangList, setRuangList] = useState<Ruang[]>([])
  const [deferredList, setDeferredList] = useState<Peserta[]>([])
  const [totalWaiting, setTotalWaiting] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchData()
    const channel = setupRealtime()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchData() {
    const { data: sesiData } = await supabase
      .from('rekonsiliasi_sesi')
      .select('id_sesi, hari, tanggal, jam_mulai, jam_selesai, rekonsiliasi_pekan(nama_paroki, nama_pekan)')
      .eq('status', 'OPEN')
      .limit(1)
      .maybeSingle()

    if (sesiData) {
		setInfoSesi({
		  nama_paroki: sesiData.rekonsiliasi_pekan?.[0]?.nama_paroki || 'Paroki',
		  sesi: (sesiData.rekonsiliasi_pekan?.[0]?.nama_pekan || 'Sesi') + ' - ' + sesiData.hari,
		  hari: sesiData.hari || '',
		  tanggal: sesiData.tanggal || '',
		  jam_mulai: sesiData.jam_mulai || '',
		  jam_selesai: sesiData.jam_selesai || ''
		})

      const { count } = await supabase
        .from('rekonsiliasi_peserta')
        .select('*', { count: 'exact', head: true })
        .eq('id_sesi', sesiData.id_sesi)
        .eq('status', 'WAITING')
      setTotalWaiting(count || 0)

      const { data: ruangData } = await supabase
        .from('rekonsiliasi_ruang')
        .select('id_ruang, nomor_ruang, nama_ruang, status')
        .eq('id_sesi', sesiData.id_sesi)
        .order('nomor_ruang', { ascending: true })

      if (ruangData && ruangData.length > 0) {
        const ruangIds = ruangData.map(r => r.id_ruang)
        
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

        const mappedRuang: Ruang[] = ruangData.map(r => ({
          ...r,
          peserta: (pesertaData || []).filter(p => p.id_ruang === r.id_ruang)
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

  function setupRealtime() {
    const channel = supabase
      .channel('display-peserta-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rekonsiliasi_peserta' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rekonsiliasi_peserta' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rekonsiliasi_ruang' }, fetchData)
      .subscribe()
    return channel
  }

  const formatNomor = (nomor: number) => `#${nomor.toString().padStart(3, '0')}`
  const formatTanggal = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col overflow-hidden font-sans">
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

      <main className="flex-1 p-6 flex gap-6 overflow-hidden">
        <div className="flex-1 grid grid-cols-2 gap-6 overflow-y-auto pr-2">
          {ruangList.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center h-64 text-slate-500 text-3xl animate-pulse">
              Belum ada ruang aktif untuk sesi ini.
            </div>
          ) : (
            ruangList.map(ruang => {
              const serving = ruang.peserta.find(p => p.status === 'SERVING')
              const called = ruang.peserta.filter(p => p.status === 'CALLED')
              const allocated = ruang.peserta.filter(p => p.status === 'ALLOCATED')

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
                        {called.map(p => (
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
                        {allocated.map(p => (
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
              deferredList.map(p => {
                const ruang = ruangList.find(r => r.id_ruang === p.id_ruang)
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
      </main>

      <footer className="bg-indigo-900 text-white py-3 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee text-lg font-medium tracking-wide">
          Harap mempersiapkan hati dan menjaga ketenangan. • Pastikan nomor antrian Anda sudah terpanggil sebelum memasuki ruang. • Tuhan memberkati.
        </div>
      </footer>
    </div>
  )
}