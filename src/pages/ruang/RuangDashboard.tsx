 import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Ruang {
  id_ruang: string
  nomor_ruang: number
  nama_ruang: string
  romo_nama: string
  status: string
  id_sesi: string
  sesi_nama: string
  nama_paroki: string
  kapasitas_tunggu: number
}

interface Peserta {
  id_peserta: string
  nomor_antrian: number
  status: string
  waktu_deferred?: string
  deferred_ready?: boolean
}

export function RuangDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  
  const [ruangList, setRuangList] = useState<Ruang[]>([])
  const [selectedRuangId, setSelectedRuangId] = useState<string>('')
  const [selectedRuang, setSelectedRuang] = useState<Ruang | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [allocating, setAllocating] = useState(false)
  const [processing, setProcessing] = useState(false)

  const [counters, setCounters] = useState({ waiting: 0, allocated: 0, serving: 0, completed: 0, deferred: 0 })
  const [allocatedList, setAllocatedList] = useState<Peserta[]>([])
  const [servingPeserta, setServingPeserta] = useState<Peserta | null>(null)
  const [deferredList, setDeferredList] = useState<Peserta[]>([])

  const selectedRuangRef = useRef<Ruang | null>(null)

  useEffect(() => {
    selectedRuangRef.current = selectedRuang
  }, [selectedRuang])

  function setupRealtime() {
    const channel = supabase
      .channel('ruang-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rekonsiliasi_peserta' }, () => {
        const currentRuang = selectedRuangRef.current
        if (currentRuang) {
          fetchCounters(currentRuang.id_sesi, currentRuang.id_ruang)
          fetchPesertaLists(currentRuang.id_ruang)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rekonsiliasi_ruang' }, () => {
        fetchRuang()
      })
      .subscribe()
    
    return channel
  }

  useEffect(() => { 
    fetchRuang()
    const channel = setupRealtime()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (selectedRuangId) {
      const r = ruangList.find(r => r.id_ruang === selectedRuangId)
      setSelectedRuang(r || null)
      if (r) {
        fetchCounters(r.id_sesi, r.id_ruang)
        fetchPesertaLists(r.id_ruang)
      }
    }
  }, [selectedRuangId, ruangList])

  async function fetchRuang() {
    setLoading(true)
    const { data, error } = await supabase
      .from('rekonsiliasi_ruang')
      .select(`id_ruang, nomor_ruang, nama_ruang, romo_nama, status, id_sesi, rekonsiliasi_sesi!inner (sesi, kapasitas_tunggu, rekonsiliasi_pekan (nama_paroki))`)
      .eq('rekonsiliasi_sesi.status', 'OPEN')

    if (!error && data) {
      const flattened = data.map((item: any) => ({
        id_ruang: item.id_ruang, nomor_ruang: item.nomor_ruang, nama_ruang: item.nama_ruang,
        romo_nama: item.romo_nama, status: item.status, id_sesi: item.id_sesi,
        sesi_nama: item.rekonsiliasi_sesi?.sesi, nama_paroki: item.rekonsiliasi_pekan?.nama_paroki,
        kapasitas_tunggu: item.rekonsiliasi_sesi?.kapasitas_tunggu || 5
      }))
      setRuangList(flattened)
    }
    setLoading(false)
  }

  async function fetchCounters(id_sesi: string, id_ruang: string) {
    const { count: waiting } = await supabase.from('rekonsiliasi_peserta').select('*', { count: 'exact', head: true }).eq('id_sesi', id_sesi).eq('status', 'WAITING')
    const { count: allocated } = await supabase.from('rekonsiliasi_peserta').select('*', { count: 'exact', head: true }).eq('id_ruang', id_ruang).in('status', ['ALLOCATED', 'CALLED'])
    const { count: serving } = await supabase.from('rekonsiliasi_peserta').select('*', { count: 'exact', head: true }).eq('id_ruang', id_ruang).eq('status', 'SERVING')
    const { count: completed } = await supabase.from('rekonsiliasi_peserta').select('*', { count: 'exact', head: true }).eq('id_ruang', id_ruang).eq('status', 'COMPLETED')
    const { count: deferred } = await supabase.from('rekonsiliasi_peserta').select('*', { count: 'exact', head: true }).eq('id_ruang', id_ruang).eq('status', 'DEFERRED')
    
    setCounters({ 
      waiting: waiting || 0, allocated: allocated || 0, serving: serving || 0, completed: completed || 0, deferred: deferred || 0 
    })
  }

  async function fetchPesertaLists(id_ruang: string) {
    const { data: allocData } = await supabase.from('rekonsiliasi_peserta').select('id_peserta, nomor_antrian, status').eq('id_ruang', id_ruang).in('status', ['ALLOCATED', 'CALLED']).order('nomor_antrian', { ascending: true })
    const { data: serveData } = await supabase.from('rekonsiliasi_peserta').select('id_peserta, nomor_antrian, status').eq('id_ruang', id_ruang).eq('status', 'SERVING').limit(1).maybeSingle() 
    const { data: deferData } = await supabase.from('rekonsiliasi_peserta').select('id_peserta, nomor_antrian, status, waktu_deferred, deferred_ready').eq('id_ruang', id_ruang).eq('status', 'DEFERRED').order('waktu_deferred', { ascending: true })

    setAllocatedList(allocData || [])
    setServingPeserta(serveData || null)
    setDeferredList(deferData || [])
  }

  async function handleNextAllocated() {
    if (!selectedRuang) return
    setAllocating(true)
    try {
      const { data, error } = await supabase.rpc('rpc_allocate_batch', { p_id_ruang: selectedRuang.id_ruang, p_batch_size: selectedRuang.kapasitas_tunggu })
      if (error) throw error
      if (data.success) refreshData()
      else alert(data.message)
    } catch (err: any) { alert('Gagal alokasi: ' + (err.message || err)) } finally { setAllocating(false) }
  }

  async function handlePesertaMasuk(peserta: Peserta) {
    if (!selectedRuang) return
    if (servingPeserta) { alert(`⚠️ Ruang sedang melayani ${formatNomor(servingPeserta.nomor_antrian)}. Selesaikan terlebih dahulu.`); return }
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_peserta_masuk', { p_id_peserta: peserta.id_peserta, p_id_ruang: selectedRuang.id_ruang })
      if (error) throw error
      refreshData()
    } catch (err: any) { alert('Gagal: ' + (err.message || err)) } finally { setProcessing(false) }
  }

  async function handleBatalMasuk() {
    if (!selectedRuang || !servingPeserta) return
    if (!confirm(`Batalkan masuk untuk ${formatNomor(servingPeserta.nomor_antrian)}?`)) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_batal_masuk', { p_id_peserta: servingPeserta.id_peserta, p_id_ruang: selectedRuang.id_ruang })
      if (error) throw error
      refreshData()
    } catch (err: any) { alert('Gagal: ' + (err.message || err)) } finally { setProcessing(false) }
  }

  async function handleCall(peserta: Peserta) {
    if (!selectedRuang) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_call_peserta', { p_id_peserta: peserta.id_peserta, p_id_ruang: selectedRuang.id_ruang })
      if (error) throw error
      refreshData()
    } catch (err: any) { alert('Gagal: ' + (err.message || err)) } finally { setProcessing(false) }
  }

  async function handleDefer(peserta: Peserta) {
    if (!selectedRuang) return
    if (!confirm(`Tunda peserta ${formatNomor(peserta.nomor_antrian)}?`)) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_defer_peserta', { p_id_peserta: peserta.id_peserta, p_id_ruang: selectedRuang.id_ruang })
      if (error) throw error
      refreshData()
    } catch (err: any) { alert('Gagal: ' + (err.message || err)) } finally { setProcessing(false) }
  }

  async function handleReturnDeferred(peserta: Peserta) {
    if (!selectedRuang) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_return_deferred', { p_id_peserta: peserta.id_peserta, p_id_ruang: selectedRuang.id_ruang })
      if (error) throw error
      refreshData()
    } catch (err: any) { alert('Gagal: ' + (err.message || err)) } finally { setProcessing(false) }
  }

  async function handleSelesai() {
    if (!selectedRuang || !servingPeserta) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_peserta_selesai', { p_id_peserta: servingPeserta.id_peserta, p_id_ruang: selectedRuang.id_ruang })
      if (error) throw error
      await supabase.from('rekonsiliasi_ruang').update({ status: 'READY' }).eq('id_ruang', selectedRuang.id_ruang)
      refreshData()
    } catch (err: any) { alert('Gagal: ' + (err.message || err)) } finally { setProcessing(false) }
  }

  async function handleRoomStatus(newStatus: string) {
    if (!selectedRuang) return
    if (!confirm(`Ubah status ruang menjadi ${newStatus}?`)) return
    
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_update_ruang_status', {
        p_id_ruang: selectedRuang.id_ruang,
        p_new_status: newStatus
      })
      if (error) throw error
      setSelectedRuang({ ...selectedRuang, status: newStatus })
      refreshData()
    } catch (err: any) {
      alert('Gagal: ' + (err.message || err))
    } finally {
      setProcessing(false)
    }
  }

  function refreshData() {
    if (selectedRuang) {
      fetchCounters(selectedRuang.id_sesi, selectedRuang.id_ruang)
      fetchPesertaLists(selectedRuang.id_ruang)
    }
  }

  async function handleLogout() { 
    await signOut()
    navigate('/') 
  }
  
  const formatNomor = (nomor: number) => `#${nomor.toString().padStart(3, '0')}`

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-medium">Memuat data ruang...</div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-indigo-700">SAR - Petugas Ruang</h1>
          <p className="text-xs text-gray-500">{profile?.full_name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors">Logout</button>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Ruang Anda:</label>
          <select 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
            value={selectedRuangId} 
            onChange={(e) => setSelectedRuangId(e.target.value)}
          >
            <option value="">-- Pilih Ruang --</option>
            {ruangList.map((r) => (
              <option key={r.id_ruang} value={r.id_ruang}>Ruang {r.nomor_ruang} ({r.nama_ruang}) - {r.nama_paroki} | {r.sesi_nama} | {r.status}</option>
            ))}
          </select>
        </div>

        {selectedRuang && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <CounterCard label="WAITING" value={counters.waiting} color="gray" />
              <CounterCard label="ALLOCATED" value={counters.allocated} color="blue" />
              <CounterCard label="SERVING" value={counters.serving} color="green" />
              <CounterCard label="DEFERRED" value={counters.deferred} color="yellow" />
              <CounterCard label="SELESAI" value={counters.completed} color="indigo" />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedRuang.nama_ruang}</h3>
                  <p className="text-sm text-gray-500">{selectedRuang.romo_nama} • Kapasitas Batch: {selectedRuang.kapasitas_tunggu}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                  selectedRuang.status === 'READY' ? 'bg-green-100 text-green-800' : 
                  selectedRuang.status === 'SERVING' ? 'bg-blue-100 text-blue-800' : 
                  selectedRuang.status === 'PAUSE' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedRuang.status}
                </span>
              </div>

              {/* SERVING */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2 tracking-wide">Sedang Dilayani</h4>
                {servingPeserta ? (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center relative animate-in fade-in zoom-in duration-300">
                    <button 
                      onClick={handleBatalMasuk}
                      disabled={processing}
                      className="absolute top-3 right-3 text-xs bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-red-600 px-2 py-1 rounded shadow-sm transition-all"
                      title="Kembalikan ke daftar menunggu"
                    >
                      ↩ Batal
                    </button>
                    <p className="text-6xl font-extrabold text-green-700 mb-6">{formatNomor(servingPeserta.nomor_antrian)}</p>
                    <button onClick={handleSelesai} disabled={processing} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold text-lg py-3 rounded-lg shadow-sm transition-all active:scale-[0.98]">✓ SELESAI</button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">Belum ada peserta yang dilayani.</div>
                )}
              </div>

              {/* ALLOCATED / CALLED */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Menunggu di Depan</h4>
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{allocatedList.length} orang</span>
                </div>
                {allocatedList.length > 0 ? (
                  <div className="space-y-3">
                    {allocatedList.map((p) => (
                      <div key={p.id_peserta} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 flex-1">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${p.status === 'CALLED' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                            {p.status === 'CALLED' ? 'DIPANGGIL' : 'MENUNGGU'}
                          </span>
                          <span className="text-2xl font-extrabold text-gray-900">{formatNomor(p.nomor_antrian)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handlePesertaMasuk(p)} disabled={processing || !!servingPeserta} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg text-sm transition-all active:scale-95">MASUK</button>
                          {p.status === 'ALLOCATED' && (
                            <button onClick={() => handleCall(p)} disabled={processing} className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg text-sm transition-all active:scale-95">PANGGIL</button>
                          )}
                          <button onClick={() => handleDefer(p)} disabled={processing} className="px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg text-sm transition-all active:scale-95">DEFER</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 mb-4">Belum ada peserta dialokasikan.</div>
                )}
                <button 
                  onClick={handleNextAllocated} 
                  disabled={allocating || (selectedRuang.status !== 'READY' && selectedRuang.status !== 'SERVING') || (counters.waiting === 0 && counters.deferred === 0)} 
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {allocating ? (
                    <><span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> MENGALOKASIKAN...</>
                  ) : '➕ NEXT ALLOCATED (BATCH)'}
                </button>
              </div>

              {/* DEFERRED */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Deferred (Tunda)</h4>
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{deferredList.length} orang</span>
                </div>
                {deferredList.length > 0 ? (
                  <div className="space-y-2">
                    {deferredList.map((p) => (
                      <div key={p.id_peserta} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3 transition-all hover:bg-yellow-100">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-yellow-800">{formatNomor(p.nomor_antrian)}</span>
                          {p.deferred_ready && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold flex items-center gap-1">✓ SIAP</span>}
                        </div>
                        <button onClick={() => handleReturnDeferred(p)} disabled={p.deferred_ready || processing} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg text-sm transition-all active:scale-95">
                          {p.deferred_ready ? 'SUDAH KEMBALI' : 'KEMBALIKAN'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">Tidak ada peserta deferred.</div>
                )}
              </div>

              {/* KONTROL STATUS RUANG (MANUAL) */}
              <div className="border-t pt-4 mt-6">
                <p className="text-xs text-gray-500 uppercase font-bold mb-3">Kontrol Manual Ruang</p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleRoomStatus('PAUSE')}
                    disabled={processing || selectedRuang.status === 'PAUSE'}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2 rounded-lg transition text-sm"
                  >
                    ⏸ PAUSE (Istirahat)
                  </button>
                  <button 
                    onClick={() => handleRoomStatus('READY')}
                    disabled={processing || selectedRuang.status === 'READY'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2 rounded-lg transition text-sm"
                  >
                    ▶ AKTIF (READY)
                  </button>
                  <button 
                    onClick={() => handleRoomStatus('OFFLINE')}
                    disabled={processing || selectedRuang.status === 'OFFLINE'}
                    className="col-span-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2 rounded-lg transition text-sm"
                  >
                    ⏹ NONAKTIFKAN RUANG (OFFLINE)
                  </button>
                </div>
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  )
}

function CounterCard({ label, value, color }: { label: string, value: number, color: string }) {
  const colors: any = { gray: 'bg-gray-100 text-gray-800', blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800', indigo: 'bg-indigo-100 text-indigo-800' }
  return (
    <div className={`p-4 rounded-xl ${colors[color]} text-center shadow-sm transition-all hover:shadow-md`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-3xl font-extrabold mt-1">{value}</p>
    </div>
  )
}