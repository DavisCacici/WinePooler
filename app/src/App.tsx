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
import { ThemeProvider } from './lib/theme/ThemeContext'
import LayoutShell from './components/layout/LayoutShell'

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Unauthenticated routes — no layout shell */}
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Dashboard router */}
          <Route path="/dashboard" element={<DashboardRouter />} />

          {/* Authenticated routes — wrapped in LayoutShell */}
          <Route
            path="/dashboard/buyer"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <LayoutShell>
                  <BuyerDashboard />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/dashboard/winery"
            element={
              <ProtectedDashboardRoute allowedRole="winery">
                <LayoutShell>
                  <WineryDashboard />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/complete"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <LayoutShell>
                  <BuyerProfileForm mode="complete" />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <LayoutShell>
                  <BuyerProfileForm mode="edit" />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/area"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <LayoutShell>
                  <AreaSelectionPage />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/preferences"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <LayoutShell>
                  <PurchasingPreferencesForm />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
