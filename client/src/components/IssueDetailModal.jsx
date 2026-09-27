import React, { useState } from 'react';
import { X, MapPin, AlertTriangle, Clock, ThumbsUp, Wrench, CheckCircle2, Building, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function IssueDetailModal({
  issue,
  onClose,
  onUpvote,
  onUpdateStatus,
  isAdmin = true
}) {
  const [upvoting, setUpvoting] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!issue) return null;

  const isResolved = issue.status === 'resolved';

  const handleUpvote = async () => {
    if (upvoting) return;
    setUpvoting(true);
    await onUpvote(issue.id);
    setUpvoting(false);
  };

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    await onUpdateStatus(issue.id, newStatus);
    if (newStatus === 'resolved') {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
    setUpdating(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge badge-${issue.severity}`}>
              {issue.severity} Priority
            </span>
            <span className={`badge-status ${issue.status}`}>
              {issue.status.replace('_', ' ')}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              #{issue.id}
            </span>
          </div>

          <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Title & Location */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', lineHeight: 1.4, marginBottom: '6px' }}>
              {issue.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--brand-hover)' }}>
              <MapPin size={15} />
              <span style={{ fontWeight: 600 }}>{issue.building_name}</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>{issue.location_details}</span>
            </div>
          </div>

          {/* Photo Evidence if available */}
          {issue.image_url && (
            <div className="photo-box">
              <img src={issue.image_url} alt={issue.title} />
            </div>
          )}

          {/* Problem Description */}
          <div style={{ background: '#0b1120', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
              Problem Description
            </div>
            <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6 }}>
              {issue.description}
            </p>
          </div>

          {/* Gemini AI Operations Triage Card */}
          <div className="ai-triage-card">
            <div className="triage-header-line">
              <div className="triage-title">
                <Sparkles size={14} />
                <span>AI Operations Triage</span>
              </div>
              <span className={`badge badge-${issue.severity}`}>
                Urgency Score: {issue.ai_triage?.priority_score || (issue.severity === 'critical' ? 9 : 6)}/10
              </span>
            </div>

            <div className="triage-grid">
              <div className="triage-metric">
                <span className="triage-metric-label">Dispatched Department</span>
                <span className="triage-metric-value">
                  {issue.ai_triage?.department || issue.department || 'Facilities Maintenance'}
                </span>
              </div>
              <div className="triage-metric">
                <span className="triage-metric-label">Estimated Turnaround</span>
                <span className="triage-metric-value" style={{ color: 'var(--brand-hover)' }}>
                  {issue.ai_triage?.estimated_fix_time || '1-3 hours'}
                </span>
              </div>
            </div>

            {/* Safety Warning */}
            {issue.safety_warning && (
              <div className="triage-warning-box">
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>Safety Advisory for Students:</strong>
                  <span>{issue.safety_warning}</span>
                </div>
              </div>
            )}

            {/* Action Plan */}
            {issue.ai_triage?.action_plan && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '4px' }}>
                  Facility Crew Action Items:
                </span>
                <ul style={{ paddingLeft: '18px', lineHeight: 1.5 }}>
                  {issue.ai_triage.action_plan.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={handleUpvote}
            disabled={upvoting}
            className="btn btn-secondary"
            title="Confirm you have seen this issue"
          >
            <ThumbsUp size={14} className="text-sky-400" />
            <span>Confirm Issue ({issue.upvotes || 1})</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {issue.status !== 'in_progress' && issue.status !== 'resolved' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={updating}
                className="btn btn-primary"
              >
                <Wrench size={14} />
                <span>Mark In Progress</span>
              </button>
            )}

            {issue.status !== 'resolved' && (
              <button
                onClick={() => handleStatusChange('resolved')}
                disabled={updating}
                className="btn btn-success"
              >
                <CheckCircle2 size={14} />
                <span>Mark Resolved</span>
              </button>
            )}

            {issue.status === 'resolved' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '12px', fontWeight: 700 }}>
                <CheckCircle2 size={16} />
                <span>Issue Resolved</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
