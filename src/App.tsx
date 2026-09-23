import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
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

import { PetugasSesiList } from './pages/admin/PetugasSesiList'
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
		  {/* Route index untuk /admin */}
		  <Route 
			index 
			element={
			  <div className="text-center py-10 text-gray-500">
				Selamat datang di Dashboard Admin. Pilih menu di samping.
			  </div>
			} 
		  />
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
		<Route path="*" element={<NotFound />} />
	  </Routes>
	)
}

export default App