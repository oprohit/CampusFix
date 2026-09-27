import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { 
  Wrench, 
  Plus, 
  Search, 
  MapPin, 
  ThumbsUp, 
  LogOut, 
  User, 
  ChevronRight,
  Shield,
  Layers,
  RotateCcw
} from 'lucide-react';
import CampusLeafletMap from './components/CampusLeafletMap';
import IssueDetailModal from './components/IssueDetailModal';
import ReportIssueModal from './components/ReportIssueModal';
import AuthModal from './components/AuthModal';
import AuthScreen from './components/AuthScreen';
import { fetchLocations, fetchIssues, createIssue, updateIssueStatus, upvoteIssue } from './api';
import { supabase } from './supabase';

export default function App() {
  // Data State
  const [locations, setLocations] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  // Selection & Modals
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Leaflet Pinpoint Mode
  const [pinpointMode, setPinpointMode] = useState(false);
  const [pinpointCoord, setPinpointCoord] = useState(null);

  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Load initial campus data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [locs, iss] = await Promise.all([fetchLocations(), fetchIssues()]);
        setLocations(locs);
        setIssues(iss);
      } catch (err) {
        console.error('Failed to load campus data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Check existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser(session.user);
      setAuthChecking(false);
    }).catch(() => {
      setAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      setAuthChecking(false);
      if (session?.user && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Filtered Issues list
  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (statusFilter !== 'all' && iss.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && iss.category !== categoryFilter) return false;
      if (selectedBuilding && iss.building_id !== selectedBuilding.id) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          iss.title.toLowerCase().includes(q) ||
          iss.description.toLowerCase().includes(q) ||
          iss.building_name?.toLowerCase().includes(q) ||
          iss.location_details?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [issues, statusFilter, categoryFilter, selectedBuilding, searchQuery]);

  // Real-time KPI Stats
  const stats = useMemo(() => {
    const total = issues.length;
    const critical = issues.filter(i => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved').length;
    const active = issues.filter(i => i.status !== 'resolved').length;
    const resolved = issues.filter(i => i.status === 'resolved').length;
    return { total, critical, active, resolved };
  }, [issues]);

  // Handlers
  const handleSelectIssue = (iss) => {
    setSelectedIssue(iss);
    setIsDetailOpen(true);
  };

  const handleUpvote = async (issueId) => {
    const count = await upvoteIssue(issueId);
    setIssues(prev => prev.map(iss => {
      if (iss.id === issueId) {
        return { ...iss, upvotes: count ?? (iss.upvotes + 1) };
      }
      return iss;
    }));
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue(prev => ({ ...prev, upvotes: count ?? (prev.upvotes + 1) }));
    }
  };

  const handleUpdateStatus = async (issueId, status) => {
    const updated = await updateIssueStatus(issueId, status);
    setIssues(prev => prev.map(iss => {
      if (iss.id === issueId) {
        return { ...iss, status: updated.status };
      }
      return iss;
    }));
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue(prev => ({ ...prev, status: updated.status }));
    }
  };

  const handleCreateIssue = async (issueData) => {
    const newIssue = await createIssue(issueData);
    setIssues(prev => [newIssue, ...prev]);
    setSelectedIssue(newIssue);
    setPinpointCoord(null);
    setPinpointMode(false);
  };

  const handleMapPinpoint = (latlng) => {
    setPinpointCoord(latlng);
    setPinpointMode(false);
    setIsReportOpen(true);
  };

  const categories = [
    { id: 'all', label: 'All Issues' },
    { id: 'plumbing', label: 'Plumbing' },
    { id: 'electrical', label: 'Electrical' },
    { id: 'structural', label: 'Doors & Walls' },
    { id: 'hvac', label: 'HVAC' },
    { id: 'hazard', label: 'Hazard' }
  ];

  // 1. Session verification loader
  if (authChecking) {
    return (
      <div className="auth-viewport" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', zIndex: 10, color: '#ffffff' }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            border: '3px solid rgba(255,255,255,0.2)', 
            borderTopColor: '#ffffff', 
            borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite', 
            margin: '0 auto 16px' 
          }} />
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em' }}>
            Verifying CampusFixer Session...
          </p>
        </div>
      </div>
    );
  }

  // 2. Auth Gate: User must log in or register before accessing the campus dashboard
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="app-root">
      {/* Navbar */}
      <header className="app-navbar">
        <div className="navbar-brand">
          <div className="brand-icon-box">
            <Wrench size={18} />
          </div>
          <div className="brand-name">
            Campus<span>Fixer</span>
          </div>
          <span className="brand-badge">OPERATIONS HUB</span>
        </div>

        {/* Center Live KPI Tickers */}
        <div className="navbar-center-stats">
          <div className="stat-pill">
            <span className="stat-dot active"></span>
            <span>Open: <strong>{stats.active}</strong></span>
          </div>
          <div className="stat-pill">
            <span className="stat-dot critical"></span>
            <span>Urgent: <strong>{stats.critical}</strong></span>
          </div>
          <div className="stat-pill">
            <span className="stat-dot resolved"></span>
            <span>Resolved: <strong>{stats.resolved}</strong></span>
          </div>
        </div>

        {/* Actions */}
        <div className="navbar-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: '#1e293b',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              border: '1px solid var(--border-subtle)'
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
              <span style={{ fontWeight: 600 }}>{currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({currentUser.user_metadata?.role || 'Student'})</span>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setCurrentUser(null);
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', gap: '6px' }}
              title="Sign Out"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>

          <button
            onClick={() => setIsReportOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={15} />
            <span>Report Issue</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="app-main">
        {/* Left Side: Issue Feed & Filter Workspace */}
        <aside className="feed-panel">
          {/* Filters & Search Header */}
          <div className="feed-header">
            <div className="search-wrapper">
              <Search size={14} className="search-icon-svg" />
              <input
                type="text"
                placeholder="Search issues, facilities, rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input-field"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="search-clear-btn">
                  ×
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="filter-chip-row">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`filter-chip-btn ${categoryFilter === c.id ? 'active' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Status Filter Chips */}
            <div className="filter-chip-row">
              <button
                onClick={() => setStatusFilter('all')}
                className={`filter-chip-btn ${statusFilter === 'all' ? 'active' : ''}`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('reported')}
                className={`filter-chip-btn ${statusFilter === 'reported' ? 'active' : ''}`}
              >
                Reported
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`filter-chip-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
              >
                In Progress
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`filter-chip-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
              >
                Resolved
              </button>
            </div>
          </div>

          {/* Building Focus Filter if any */}
          {selectedBuilding && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(14, 165, 233, 0.1)',
              borderBottom: '1px solid rgba(14, 165, 233, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--brand-hover)'
            }}>
              <span>Filtering: <strong>{selectedBuilding.name}</strong></span>
              <button
                onClick={() => setSelectedBuilding(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}
              >
                Clear Filter ×
              </button>
            </div>
          )}

          {/* Issue Cards */}
          <div className="feed-cards-container">
            {filteredIssues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '13px', marginBottom: '10px' }}>No campus issues found matching criteria.</p>
                <button
                  onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSearchQuery(''); setSelectedBuilding(null); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              filteredIssues.map((iss) => {
                const isSelected = selectedIssue?.id === iss.id;

                return (
                  <div
                    key={iss.id}
                    onClick={() => handleSelectIssue(iss)}
                    className={`feed-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="card-header-line">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`badge badge-${iss.severity}`}>
                          {iss.severity}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {iss.category}
                        </span>
                      </div>
                      <span className={`badge-status ${iss.status}`}>
                        {iss.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="card-headline">
                      {iss.title}
                    </div>

                    <div className="card-meta-line">
                      <MapPin size={12} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {iss.building_name} • {iss.location_details}
                      </span>
                    </div>

                    <div className="card-footer-line">
                      <div className="card-upvote-indicator">
                        <ThumbsUp size={12} />
                        <span>{iss.upvotes || 1} student confirms</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--brand-hover)', fontWeight: 600 }}>
                        <span>Inspect</span>
                        <ChevronRight size={12} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Side: Geospatial Leaflet Campus Map */}
        <section className="map-panel">
          <CampusLeafletMap
            locations={locations}
            issues={issues}
            selectedIssue={selectedIssue}
            selectedBuilding={selectedBuilding}
            onSelectIssue={handleSelectIssue}
            onSelectBuilding={(b) => setSelectedBuilding(b)}
            pinpointMode={pinpointMode}
            pinpointCoord={pinpointCoord}
            onPinpoint={handleMapPinpoint}
          />

          {/* Floating Map Toolbar */}
          <div className="map-floating-toolbar">
            <button
              onClick={() => setPinpointMode(!pinpointMode)}
              className={`map-tool-btn ${pinpointMode ? 'active' : ''}`}
              title="Click anywhere on map to drop problem pin"
            >
              <MapPin size={14} />
              <span>{pinpointMode ? 'Cancel Pinpoint' : 'Drop Pin on Map'}</span>
            </button>

            {selectedBuilding && (
              <button
                onClick={() => setSelectedBuilding(null)}
                className="map-tool-btn"
                title="Reset building filter"
              >
                <RotateCcw size={14} />
                <span>Reset View</span>
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Modals */}
      {isDetailOpen && selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setIsDetailOpen(false)}
          onUpvote={handleUpvote}
          onUpdateStatus={handleUpdateStatus}
          isAdmin={true}
        />
      )}

      {isReportOpen && (
        <ReportIssueModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          onSubmit={handleCreateIssue}
          locations={locations}
          initialCoord={pinpointCoord}
          onStartPinpoint={() => setPinpointMode(true)}
        />
      )}

      {isAuthOpen && (
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={(user) => setCurrentUser(user)}
        />
      )}
    </div>
  );
}
