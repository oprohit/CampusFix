import React, { useState } from 'react';
import { X, Upload, Sparkles, MapPin, Check, Loader2, Camera, AlertCircle } from 'lucide-react';
import { uploadIssueImage } from '../supabase';
import { runTriage } from '../api';

export default function ReportIssueModal({
  isOpen,
  onClose,
  onSubmit,
  locations = [],
  initialCoord = null,
  onStartPinpoint
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('plumbing');
  const [buildingId, setBuildingId] = useState(locations[0]?.id || 'tech-hall');
  const [locationDetails, setLocationDetails] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Gemini AI Triage State
  const [aiTriage, setAiTriage] = useState(null);
  const [triaging, setTriaging] = useState(false);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRunAiTriage = async () => {
    if (!title || !description) return;
    setTriaging(true);
    try {
      const selectedB = locations.find(l => l.id === buildingId);
      const res = await runTriage({
        title,
        description,
        category_hint: category,
        building_name: selectedB?.name,
        location_details: locationDetails
      });
      setAiTriage(res);
      if (res?.category) setCategory(res.category);
    } catch (err) {
      console.error('Triage error:', err);
    } finally {
      setTriaging(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    let uploadedUrl = imagePreview;

    // Upload to Supabase Storage if file selected
    if (imageFile) {
      setUploadingImage(true);
      try {
        uploadedUrl = await uploadIssueImage(imageFile);
      } catch (err) {
        console.warn('Image upload error:', err);
      } finally {
        setUploadingImage(false);
      }
    }

    const payload = {
      title,
      description,
      category,
      building_id: buildingId,
      location_details: locationDetails || 'General Area',
      lat: initialCoord?.lat,
      lng: initialCoord?.lng,
      image_url: uploadedUrl,
      ai_triage: aiTriage
    };

    await onSubmit(payload);
    setSubmitting(false);
    onClose();
  };

  const categories = [
    { id: 'plumbing', name: 'Plumbing' },
    { id: 'electrical', name: 'Electrical' },
    { id: 'structural', name: 'Doors & Walls' },
    { id: 'hvac', name: 'HVAC / Climate' },
    { id: 'hazard', name: 'Safety Hazard' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'it_network', name: 'Network & Tech' },
    { id: 'other', name: 'General' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span>Report Campus Issue</span>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="modal-body">
          {/* Issue Summary */}
          <div className="form-group">
            <label className="form-label">Issue Summary *</label>
            <input
              type="text"
              required
              placeholder="e.g. Broken hydraulic door closer, leaking water pipe..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Category Picker */}
          <div className="form-group">
            <label className="form-label">Category</label>
            <div className="category-picker-grid">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`category-option-btn ${category === c.id ? 'selected' : ''}`}
                >
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Building & Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Campus Facility *</label>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="form-select"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Room / Floor</label>
              <input
                type="text"
                placeholder="e.g. 2nd Floor, Room 204"
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Map Pinpoint Coordinate Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: '#0b1120',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} style={{ color: initialCoord ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                  Geospatial Map Coordinates
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {initialCoord
                    ? `Lat: ${initialCoord.lat.toFixed(5)}, Lng: ${initialCoord.lng.toFixed(5)}`
                    : 'No map pin placed yet'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartPinpoint && onStartPinpoint();
              }}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '5px 10px' }}
            >
              {initialCoord ? 'Change Pin' : 'Pick On Map'}
            </button>
          </div>

          {/* Detailed Description */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="form-label">Detailed Description *</label>
              <button
                type="button"
                onClick={handleRunAiTriage}
                disabled={triaging || !title || !description}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-hover)',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: (triaging || !title || !description) ? 'not-allowed' : 'pointer',
                  opacity: (triaging || !title || !description) ? 0.5 : 1
                }}
              >
                {triaging ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Auto-Triage with Gemini AI</span>
              </button>
            </div>
            <textarea
              required
              rows={3}
              placeholder="Describe what is damaged, hazardous conditions, or immediate risks..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
            />
          </div>

          {/* Gemini AI Triage Result Preview */}
          {aiTriage && (
            <div className="ai-triage-card">
              <div className="triage-header-line">
                <div className="triage-title">
                  <Sparkles size={13} />
                  <span>Gemini Operations Assessment: {aiTriage.severity.toUpperCase()}</span>
                </div>
                <span className={`badge badge-${aiTriage.severity}`}>
                  Score: {aiTriage.priority_score}/10
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                Assigned to: <strong>{aiTriage.department}</strong> (Est: {aiTriage.estimated_fix_time})
              </div>
              {aiTriage.safety_warning && (
                <div className="triage-warning-box">
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{aiTriage.safety_warning}</span>
                </div>
              )}
            </div>
          )}

          {/* Photo Evidence Upload */}
          <div className="form-group">
            <label className="form-label">Photo Evidence (Supabase Storage)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                border: '1px dashed var(--border-subtle)',
                borderRadius: '8px',
                background: '#0b1120',
                cursor: 'pointer',
                transition: 'border-color 0.15s'
              }}>
                <Camera size={20} style={{ color: 'var(--text-muted)', marginBottom: '4px' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {imageFile ? imageFile.name : 'Choose campus photo'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PNG, JPG up to 10MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </label>

              {imagePreview && (
                <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(''); }}
                    style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', color: '#fff', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="modal-footer" style={{ padding: '0', paddingTop: '10px', background: 'transparent' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="btn btn-primary"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Submit Problem Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
