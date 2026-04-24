import { Routes, Route } from 'react-router-dom'
import { useAuth } from './lib/supabase/AuthContext'
import { ThemeProvider } from './lib/theme/ThemeContext'
import { AuthProvider } from './lib/supabase/AuthContext'
import { lazy } from 'react'
const Home = lazy(() => import('./pages/Home'))
const Register = lazy(() => import('./pages/Register'))
const Login = lazy(() => import('./pages/Login'))
const BuyerDashboard = lazy(() => import('./pages/dashboards/BuyerDashboard'))
const WineryDashboard = lazy(() => import('./pages/dashboards/WineryDashboard'))
const DashboardRouter = lazy(() => import('./pages/dashboards/DashboardRouter'))
const ProtectedDashboardRoute = lazy(() => import('./pages/dashboards/ProtectedDashboardRoute'))
const BuyerProfileForm = lazy(() => import('./pages/profile/BuyerProfileForm'))
const AreaSelectionPage = lazy(() => import('./pages/profile/AreaSelectionPage'))
const PurchasingPreferencesForm = lazy(() => import('./pages/profile/PurchasingPreferencesForm'))
const WineInventoryPage = lazy(() => import('./pages/winery/WineInventoryPage'))
const WineInventoryProductPage = lazy(() => import('./pages/winery/WineInventoryProductPage'))
const LayoutShell = lazy(() => import('./components/layout/LayoutShell'));
const WineryProfileForm = lazy(() => import('./pages/profile/WineryProfileForm'));


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
