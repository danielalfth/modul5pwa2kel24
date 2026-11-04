import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FavoritesProvider } from './contexts/FavoritesContext.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import PWABadge from './components/PWABadge.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import { Loader } from 'lucide-react'
import './App.css'

// ponytail: code-split halaman berat, Catalog tetap eager karena landing page
import Catalog from './pages/Catalog.jsx'

const GunDetailPage  = lazy(() => import('./pages/GunDetailPage.jsx'))
const CreateGunPage  = lazy(() => import('./pages/CreateGunPage.jsx'))
const EditGunPage    = lazy(() => import('./pages/EditGunPage.jsx'))
const FavoritesPage  = lazy(() => import('./pages/FavoritesPage.jsx'))
const ProfilePage    = lazy(() => import('./pages/ProfilePage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))

function PageLoader() {
  return (
    <div className="state-box" style={{ marginTop: 48 }}>
      <Loader size={28} className="spin" />
    </div>
  )
}

function AppShell() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <div className="shell">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <Header onReplaySplash={() => setShowSplash(true)} />

      <main className="main">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"             element={<Catalog />} />
            <Route path="/catalog/:id"  element={<GunDetailPage />} />
            <Route path="/create"       element={<CreateGunPage />} />
            <Route path="/edit/:id"     element={<EditGunPage />} />
            <Route path="/favorites"    element={<FavoritesPage />} />
            <Route path="/profile"      element={<ProfilePage onReplaySplash={() => setShowSplash(true)} />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            {/* catch-all */}
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <PWABadge />
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <FavoritesProvider>
        <AppShell />
      </FavoritesProvider>
    </BrowserRouter>
  )
}
