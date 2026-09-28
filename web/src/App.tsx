import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import Chat from './pages/Chat'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import NativeTabBar from './components/NativeTabBar'
import { initNativeFeatures } from './lib/nativeBridge'

function NativeBridgeInitializer() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    initNativeFeatures(
      () => navigate(-1),
      () => location.pathname
    )
  }, [navigate, location])

  return null
}

export default function App() {
  return (
    <Router>
      <NativeBridgeInitializer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
      <NativeTabBar />
    </Router>
  )
}
