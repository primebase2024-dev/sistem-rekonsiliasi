import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RuangDashboard } from './pages/ruang/RuangDashboard'
// Halaman Public
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'

// Halaman Protected
import { Dashboard } from './pages/Dashboard'
import { Display } from './pages/Display'

// Halaman Admin
import { AdminLayout } from './pages/admin/AdminLayout'
import { PekanList } from './pages/admin/PekanList'

// Halaman Sesi dan Ruang
import { SesiList } from './pages/admin/SesiList'
import { RuangList } from './pages/admin/RuangList'
// Halaman PintuDashboard
import { PintuDashboard } from './pages/pintu/PintuDashboard'
import { Home } from './pages/Home'

function App() {
  const { user, loading } = useAuth()

  // Tampilkan loading spinner saat mengecek sesi
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Memuat...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* 1. Public Routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />

      {/* 2. Protected Routes (Umum) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/display"
        element={
          <ProtectedRoute allowedRoles={['DISPLAY', 'ADMIN']}>
            <Display />
          </ProtectedRoute>
        }
      />

      {/* 3. Protected Admin Routes (Nested) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Route index untuk /admin */}
        <Route 
          index 
          element={
            <div className="text-center py-10 text-gray-500">
              Selamat datang di Dashboard Admin. Pilih menu di samping.
            </div>
          } 
        />
        {/* Route untuk /admin/pekan */}
        <Route path="pekan" element={<PekanList />} />
      </Route>
      {/* Route index untuk /admin */}
	  <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<div className="text-center py-10 text-gray-500">Selamat datang di Dashboard Admin. Pilih menu di samping.</div>} />
        <Route path="pekan" element={<PekanList />} />
        <Route path="sesi" element={<SesiList />} />
        <Route path="ruang" element={<RuangList />} />
      </Route>
		
	  {/* Route index untuk pintu */}
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
      {/* 4. Redirects & 404 */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
	  <Route path="/" element={<Home />} />
    </Routes>
  )
}

export default App