import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, Search, CheckCircle, Clock, Package, Bell, Loader2, X, Upload, Check, Filter } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { getApiUrl } from '../lib/config'
import { pickNativeImage, processImageFile } from '../lib/camera'
import { registerModal } from '../lib/nativeBridge'

export default function Dashboard() {
  const isNative = Capacitor.isNativePlatform()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'found' | 'matches'>('found')
  const [items, setItems] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [stats, setStats] = useState({ active: 0, claimed: 0, matches: 0, total: 0 })
  
  // Modal states
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  // Log item form states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    category: 'other',
    location_text: '',
    holding_location: '',
    description: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()

  useEffect(() => {
    checkUser()
    fetchData()
  }, [])

  // Android hardware back button handler: close open modals first
  useEffect(() => {
    const unregister = registerModal(() => {
      if (selectedItem) {
        setSelectedItem(null)
        return true
      }
      if (isLogModalOpen) {
        setIsLogModalOpen(false)
        return true
      }
      return false
    })
    return unregister
  }, [selectedItem, isLogModalOpen])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/auth')
    } else {
      setUser(session.user)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const [statsRes, foundRes, matchesRes] = await Promise.all([
        fetch(`${apiUrl}/api/stats`),
        fetch(`${apiUrl}/api/found?limit=20`),
        fetch(`${apiUrl}/api/matches?limit=10`)
      ])
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
      
      if (foundRes.ok) {
        const foundData = await foundRes.json()
        setItems(foundData.items || [])
      }

      if (matchesRes.ok) {
        const matchesData = await matchesRes.json()
        setMatches(matchesData.matches || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate(isNative ? '/chat' : '/')
  }

  const handleAttachPhoto = async () => {
    if (isNative) {
      try {
        const { file, previewUrl } = await pickNativeImage()
        setImageFile(file)
        setImagePreview(previewUrl)
      } catch (err: any) {
        if (err.message !== 'cancelled') {
          console.error('Camera error:', err)
        }
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleWebImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const { file: processed, previewUrl } = await processImageFile(file)
        setImageFile(processed)
        setImagePreview(previewUrl)
      } catch (err: any) {
        console.error('Image processing error:', err)
      }
    }
  }

  const submitFoundItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const data = new FormData()
      data.append('title', formData.title)
      data.append('category', formData.category)
      data.append('location_text', formData.location_text)
      data.append('holding_location', formData.holding_location)
      data.append('description', formData.description)
      if (imageFile) {
        data.append('image', imageFile)
      }

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/found`, {
        method: 'POST',
        body: data
      })

      if (response.ok) {
        // Reset form and close modal
        setFormData({ title: '', category: 'other', location_text: '', holding_location: '', description: '' })
        setImageFile(null)
        setImagePreview(null)
        setIsLogModalOpen(false)
        fetchData() // Refresh list
      }
    } catch (error) {
      console.error("Error logging item:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const markAsClaimed = async (itemId: string) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/found/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'claimed' })
      })

      if (response.ok) {
        setSelectedItem(null)
        fetchData() // Refresh list
      }
    } catch (error) {
      console.error("Error marking as claimed:", error)
    }
  }

  const getImageUrl = (path: string) => {
    if (!path) return ''
    if (path.startsWith('http')) return path
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mpqivpxswksjqkohhjje.supabase.co'
    return `${supabaseUrl}/storage/v1/object/public/item-images/${path}`
  }

  return (
    <div className="app-shell bg-background text-textMain">
      {/* Top Navbar pinned to safe area */}
      <nav 
        className="border-b border-border bg-background/90 backdrop-blur-md shrink-0 z-20"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer tap-target-44" onClick={() => navigate(isNative ? '/chat' : '/')}>
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                <Search size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white hidden sm:block">LostMate Staff</span>
            </div>

            <div className="flex items-center gap-4">
              <button className="tap-target-44 p-2 rounded-full text-textMuted hover:bg-surface transition-colors relative flex items-center justify-center">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-background"></span>
              </button>
              <div className="h-8 w-[1px] bg-border mx-1"></div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-white">{user?.email?.split('@')[0] || 'Staff'}</div>
                  <div className="text-xs text-textMuted">Administrator</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-sm font-medium">
                  {(user?.email?.[0] || 'S').toUpperCase()}
                </div>
                <button onClick={handleLogout} className="tap-target-44 p-2 text-textMuted hover:text-red-400 transition-colors ml-2 flex items-center justify-center" title="Sign out">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Single Scroll Area */}
      <main 
        className="main-scroll-area w-full"
        style={{
          paddingBottom: isNative 
            ? 'calc(64px + env(safe-area-inset-bottom, 0px) + 24px)' 
            : 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)'
        }}
      >
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Staff Dashboard</h1>
              <p className="text-textMuted text-sm mt-1">Manage reported items and verify matches.</p>
            </div>
            
            <button 
              onClick={() => setIsLogModalOpen(true)}
              className="bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2 w-full sm:w-auto justify-center tap-target-44"
            >
              <Plus size={18} />
              Log Found Item
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Package size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.active}</div>
                <div className="text-sm text-textMuted">Active Items</div>
              </div>
            </div>
            
            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.matches}</div>
                <div className="text-sm text-textMuted">Pending Claims</div>
              </div>
            </div>
            
            <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.claimed}</div>
                <div className="text-sm text-textMuted">Resolved</div>
              </div>
            </div>
          </div>

          {/* Tabs & Filters */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex bg-surface border border-border rounded-xl p-1 w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab('found')}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all tap-target-44 ${activeTab === 'found' ? 'bg-background shadow-sm text-white' : 'text-textMuted hover:text-white'}`}
              >
                Recent Found Items
              </button>
              <button 
                onClick={() => setActiveTab('matches')}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-medium transition-all tap-target-44 ${activeTab === 'matches' ? 'bg-background shadow-sm text-white' : 'text-textMuted hover:text-white'}`}
              >
                Match Alerts {stats.matches > 0 && <span className="ml-1.5 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.matches}</span>}
              </button>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                  <Search size={16} />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-surface border border-border rounded-xl py-2 pl-9 pr-4 text-white focus:outline-none focus:border-accent/50 text-sm placeholder:text-textMuted min-h-[44px]"
                  placeholder="Search items..."
                />
              </div>
              <button className="p-2.5 bg-surface border border-border rounded-xl text-textMuted hover:text-white transition-colors tap-target-44 flex items-center justify-center">
                <Filter size={18} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-textMuted">
              <div className="animate-spin mb-4"><Loader2 size={32} /></div>
              <p>Loading data...</p>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              {activeTab === 'found' ? (
                <>
                  {/* Mobile Stacked Card View (< 768px) */}
                  <div className="md:hidden divide-y divide-border">
                    {items.length === 0 ? (
                      <div className="p-8 text-center text-textMuted text-sm">
                        No items found in the database.
                      </div>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="p-4 flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-14 h-14 rounded-xl bg-background border border-border overflow-hidden shrink-0 relative flex items-center justify-center">
                              {item.image_path ? (
                                <img 
                                  src={getImageUrl(item.image_path)} 
                                  alt={item.title} 
                                  className="w-full h-full object-cover" 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.img-fallback');
                                    if (fallback) fallback.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`img-fallback w-full h-full flex items-center justify-center text-textMuted ${item.image_path ? 'hidden' : ''}`}>
                                <Package size={20} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h3 className="font-semibold text-white text-sm truncate">{item.title}</h3>
                                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'claimed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'claimed' ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                                  {item.status || 'Available'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-textMuted">
                                <span className="capitalize">{item.category}</span>
                                <span>•</span>
                                <span className="truncate">{item.location_text || 'Campus'}</span>
                              </div>
                              <div className="text-[11px] text-textMuted/70 mt-0.5">
                                {new Date(item.found_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => setSelectedItem(item)}
                            className="w-full py-2 bg-background hover:bg-white/5 border border-border text-accent text-xs font-semibold rounded-xl transition-colors flex items-center justify-center tap-target-44"
                          >
                            View Details
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table View (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-textMuted uppercase bg-background/50 border-b border-border">
                        <tr>
                          <th className="px-6 py-4 font-medium">Item</th>
                          <th className="px-6 py-4 font-medium">Category</th>
                          <th className="px-6 py-4 font-medium">Location</th>
                          <th className="px-6 py-4 font-medium">Status</th>
                          <th className="px-6 py-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-textMuted">
                              No items found in the database.
                            </td>
                          </tr>
                        ) : (
                          items.map((item) => (
                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-background border border-border overflow-hidden shrink-0 relative flex items-center justify-center">
                                    {item.image_path ? (
                                      <img 
                                        src={getImageUrl(item.image_path)} 
                                        alt={item.title} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const fallback = e.currentTarget.parentElement?.querySelector('.img-fallback');
                                          if (fallback) fallback.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <div className={`img-fallback w-full h-full flex items-center justify-center text-textMuted ${item.image_path ? 'hidden' : ''}`}>
                                      <Package size={16} />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-medium text-white">{item.title}</div>
                                    <div className="text-xs text-textMuted">{new Date(item.found_at).toLocaleDateString()}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-background border border-border text-xs text-textMuted capitalize">
                                  {item.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-textMuted truncate max-w-[150px]">
                                {item.location_text}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${item.status === 'claimed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'claimed' ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                                  {item.status || 'Available'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => setSelectedItem(item)}
                                  className="text-accent hover:text-white text-sm font-medium transition-colors tap-target-44 inline-flex items-center"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  {/* Mobile Stacked Match Cards (< 768px) */}
                  <div className="md:hidden divide-y divide-border">
                    {matches.length === 0 ? (
                      <div className="p-8 text-center text-textMuted text-sm">
                        No pending matches to review.
                      </div>
                    ) : (
                      matches.map((match) => (
                        <div key={match.id} className="p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white">Suggested Match</span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                              {Math.round(match.score)}% Match
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs bg-background/60 p-3 rounded-xl border border-border">
                            <div>
                              <div className="text-[10px] text-textMuted uppercase font-semibold mb-0.5">Lost Item</div>
                              <div className="font-medium text-white truncate">{match.lost_reports?.title}</div>
                              <div className="text-textMuted capitalize">{match.lost_reports?.category}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-textMuted uppercase font-semibold mb-0.5">Found Item</div>
                              <div className="font-medium text-white truncate">{match.found_reports?.title}</div>
                              <div className="text-textMuted capitalize">{match.found_reports?.category}</div>
                            </div>
                          </div>

                          {match.explanation && (
                            <p className="text-xs text-textMuted italic">{match.explanation}</p>
                          )}

                          <button 
                            onClick={() => setSelectedItem(match.found_reports)}
                            className="w-full py-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-xs font-semibold rounded-xl transition-colors tap-target-44 flex items-center justify-center"
                          >
                            Review Match Details
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Match Table (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-textMuted uppercase bg-background/50 border-b border-border">
                        <tr>
                          <th className="px-6 py-4 font-medium">Match Details</th>
                          <th className="px-6 py-4 font-medium">Lost Item</th>
                          <th className="px-6 py-4 font-medium">Found Item</th>
                          <th className="px-6 py-4 font-medium">Score</th>
                          <th className="px-6 py-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {matches.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-textMuted">
                              No pending matches to review.
                            </td>
                          </tr>
                        ) : (
                          matches.map((match) => (
                            <tr key={match.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">Suggested Match</div>
                                <div className="text-xs text-textMuted mt-1 max-w-[200px] truncate">{match.explanation}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">{match.lost_reports?.title}</div>
                                <div className="text-xs text-textMuted capitalize">{match.lost_reports?.category}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {match.found_reports?.image_path && (
                                    <div className="w-8 h-8 rounded bg-background border border-border overflow-hidden shrink-0 relative flex items-center justify-center">
                                      <img 
                                        src={getImageUrl(match.found_reports.image_path)} 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const fallback = e.currentTarget.parentElement?.querySelector('.img-fallback');
                                          if (fallback) fallback.classList.remove('hidden');
                                        }}
                                      />
                                      <div className="img-fallback hidden w-full h-full flex items-center justify-center text-textMuted">
                                        <Package size={14} />
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-white">{match.found_reports?.title}</div>
                                    <div className="text-xs text-textMuted capitalize">{match.found_reports?.category}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="inline-flex items-center px-2 py-1 rounded bg-green-500/10 text-green-400 font-medium">
                                  {Math.round(match.score)}%
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => setSelectedItem(match.found_reports)}
                                  className="text-accent hover:text-white text-sm font-medium transition-colors tap-target-44"
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Log Found Item Modal - with internal 90dvh scrolling & reachable submit button */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-hidden animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl relative my-auto max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <h2 className="text-lg font-bold text-white">Log Found Item</h2>
              <button onClick={() => setIsLogModalOpen(false)} className="tap-target-44 flex items-center justify-center text-textMuted hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitFoundItem} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Item Title</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                        placeholder="e.g. Black Dell Laptop"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Category</label>
                      <select 
                        className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        <option value="phone">Phone</option>
                        <option value="laptop">Laptop / Tablet</option>
                        <option value="headphones">Headphones</option>
                        <option value="wallet">Wallet</option>
                        <option value="keys">Keys</option>
                        <option value="id_card">ID / Card</option>
                        <option value="backpack">Bag / Backpack</option>
                        <option value="bottle">Water Bottle</option>
                        <option value="umbrella">Umbrella</option>
                        <option value="watch">Watch</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Found Location</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                        placeholder="e.g. Library 2nd Floor"
                        value={formData.location_text}
                        onChange={e => setFormData({...formData, location_text: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Holding Location</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                        placeholder="e.g. Main Help Desk"
                        value={formData.holding_location}
                        onChange={e => setFormData({...formData, holding_location: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Photo (Max 5MB)</label>
                      <div 
                        className="border-2 border-dashed border-border rounded-xl h-[120px] flex flex-col items-center justify-center bg-background cursor-pointer hover:border-accent/50 transition-colors relative overflow-hidden tap-target-44"
                        onClick={handleAttachPhoto}
                      >
                        {imagePreview ? (
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Upload size={22} className="text-textMuted mb-1.5" />
                            <span className="text-xs text-textMuted font-medium">{isNative ? 'Take Photo or Choose Gallery' : 'Click to upload image'}</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleWebImageChange}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Additional Details</label>
                      <textarea 
                        required
                        className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm h-[100px] resize-none"
                        placeholder="Distinguishing features, colors, brands, or condition..."
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 p-4 border-t border-border shrink-0 bg-background/50">
                <button 
                  type="button" 
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-textMuted hover:text-white transition-colors tap-target-44"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 tap-target-44 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing AI...</>
                  ) : (
                    'Log Item'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal - with internal 90dvh scrolling & reachable action */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-hidden animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl relative my-auto max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="absolute top-3 right-3 z-20">
              <button 
                onClick={() => setSelectedItem(null)} 
                className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white backdrop-blur-md transition-all tap-target-44"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto">
              {selectedItem.image_path ? (
                <div className="w-full h-44 bg-background relative shrink-0 flex items-center justify-center overflow-hidden">
                  <img 
                    src={getImageUrl(selectedItem.image_path)} 
                    alt={selectedItem.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.img-fallback');
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />
                  <div className="img-fallback hidden w-full h-full flex items-center justify-center text-textMuted bg-background">
                    <Package size={36} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent"></div>
                </div>
              ) : (
                <div className="w-full h-28 bg-background flex items-center justify-center border-b border-border shrink-0">
                  <Package size={36} className="text-textMuted/40" />
                </div>
              )}
              
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border text-textMuted uppercase tracking-wider">
                        {selectedItem.category}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${selectedItem.status === 'claimed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'} uppercase tracking-wider`}>
                        {selectedItem.status}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white">{selectedItem.title}</h2>
                  </div>
                </div>
                
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-background rounded-xl p-2.5 border border-border">
                      <div className="text-textMuted text-[10px] mb-0.5">Found Location</div>
                      <div className="text-white font-medium truncate" title={selectedItem.location_text}>{selectedItem.location_text || 'Unknown'}</div>
                    </div>
                    <div className="bg-background rounded-xl p-2.5 border border-border">
                      <div className="text-textMuted text-[10px] mb-0.5">Holding Location</div>
                      <div className="text-white font-medium truncate" title={selectedItem.holding_location || 'Main Storage'}>{selectedItem.holding_location || 'Main Storage'}</div>
                    </div>
                  </div>
                  
                  <div className="bg-background/50 rounded-xl p-3 border border-border">
                    <div className="text-textMuted text-[10px] mb-1 font-semibold uppercase">Description</div>
                    <p className="text-white leading-relaxed">{selectedItem.description}</p>
                  </div>
                  
                  {(selectedItem.brand || selectedItem.colors?.length > 0) && (
                    <div className="flex gap-4 pt-2 border-t border-border">
                      {selectedItem.brand && selectedItem.brand !== 'Unknown' && (
                        <div>
                          <div className="text-textMuted text-[10px] mb-0.5">Brand</div>
                          <div className="text-white font-medium">{selectedItem.brand}</div>
                        </div>
                      )}
                      {selectedItem.colors?.length > 0 && (
                        <div>
                          <div className="text-textMuted text-[10px] mb-0.5">Colors</div>
                          <div className="flex gap-1 flex-wrap">
                            {selectedItem.colors.map((c: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] capitalize text-white">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-[11px] text-textMuted/70 pt-2 border-t border-border">
                    Logged: {new Date(selectedItem.found_at || selectedItem.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer with Reachable Button */}
            {selectedItem.status !== 'claimed' && (
              <div className="p-4 border-t border-border bg-background/50 shrink-0">
                <button 
                  onClick={() => markAsClaimed(selectedItem.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] tap-target-44"
                >
                  <Check size={16} />
                  Mark as Claimed
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
