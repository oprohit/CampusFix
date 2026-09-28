import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react'
import { Capacitor } from '@capacitor/core'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const isNative = Capacitor.isNativePlatform()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        navigate('/chat')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password
        })
        if (error) throw error
        setMessage('Registration successful! You can now log in.')
        setIsLogin(true)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (isNative) return
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/chat'
        }
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'Google sign-in error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen bg-background text-textMain dark flex flex-col relative overflow-hidden"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)'
      }}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid z-0 opacity-40 pointer-events-none"></div>
      <div className="glow-effect"></div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Back Action */}
          <button 
            type="button"
            onClick={() => navigate(isNative ? '/chat' : '/')} 
            className="inline-flex items-center gap-2 text-sm text-textMuted hover:text-white mb-6 transition-colors tap-target-44"
          >
            <ArrowLeft size={18} /> {isNative ? 'Back to Chat' : 'Back to Home'}
          </button>

          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Search size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1.5">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-textMuted text-xs sm:text-sm text-center">
              {isLogin 
                ? 'Sign in to access your reports and manage lost items.' 
                : 'Join LostMate to start reporting and recovering campus items.'}
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-xl backdrop-blur-sm">
            
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            {message && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                {message}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textMuted mb-1.5 ml-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all text-sm placeholder:text-textMuted/50 min-h-[44px]"
                    placeholder="student@campus.edu"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
                  <label className="block text-sm font-medium text-textMuted">Password</label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all text-sm placeholder:text-textMuted/50 min-h-[44px]"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 text-white font-medium py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] mt-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
              </button>
            </form>

            {/* Google OAuth - Hidden on native platforms to prevent Google OAuth WebView blocking */}
            {!isNative && (
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-white/5 hover:bg-white/10 border border-border text-white text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-textMuted">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                  setMessage(null)
                }}
                className="text-white hover:text-accent font-medium transition-colors tap-target-44"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
