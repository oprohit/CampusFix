import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { MessageSquare, Package, Bell, User, LogOut, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function NativeTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const isNative = Capacitor.isNativePlatform()

  const [showAlerts, setShowAlerts] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!isNative) return null

  // Do not show tab bar on auth screen
  if (location.pathname === '/auth') return null

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setShowProfile(false)
    navigate('/auth')
  }

  const currentTab = location.pathname

  return (
    <>
      {/* Alerts Modal */}
      {showAlerts && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#12122b] border border-white/10 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-accent" />
                <h3 className="font-semibold text-sm">Match & Status Alerts</h3>
              </div>
              <button 
                onClick={() => setShowAlerts(false)}
                className="tap-target-44 flex items-center justify-center p-2 text-textMuted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                <span className="font-semibold text-green-400 block mb-1">Live Notifications Active</span>
                Realtime database listener is connected. You will receive alert cards in chat whenever a matching item is turned in.
              </div>
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="mt-4 w-full py-2.5 bg-accent rounded-xl text-xs font-semibold text-white tap-target-44"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#12122b] border border-white/10 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <User size={18} className="text-accent" />
                <h3 className="font-semibold text-sm">Account Profile</h3>
              </div>
              <button 
                onClick={() => setShowProfile(false)} 
                className="tap-target-44 flex items-center justify-center p-2 text-textMuted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-4">
              <div className="text-xs text-textMuted mb-1">Signed in as:</div>
              <div className="font-medium text-sm text-white break-all">
                {user ? user.email : 'Guest / Campus User'}
              </div>
            </div>
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 tap-target-44"
              >
                <LogOut size={16} /> Sign Out
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowProfile(false)
                  navigate('/auth')
                }}
                className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold tap-target-44"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compact Native Bottom Navigation Bar */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0B1E]/95 border-t border-white/10 backdrop-blur-md safe-bottom-bar flex items-center justify-around px-2"
        style={{ height: 'calc(54px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={() => navigate('/chat')}
          className={`tap-target-44 flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
            currentTab === '/chat' ? 'text-accent' : 'text-textMuted hover:text-white'
          }`}
        >
          <MessageSquare size={19} />
          <span className="text-[10px] font-medium tracking-tight">Chat</span>
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className={`tap-target-44 flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
            currentTab === '/dashboard' ? 'text-accent' : 'text-textMuted hover:text-white'
          }`}
        >
          <Package size={19} />
          <span className="text-[10px] font-medium tracking-tight">Reports</span>
        </button>

        <button
          onClick={() => setShowAlerts(true)}
          className="tap-target-44 flex flex-col items-center justify-center gap-1 flex-1 py-1 text-textMuted hover:text-white transition-colors relative"
        >
          <Bell size={19} />
          <span className="text-[10px] font-medium tracking-tight">Alerts</span>
          <span className="absolute top-2 right-1/3 w-1.5 h-1.5 bg-accent rounded-full"></span>
        </button>

        <button
          onClick={() => setShowProfile(true)}
          className="tap-target-44 flex flex-col items-center justify-center gap-1 flex-1 py-1 text-textMuted hover:text-white transition-colors"
        >
          <User size={19} />
          <span className="text-[10px] font-medium tracking-tight">Profile</span>
        </button>
      </nav>
    </>
  )
}
