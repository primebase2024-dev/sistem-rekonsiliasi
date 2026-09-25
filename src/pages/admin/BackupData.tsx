import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export function BackupData() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Daftar tabel yang akan di-backup (Data Operasional)
  const tablesToBackup = [
    'rekonsiliasi_pekan',
    'rekonsiliasi_sesi',
    'rekonsiliasi_ruang',
    'rekonsiliasi_peserta',
    'rekonsiliasi_petugas_sesi' // Tabel ini TIDAK punya tenant_id (terikat via id_sesi)
  ]

  // --- FUNGSI EXPORT (DOWNLOAD BACKUP) ---
  async function handleExport() {
    if (!profile?.tenant_id) return
    setLoading(true)
    setMessage('')

    const backupData: any = {
      metadata: {
        tenant_id: profile.tenant_id,
        backup_date: new Date().toISOString(),
        app_version: '1.0.0'
      },
      data: {}
    }

    try {
      for (const table of tablesToBackup) {
        // Mulai query dasar
        let query = supabase.from(table).select('*')
        
        // KECUALI tabel 'rekonsiliasi_petugas_sesi' karena tidak punya kolom tenant_id
        if (table !== 'rekonsiliasi_petugas_sesi') {
          query = query.eq('tenant_id', profile.tenant_id)
        }

        const { data, error } = await query

        if (error) throw new Error(`Gagal mengambil ${table}: ${error.message}`)
        backupData.data[table] = data || []
      }

      // Download sebagai file JSON
      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Backup_SAR_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setMessage('✅ Backup berhasil didownload! Simpan file ini di tempat yang aman.')
    } catch (err: any) {
      setMessage(`❌ Gagal backup: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // --- FUNGSI IMPORT (RESTORE DARI FILE) ---
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!profile?.tenant_id) return

    if (!window.confirm('PERINGATAN: Restore akan menimpa/menambahkan data ke database Anda. Lanjutkan?')) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const text = await file.text()
      const backupData = JSON.parse(text)

      if (!backupData.data) throw new Error('Format file backup tidak valid.')

      for (const table of tablesToBackup) {
        const rows = backupData.data[table]
        if (rows && rows.length > 0) {
          
          let primaryKey = 'id'
          if (table === 'rekonsiliasi_pekan') primaryKey = 'id_pekan'
          if (table === 'rekonsiliasi_sesi') primaryKey = 'id_sesi'
          if (table === 'rekonsiliasi_ruang') primaryKey = 'id_ruang'
          if (table === 'rekonsiliasi_peserta') primaryKey = 'id_peserta'
          if (table === 'rekonsiliasi_petugas_sesi') primaryKey = 'id' // Sesuaikan jika PK-nya berbeda

          // Gunakan upsert. Hapus .eq() karena upsert tidak mendukung filter chaining seperti itu
          const { error } = await supabase
            .from(table)
            .upsert(rows, { onConflict: primaryKey })

          if (error) throw new Error(`Gagal restore ${table}: ${error.message}`)
        }
      }

      setMessage('✅ Restore berhasil! Data telah diperbarui.')
    } catch (err: any) {
      setMessage(`❌ Gagal restore: ${err.message}`)
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Backup & Restore Database</h2>
        <p className="text-gray-500 mt-1">Kelola arsip data operasional paroki Anda secara lokal.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KARTU EXPORT */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="text-4xl mb-4">📥</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Download Backup</h3>
          <p className="text-sm text-gray-600 mb-6 flex-1">
            Unduh seluruh data (Pekan, Sesi, Ruang, Peserta, Petugas) ke dalam file JSON. 
            Simpan file ini di komputer Anda sebagai arsip keamanan.
          </p>
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition"
          >
            {loading ? 'Memproses...' : 'Mulai Backup (Download)'}
          </button>
        </div>

        {/* KARTU IMPORT */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="text-4xl mb-4">📤</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Restore Data</h3>
          <p className="text-sm text-gray-600 mb-6 flex-1">
            Upload file backup (.json) yang pernah Anda download sebelumnya untuk mengembalikan data ke sistem.
          </p>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImport}
            disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 cursor-pointer"
          />
        </div>
      </div>

      {/* INFO TABEL */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Data yang termasuk dalam Backup:</h4>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          {tablesToBackup.map(t => (
            <li key={t} className="font-mono">{t}</li>
          ))}
        </ul>
        <p className="text-xs text-blue-600 mt-3 italic">
          *Catatan: Data akun user (login & password) tidak disertakan dalam backup ini demi alasan keamanan.
        </p>
      </div>
    </div>
  )
}