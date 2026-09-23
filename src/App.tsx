import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

// Public Pages
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Display } from './pages/Display'

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout'
import { PekanList } from './pages/admin/PekanList'
import { SesiList } from './pages/admin/SesiList'
import { RuangList } from './pages/admin/RuangList'
import { PetugasSesiList } from './pages/admin/PetugasSesiList'

// Petugas Pages
import { PintuDashboard } from './pages/pintu/PintuDashboard'
import { RuangDashboard } from './pages/ruang/RuangDashboard'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Memuat...
      </div>
    )
  }

  return (
    <Routes>
      {/* 1. Home Page (PALING ATAS) */}
      <Route path="/" element={<Home />} />

      {/* 2. Public Routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <Login />} 
      />

      {/* 3. Display (Bisa diakses tanpa login untuk TV) */}
      <Route path="/display" element={<Display />} />

      {/* 4. Protected Admin Routes (Nested) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={
          <div className="text-center py-10 text-gray-500">
            Selamat datang di Dashboard Admin. Pilih menu di samping.
          </div>
        } />
        <Route path="pekan" element={<PekanList />} />
        <Route path="sesi" element={<SesiList />} />
        <Route path="ruang" element={<RuangList />} />
        <Route path="petugas" element={<PetugasSesiList />} />
      </Route>

      {/* 5. Protected Petugas Routes */}
      <Route
        path="/pintu"
        element={
          <ProtectedRoute allowedRoles={['PETUGAS_PINTU', 'ADMIN']}>
            <PintuDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ruang"
        element={
          <ProtectedRoute allowedRoles={['PETUGAS_RUANG', 'ADMIN']}>
            <RuangDashboard />
          </ProtectedRoute>
        }
      />

      {/* 6. 404 Not Found */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-gray-400">404</h1>
            <p className="text-xl text-gray-500 mt-2">Halaman tidak ditemukan</p>
            <a href="/" className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block">
              ← Kembali ke Home
            </a>
          </div>
        </div>
      } />
    </Routes>
  )
}

export default App