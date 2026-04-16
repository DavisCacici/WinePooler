import { Routes, Route } from 'react-router-dom'
import { useAuth } from './lib/supabase/AuthContext'
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
import WineInventoryPage from './pages/winery/WineInventoryPage'
import WineInventoryProductPage from './pages/winery/WineInventoryProductPage'
import { AuthProvider } from './lib/supabase/AuthContext'
import { ThemeProvider } from './lib/theme/ThemeContext'
import LayoutShell from './components/layout/LayoutShell'
import WineryProfileForm from './pages/profile/WineryProfileForm'

type ProfileMode = 'complete' | 'edit'

const ProfileFormByRole = ({ mode }: { mode: ProfileMode }) => {
  const { role } = useAuth()

  if (role === 'buyer') {
    return <BuyerProfileForm mode={mode} />
  }

  return <WineryProfileForm mode={mode} />
}

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
            path="/dashboard/winery/inventory"
            element={
              <ProtectedDashboardRoute allowedRole="winery">
                <LayoutShell>
                  <WineInventoryPage />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/dashboard/winery/inventory/new"
            element={
              <ProtectedDashboardRoute allowedRole="winery">
                <LayoutShell>
                  <WineInventoryProductPage />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/dashboard/winery/inventory/:inventoryId"
            element={
              <ProtectedDashboardRoute allowedRole="winery">
                <LayoutShell>
                  <WineInventoryProductPage />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/complete"
            element={
              <ProtectedDashboardRoute allowedRole={['buyer', 'winery']}>
                <LayoutShell>
                  <ProfileFormByRole mode="complete" />
                </LayoutShell>
              </ProtectedDashboardRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedDashboardRoute allowedRole={['buyer', 'winery']}>
                <LayoutShell>
                  <ProfileFormByRole mode="edit" />
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
