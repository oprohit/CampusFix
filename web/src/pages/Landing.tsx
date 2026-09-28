import { useState, useEffect } from 'react'
import {
  Menu,
  X,
  Search,
  MessageSquare,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Mic,
  Moon,
  Sun
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// Demo Chat Sequence
const CHAT_SEQUENCE = [
  { role: 'user', text: "I lost my black over-ear headphones near Gate 7 around 9 PM.", image: true },
  { role: 'bot', text: "I can help with that. Did they have any distinct markings or branding?", delay: 1500 },
  { role: 'user', text: "Yes, they are Sony WH-1000XM4, slightly scratched on the left side.", delay: 3500 },
  {
    role: 'bot',
    match: true,
    delay: 5500,
    text: "I found a strong match!",
    foundItem: {
      image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=400&q=80",
      score: 96,
      reason: "Matches brand, color, location (Gate 7), and time."
    }
  }
]

export default function Landing() {
  const navigate = useNavigate()
  const isNative = Capacitor.isNativePlatform()
  const [nativeChecking, setNativeChecking] = useState(isNative)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isDark, setIsDark] = useState(true)

  // Direct redirection on native apps: Chat if logged in, else Auth
  useEffect(() => {
    if (!isNative) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/chat', { replace: true })
      } else {
        navigate('/auth', { replace: true })
      }
      setNativeChecking(false)
    }).catch(() => {
      navigate('/auth', { replace: true })
      setNativeChecking(false)
    })
  }, [isNative, navigate])

  // Chat Demo State
  const [demoStep, setDemoStep] = useState(0)
  const [visibleMessages, setVisibleMessages] = useState<any[]>([])
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (demoStep >= CHAT_SEQUENCE.length) return

    const nextMsg = CHAT_SEQUENCE[demoStep]
    const delay = nextMsg.delay || 500

    const timer = setTimeout(() => {
      if (nextMsg.role === 'bot') {
        setIsTyping(true)
        setTimeout(() => {
          setIsTyping(false)
          setVisibleMessages((prev) => [...prev, nextMsg])
          setDemoStep((s) => s + 1)
        }, 1500)
      } else {
        setVisibleMessages((prev) => [...prev, nextMsg])
        setDemoStep((s) => s + 1)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [demoStep])

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  if (nativeChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse">
          <Search size={24} className="text-white" />
        </div>
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-[100dvh] ${isDark ? 'dark bg-background text-textMain' : 'bg-gray-50 text-gray-900'} transition-colors duration-200 overflow-y-auto overflow-x-hidden relative`}>
      {/* Background Elements */}
      {isDark && (
        <>
          <div className="absolute inset-0 bg-grid z-0 opacity-40"></div>
          <div className="glow-effect"></div>
        </>
      )}

      {/* Navbar */}
      <nav 
        className={`relative z-10 border-b ${isDark ? 'border-border bg-background/80' : 'border-gray-200 bg-white/80'} backdrop-blur-md sticky top-0`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Search size={20} className="text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">LostMate AI</span>
            </div>

            {/* Desktop Menu - Hidden since this is a demo landing page */}

            <div className="hidden md:flex items-center gap-4">
              <button onClick={toggleTheme} className={`p-2 rounded-full ${isDark ? 'hover:bg-surface text-textMuted' : 'hover:bg-gray-100 text-gray-600'} transition-colors`}>
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Link to="/auth" className={`text-sm font-medium ${isDark ? 'text-textMuted hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>Sign In</Link>
              <Link to="/chat" className="bg-accent hover:bg-accent/90 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                Start Free Trial
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={isDark ? 'text-textMuted' : 'text-gray-600'}>
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className={`md:hidden ${isDark ? 'bg-background border-b border-border' : 'bg-white border-b border-gray-200'} p-4`}>
            <div className="flex flex-col space-y-4">
              {/* Removed dead placeholder links */}
              <Link to="/auth" className={`text-base font-medium ${isDark ? 'text-textMuted' : 'text-gray-600'}`}>Sign In</Link>
              <Link to="/chat" className="bg-accent text-white px-4 py-2 rounded-full text-center font-medium">Start Free Trial</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Copy & CTA */}
          <div className="flex flex-col items-start space-y-8">
            
            {/* Toggle */}
            <div className={`inline-flex items-center p-1 rounded-full ${isDark ? 'bg-surface border border-border' : 'bg-gray-100 border border-gray-200'}`}>
              <button
                onClick={() => setIsStaff(false)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!isStaff ? 'bg-accent text-white shadow-sm' : isDark ? 'text-textMuted hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                For Guests
              </button>
              <button
                onClick={() => setIsStaff(true)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${isStaff ? 'bg-accent text-white shadow-sm' : isDark ? 'text-textMuted hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                For Staff & Admins
              </button>
            </div>

            <div>
              <h1 className={`text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isStaff ? 'Automate your campus' : 'Lost something?'} <br />
                <span className="text-accent">{isStaff ? 'lost & found.' : 'Let AI find it.'}</span>
              </h1>
              <p className={`mt-4 text-lg max-w-xl leading-relaxed ${isDark ? 'text-textMuted' : 'text-gray-600'}`}>
                {isStaff
                  ? 'Reduce staff workload by 80%. Our smart matching engine instantly connects found items with passenger reports using advanced image and text recognition.'
                  : 'Stop filling out forms. Just chat with our AI, upload a photo of what you lost, and get instantly notified the second a match is found.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link to="/chat" className="bg-accent hover:bg-accent/90 text-white px-8 py-3.5 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center gap-2">
                <MessageSquare size={18} />
                Try the Chat
              </Link>
              <Link to="/auth" className={`px-8 py-3.5 rounded-full font-medium transition-colors border ${isDark ? 'border-border bg-surface text-white hover:bg-surface/80' : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'}`}>
                Get Started
              </Link>
            </div>

            <div className={`grid grid-cols-2 gap-y-3 gap-x-6 pt-4 text-sm font-medium ${isDark ? 'text-textMuted' : 'text-gray-500'}`}>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> No app download required</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> AI-powered smart matching</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> Instant photo recognition</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> Real-time recovery updates</div>
            </div>
          </div>

          {/* Right Column: Phone Mockup */}
          <div className="relative mx-auto w-full max-w-[340px] lg:max-w-[380px]">
            {/* Glow behind phone */}
            <div className="absolute inset-0 bg-accent/20 blur-[80px] rounded-full"></div>
            
            {/* Phone Frame */}
            <div className={`relative ${isDark ? 'bg-[#05050A] border-gray-800' : 'bg-gray-50 border-gray-300'} border-[8px] rounded-[3rem] h-[700px] w-full shadow-2xl overflow-hidden flex flex-col`}>
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
                <div className={`w-32 h-6 ${isDark ? 'bg-gray-800' : 'bg-gray-300'} rounded-b-3xl`}></div>
              </div>

              {/* Chat Header */}
              <div className={`pt-10 pb-4 px-6 border-b ${isDark ? 'border-border bg-background/90' : 'border-gray-200 bg-white/90'} backdrop-blur-sm z-10 flex items-center gap-3`}>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <Search size={20} className="text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                </div>
                <div>
                  <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>LostMate Assistant</h3>
                  <p className={`text-xs ${isDark ? 'text-textMuted' : 'text-gray-500'}`}>Online · replies instantly</p>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 no-scrollbar">
                {visibleMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                    
                    {msg.image && (
                      <div className={`mb-1 p-1 rounded-2xl ${isDark ? 'bg-accent/20' : 'bg-indigo-50'} self-end`}>
                        <img src="https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=200&q=80" alt="Lost item" className="rounded-xl w-32 h-32 object-cover opacity-80 mix-blend-luminosity" />
                        <div className="text-[10px] font-medium text-accent mt-1 px-2 text-right">Photo attached</div>
                      </div>
                    )}
                    
                    {msg.text && (
                      <div className={`px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-accent text-white rounded-br-sm' : isDark ? 'bg-surface border border-border text-white rounded-bl-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'}`}>
                        {msg.text}
                      </div>
                    )}

                    {msg.match && (
                      <div className={`mt-2 w-full rounded-2xl overflow-hidden border ${isDark ? 'bg-background border-border' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="relative h-32 w-full">
                          <img src={msg.foundItem.image} alt="Found item" className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                            {msg.foundItem.score}% Match
                          </div>
                        </div>
                        <div className="p-3">
                          <p className={`text-xs ${isDark ? 'text-textMuted' : 'text-gray-600'} leading-relaxed`}>{msg.foundItem.reason}</p>
                          <button className="mt-3 w-full bg-accent/10 hover:bg-accent/20 text-accent font-medium py-2 rounded-lg text-sm transition-colors">
                            Yes, this is mine!
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {isTyping && (
                  <div className="self-start flex gap-1 items-center px-4 py-3 rounded-2xl bg-surface border border-border rounded-bl-sm w-16 h-10 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-textMuted animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-textMuted animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-textMuted animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
                
                <div className="h-4 w-full"></div> {/* Bottom padding spacer */}
              </div>

              {/* Chat Input Bar */}
              <div className={`p-3 border-t ${isDark ? 'border-border bg-background' : 'border-gray-200 bg-white'}`}>
                <div className={`flex items-center gap-2 rounded-full px-2 py-1.5 ${isDark ? 'bg-surface border border-border' : 'bg-gray-100 border border-gray-200'}`}>
                  <button className={`p-1.5 rounded-full ${isDark ? 'text-textMuted hover:bg-white/5' : 'text-gray-500 hover:bg-gray-200'}`}><Camera size={18} /></button>
                  <button className={`p-1.5 rounded-full ${isDark ? 'text-textMuted hover:bg-white/5' : 'text-gray-500 hover:bg-gray-200'}`}><ImageIcon size={18} /></button>
                  <input type="text" placeholder="Message..." className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 text-current" disabled />
                  <button className={`p-1.5 rounded-full ${isDark ? 'text-textMuted hover:bg-white/5' : 'text-gray-500 hover:bg-gray-200'}`}><Mic size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Simplified Footer */}
      <footer className={`border-t relative z-10 py-8 ${isDark ? 'border-border bg-background/50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className={`text-sm ${isDark ? 'text-textMuted' : 'text-gray-500'}`}>© 2026 LostMate AI. Building smarter campuses.</p>
        </div>
      </footer>
    </div>
  )
}
