import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-indigo-600">SAR</span>
              </div>
            </div>
            <div className="flex items-center">
              <div className="ml-3 relative flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{profile?.full_name || 'User'}</p>
                  <p className="text-xs text-gray-500">{profile?.role || 'Unknown Role'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-white border border-gray-300 rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard Placeholder</h2>
              <p className="mt-2 text-gray-600">
                Logged in as: {user?.email}
              </p>
              <p className="mt-1 text-gray-500 text-sm">
                Phase 1 Foundation Complete. Ready for Phase 2: Database.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}