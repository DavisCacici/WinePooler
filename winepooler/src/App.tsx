import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Register from './pages/Register'
import Login from './pages/Login'
import BuyerDashboard from './pages/dashboards/BuyerDashboard'
import WineryDashboard from './pages/dashboards/WineryDashboard'
import DashboardRouter from './pages/dashboards/DashboardRouter'
import ProtectedDashboardRoute from './pages/dashboards/ProtectedDashboardRoute'
import BuyerProfileForm from './pages/profile/BuyerProfileForm'
import AreaSelectionPage from './pages/profile/AreaSelectionPage'
import PurchasingPreferencesForm from './pages/profile/PurchasingPreferencesForm'
import { AuthProvider } from './lib/supabase/AuthContext'

const App = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route
            path="/dashboard/buyer"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <BuyerDashboard />
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/dashboard/winery"
            element={
              <ProtectedDashboardRoute allowedRole="winery">
                <WineryDashboard />
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/complete"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <BuyerProfileForm mode="complete" />
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <BuyerProfileForm mode="edit" />
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/area"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <AreaSelectionPage />
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/preferences"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <PurchasingPreferencesForm />
              </ProtectedDashboardRoute>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  )
}

export default App
