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
    <div className="min-h-screen bg-background text-textMain flex flex-col">
      {/* Navbar */}
      <nav 
        className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
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

      {/* Main Content */}
      <main 
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
        style={{
          paddingBottom: isNative 
            ? 'calc(56px + env(safe-area-inset-bottom, 0px) + 2rem)' 
            : 'max(env(safe-area-inset-bottom, 0px), 2rem)'
        }}
      >
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Staff Dashboard</h1>
            <p className="text-textMuted text-sm mt-1">Manage reported items and verify matches.</p>
          </div>
          
          <button 
            onClick={() => setIsLogModalOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Plus size={18} />
            Log Found Item
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'found' ? 'bg-background shadow-sm text-white' : 'text-textMuted hover:text-white'}`}
            >
              Recent Found Items
            </button>
            <button 
              onClick={() => setActiveTab('matches')}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'matches' ? 'bg-background shadow-sm text-white' : 'text-textMuted hover:text-white'}`}
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
                className="w-full bg-surface border border-border rounded-xl py-2 pl-9 pr-4 text-white focus:outline-none focus:border-accent/50 text-sm placeholder:text-textMuted"
                placeholder="Search items..."
              />
            </div>
            <button className="p-2 bg-surface border border-border rounded-xl text-textMuted hover:text-white transition-colors">
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
            <div className="overflow-x-auto">
              {activeTab === 'found' ? (
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
                              <div className="w-10 h-10 rounded-lg bg-background border border-border overflow-hidden shrink-0">
                                {item.image_path ? (
                                  <img src={getImageUrl(item.image_path)} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-textMuted">
                                    <Package size={16} />
                                  </div>
                                )}
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
                              className="text-accent hover:text-white text-sm font-medium transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
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
                                <div className="w-6 h-6 rounded bg-background border border-border overflow-hidden shrink-0">
                                  <img src={getImageUrl(match.found_reports.image_path)} alt="" className="w-full h-full object-cover" />
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
                            <button className="text-accent hover:text-white text-sm font-medium transition-colors">
                              Review
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Log Found Item Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl relative my-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-white">Log Found Item</h2>
              <button onClick={() => setIsLogModalOpen(false)} className="text-textMuted hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitFoundItem} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1.5">Item Title</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm"
                      placeholder="e.g. Black Dell Laptop"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1.5">Category</label>
                    <select 
                      className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm appearance-none"
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
                    <label className="block text-sm font-medium text-textMuted mb-1.5">Found Location</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm"
                      placeholder="e.g. Library 2nd Floor"
                      value={formData.location_text}
                      onChange={e => setFormData({...formData, location_text: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1.5">Holding Location</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm"
                      placeholder="e.g. Main Help Desk"
                      value={formData.holding_location}
                      onChange={e => setFormData({...formData, holding_location: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1.5">Photo (Max 5MB)</label>
                    <div 
                      className="border-2 border-dashed border-border rounded-xl h-[130px] flex flex-col items-center justify-center bg-background cursor-pointer hover:border-accent/50 transition-colors relative overflow-hidden"
                      onClick={handleAttachPhoto}
                    >
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Upload size={24} className="text-textMuted mb-2" />
                          <span className="text-sm text-textMuted font-medium">{isNative ? 'Take Photo or Choose Gallery' : 'Click to upload image'}</span>
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
                    <label className="block text-sm font-medium text-textMuted mb-1.5">Additional Details</label>
                    <textarea 
                      required
                      className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm h-[130px] resize-none"
                      placeholder="Any distinguishing features, colors, brands, or condition..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    ></textarea>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-textMuted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
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

      {/* View Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl relative my-auto overflow-hidden">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setSelectedItem(null)} className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 backdrop-blur-md transition-all">
                <X size={16} />
              </button>
            </div>
            
            {selectedItem.image_path ? (
              <div className="w-full h-48 bg-background relative">
                <img src={getImageUrl(selectedItem.image_path)} alt={selectedItem.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent"></div>
              </div>
            ) : (
              <div className="w-full h-32 bg-background flex items-center justify-center border-b border-border">
                <Package size={48} className="text-border" />
              </div>
            )}
            
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border text-textMuted uppercase tracking-wider">
                      {selectedItem.category}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${selectedItem.status === 'claimed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'} uppercase tracking-wider`}>
                      {selectedItem.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedItem.title}</h2>
                </div>
              </div>
              
              <div className="space-y-4 mb-6 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <div className="text-textMuted text-xs mb-1">Found Location</div>
                    <div className="text-white font-medium truncate" title={selectedItem.location_text}>{selectedItem.location_text}</div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <div className="text-textMuted text-xs mb-1">Holding Location</div>
                    <div className="text-white font-medium truncate" title={selectedItem.holding_location || 'Not specified'}>{selectedItem.holding_location || 'Not specified'}</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-textMuted text-xs mb-1">Description</div>
                  <p className="text-white leading-relaxed">{selectedItem.description}</p>
                </div>
                
                {(selectedItem.brand || selectedItem.colors?.length > 0) && (
                  <div className="flex gap-4 pt-2 border-t border-border">
                    {selectedItem.brand && selectedItem.brand !== 'Unknown' && (
                      <div>
                        <div className="text-textMuted text-xs mb-0.5">Brand</div>
                        <div className="text-white">{selectedItem.brand}</div>
                      </div>
                    )}
                    {selectedItem.colors?.length > 0 && (
                      <div>
                        <div className="text-textMuted text-xs mb-0.5">Colors</div>
                        <div className="flex gap-1">
                          {selectedItem.colors.map((c: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-background border border-border text-xs capitalize text-white">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <div className="text-xs text-textMuted">
                    Logged on {new Date(selectedItem.found_at || selectedItem.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              
              {selectedItem.status !== 'claimed' && (
                <button 
                  onClick={() => markAsClaimed(selectedItem.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                >
                  <Check size={18} />
                  Mark as Claimed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
