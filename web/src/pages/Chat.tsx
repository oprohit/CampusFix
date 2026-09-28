import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Search, ImageIcon, X, Send, Loader2, Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { pickNativeImage, processImageFile } from '../lib/camera'
import { getApiUrl } from '../lib/config'
import { registerModal } from '../lib/nativeBridge'

interface Message {
  role: 'user' | 'bot'
  type: 'text' | 'image' | 'match_cards'
  content: string
  imagePreview?: string
  matches?: any[]
}

export default function Chat() {
  const isNative = Capacitor.isNativePlatform()

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      type: 'text',
      content: "Hi! I'm LostMate AI. What did you lose? Or, if you found something, click 'Report Found Item' at the top right!"
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  
  // Found Item Modal states
  const [isFoundModalOpen, setIsFoundModalOpen] = useState(false)
  const [isSubmittingFound, setIsSubmittingFound] = useState(false)
  const [foundSuccess, setFoundSuccess] = useState(false)
  const [foundData, setFoundData] = useState({
    title: '',
    category: 'other',
    location_text: '',
    holding_location: '',
    description: ''
  })
  const [foundImage, setFoundImage] = useState<File | null>(null)
  const [foundImagePreview, setFoundImagePreview] = useState<string | null>(null)
  const foundFileRef = useRef<HTMLInputElement>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom whenever messages or typing change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Handle Android hardware back button for modals
  useEffect(() => {
    const unregister = registerModal(() => {
      if (isFoundModalOpen) {
        setIsFoundModalOpen(false)
        return true
      }
      return false
    })
    return unregister
  }, [isFoundModalOpen])

  // Native keyboard listeners: scroll message list when keyboard appears
  useEffect(() => {
    if (!isNative) return

    const willShowSub = Keyboard.addListener('keyboardWillShow', () => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    })

    const didShowSub = Keyboard.addListener('keyboardDidShow', () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })

    return () => {
      willShowSub.then(sub => sub.remove()).catch(() => {})
      didShowSub.then(sub => sub.remove()).catch(() => {})
    }
  }, [isNative])

  // Web fallback image select (downscaled and validated)
  const handleWebImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null)
    if (e.target.files && e.target.files[0]) {
      try {
        const { file, previewUrl } = await processImageFile(e.target.files[0])
        setSelectedImage(file)
        setImagePreview(previewUrl)
      } catch (err: any) {
        setPhotoError(err.message || 'Invalid image selected.')
      }
    }
  }

  // Web fallback found image select (downscaled and validated)
  const handleWebFoundImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null)
    if (e.target.files && e.target.files[0]) {
      try {
        const { file, previewUrl } = await processImageFile(e.target.files[0])
        setFoundImage(file)
        setFoundImagePreview(previewUrl)
      } catch (err: any) {
        setPhotoError(err.message || 'Invalid image selected.')
      }
    }
  }

  // Trigger camera or gallery on native, or file picker on web
  const handleAttachPhoto = async () => {
    setPhotoError(null)
    if (isNative) {
      try {
        const result = await pickNativeImage()
        setSelectedImage(result.file)
        setImagePreview(result.previewUrl)
      } catch (err: any) {
        if (err.message !== 'cancelled') {
          setPhotoError(err.message || 'Could not access camera or photos.')
        }
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFoundAttachPhoto = async () => {
    setPhotoError(null)
    if (isNative) {
      try {
        const result = await pickNativeImage()
        setFoundImage(result.file)
        setFoundImagePreview(result.previewUrl)
      } catch (err: any) {
        if (err.message !== 'cancelled') {
          setPhotoError(err.message || 'Could not access camera or photos.')
        }
      }
    } else {
      foundFileRef.current?.click()
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submitFoundItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingFound(true)
    setPhotoError(null)
    
    try {
      const data = new FormData()
      data.append('title', foundData.title)
      data.append('category', foundData.category)
      data.append('location_text', foundData.location_text)
      data.append('holding_location', foundData.holding_location || 'With Finder')
      data.append('description', foundData.description)
      if (foundImage) {
        data.append('image', foundImage)
      }

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/found`, {
        method: 'POST',
        body: data
      })

      if (response.ok) {
        setFoundSuccess(true)
        setTimeout(() => {
          setFoundSuccess(false)
          setIsFoundModalOpen(false)
          setFoundData({ title: '', category: 'other', location_text: '', holding_location: '', description: '' })
          setFoundImage(null)
          setFoundImagePreview(null)
          
          setMessages(prev => [...prev, {
            role: 'bot',
            type: 'text',
            content: "Thank you for reporting the found item! It's been added to the database. We'll notify the owner if a match is found."
          }])
        }, 2000)
      }
    } catch (error: any) {
      console.error("Error logging item:", error)
      setPhotoError(error.message || 'Error submitting found item.')
    } finally {
      setIsSubmittingFound(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !selectedImage) return

    const userMessage: Message = {
      role: 'user',
      type: 'text',
      content: input,
      imagePreview: imagePreview || undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSelectedImage(null)
    setImagePreview(null)
    setIsTyping(true)
    setPhotoError(null)

    try {
      const formData = new FormData()
      formData.append('conversation_id', 'demo-session')
      formData.append('message', userMessage.content)
      if (selectedImage) {
        formData.append('image', selectedImage)
      }

      const apiUrl = getApiUrl()
      const response = await axios.post(`${apiUrl}/api/chat`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const replyData = response.data
      const botMessage: Message = {
        role: replyData.reply.role,
        type: replyData.reply.type,
        content: replyData.reply.content,
        matches: replyData.matches
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error: any) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'bot',
        type: 'text',
        content: error?.message?.includes('VITE_API_URL') 
          ? error.message 
          : "Sorry, I'm having trouble connecting right now. Please try again later."
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mpqivpxswksjqkohhjje.supabase.co'

  return (
    <div className="app-shell bg-background text-textMain dark">
      {/* Header with Safe Area Top */}
      <header 
        className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/90 backdrop-blur-md shrink-0 z-20"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
      >
        <div className="flex items-center gap-3">
          <Link to={isNative ? "/dashboard" : "/"} className="tap-target-44 flex items-center justify-center p-2 hover:bg-surface rounded-full transition-colors text-textMuted hover:text-white" title="Back">
            <X size={20} />
          </Link>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <Search size={20} className="text-white" />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white">LostMate Assistant</h2>
            <p className="text-xs text-textMuted">Online</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsFoundModalOpen(true)}
          className="tap-target-44 bg-surface hover:bg-surface/80 border border-border text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={15} className="text-accent" />
          <span>Report Found</span>
        </button>
      </header>

      {/* Permission or Image Alert Banner */}
      {photoError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{photoError}</span>
          </div>
          <button onClick={() => setPhotoError(null)} className="p-1 tap-target-44 flex items-center justify-center text-red-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Chat Area with single vertical scroll */}
      <div className="main-scroll-area p-4 flex flex-col gap-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
            
            {msg.imagePreview && (
              <div className="mb-2 p-1 rounded-2xl bg-accent/20 self-end">
                <img src={msg.imagePreview} alt="Upload preview" className="rounded-xl max-h-48 object-cover opacity-90" />
                <div className="text-[10px] font-medium text-accent mt-1 px-2 text-right">Photo attached</div>
              </div>
            )}
            
            {msg.content && (
              <div className={`px-4 py-3 text-sm leading-relaxed select-text ${msg.role === 'user' ? 'bg-accent text-white rounded-2xl rounded-br-sm' : 'bg-surface border border-border text-white rounded-2xl rounded-bl-sm'}`}>
                {msg.content}
              </div>
            )}

            {msg.type === 'match_cards' && msg.matches && msg.matches.length > 0 && (
              <div className="mt-3 flex flex-col gap-3 w-full sm:w-80">
                {msg.matches.map((match, mIdx) => (
                  <div key={mIdx} className="w-full rounded-2xl overflow-hidden border bg-background border-border shadow-lg">
                    <div className="relative h-40 w-full bg-surface flex items-center justify-center overflow-hidden">
                      {match.image_path ? (
                        <img 
                           src={match.image_path.startsWith('http') ? match.image_path : `${supabaseUrl}/storage/v1/object/public/item-images/${match.image_path}`} 
                           alt={match.title} 
                           className="w-full h-full object-cover" 
                           onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/1e1e30/8c8df0?text=No+Photo' }}
                        />
                      ) : (
                        <div className="text-textMuted text-xs">No image provided</div>
                      )}
                      <div className="absolute top-2 right-2 bg-green-500/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full shadow-md border border-green-400/30">
                        {Math.round(match.score)}% Match
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-sm mb-1">{match.title}</h4>
                      <p className="text-xs text-textMuted leading-relaxed mb-3 line-clamp-2">{match.description}</p>
                      
                      <div className="bg-surface/50 rounded-lg p-2 mb-3">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-textMuted">Location:</span>
                          <span className="font-medium text-white truncate max-w-[120px]">{match.location_text}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-textMuted">Found:</span>
                          <span className="font-medium text-white">{new Date(match.found_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <button className="tap-target-44 w-full bg-accent/10 hover:bg-accent/20 text-accent font-medium py-2 rounded-lg text-sm transition-colors border border-accent/20 flex items-center justify-center">
                        Yes, this is mine!
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="self-start flex gap-1.5 items-center px-4 py-4 rounded-2xl bg-surface border border-border rounded-bl-sm w-16 h-10 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-textMuted animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-textMuted animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-textMuted animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-2 w-full"></div>
      </div>

      {/* Input Area with Safe Area Bottom & Tab Bar offset on native */}
      <div 
        className="p-3 bg-background border-t border-border shrink-0 z-30"
        style={{
          paddingBottom: isNative 
            ? 'calc(56px + env(safe-area-inset-bottom, 0px) + 0.5rem)' 
            : 'max(env(safe-area-inset-bottom, 0px), 0.75rem)'
        }}
      >
        {/* Image Preview inside input area before sending */}
        {imagePreview && (
          <div className="relative inline-block mb-2 ml-2">
            <img src={imagePreview} alt="To upload" className="h-16 w-16 object-cover rounded-lg border border-border" />
            <button 
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
          {/* Web hidden input fallback */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleWebImageSelect} 
            accept="image/jpeg,image/png,image/webp" 
            className="hidden" 
          />

          <div className="flex-1 flex items-center gap-1 rounded-full px-2 py-1 bg-surface border border-border shadow-inner focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/50 transition-all min-h-[46px]">
            <button 
              type="button" 
              onClick={handleAttachPhoto}
              className="tap-target-44 flex items-center justify-center p-2 rounded-full text-textMuted hover:bg-white/5 hover:text-white transition-colors"
              title="Attach Photo (Camera / Gallery)"
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you lost..." 
              className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 text-white placeholder:text-textMuted" 
              disabled={isTyping}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={(!input.trim() && !selectedImage) || isTyping}
            className="tap-target-44 w-[46px] h-[46px] rounded-full bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center shrink-0"
          >
            {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        </form>
      </div>

      {/* Found Item Modal */}
      {isFoundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
            {foundSuccess ? (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Item Reported Successfully!</h3>
                <p className="text-textMuted text-sm">Thank you for helping our campus community.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                  <h2 className="text-lg font-bold text-white">Report Found Item</h2>
                  <button 
                    onClick={() => setIsFoundModalOpen(false)} 
                    className="tap-target-44 flex items-center justify-center text-textMuted hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={submitFoundItem} className="flex flex-col flex-1 overflow-hidden p-5">
                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-3">
                        <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Item Title</label>
                        <input 
                          required
                          type="text" 
                          className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                          placeholder="e.g. Silver Rolex Watch"
                          value={foundData.title}
                          onChange={e => setFoundData({...foundData, title: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Category</label>
                        <select 
                          className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                          value={foundData.category}
                          onChange={e => setFoundData({...foundData, category: e.target.value})}
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
                        <label className="block text-xs font-medium text-textMuted mb-1">Where did you find it?</label>
                        <input 
                          required
                          type="text" 
                          className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm min-h-[44px]"
                          placeholder="e.g. Quad bench"
                          value={foundData.location_text}
                          onChange={e => setFoundData({...foundData, location_text: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Photo (Max 5MB)</label>
                        <div 
                          className="border-2 border-dashed border-border rounded-xl h-[120px] flex flex-col items-center justify-center bg-background cursor-pointer hover:border-accent/50 transition-colors relative overflow-hidden"
                          onClick={handleFoundAttachPhoto}
                        >
                          {foundImagePreview ? (
                            <img src={foundImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Upload size={22} className="text-textMuted mb-1.5" />
                              <span className="text-xs text-textMuted font-medium">{isNative ? 'Take Photo or Choose Gallery' : 'Click to select photo'}</span>
                            </>
                          )}
                          <input 
                            type="file" 
                            ref={foundFileRef} 
                            className="hidden" 
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleWebFoundImageSelect}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Additional Details</label>
                        <textarea 
                          required
                          className="w-full bg-background border border-border rounded-xl py-2 px-3 text-white focus:outline-none focus:border-accent/50 text-sm h-[65px] resize-none"
                          placeholder="Colors, brand, model..."
                          value={foundData.description}
                          onChange={e => setFoundData({...foundData, description: e.target.value})}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
                  
                <div className="flex justify-end gap-3 pt-3 border-t border-border shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setIsFoundModalOpen(false)}
                      className="tap-target-44 px-4 py-2 rounded-xl text-sm font-medium text-textMuted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmittingFound}
                      className="tap-target-44 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                      {isSubmittingFound ? (
                        <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                      ) : (
                        'Submit Item'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
