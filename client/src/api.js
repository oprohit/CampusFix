const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8000' : '');

export async function fetchLocations() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/locations`);
    if (!res.ok) throw new Error('Failed to fetch locations');
    const data = await res.json();
    return data.locations || [];
  } catch (err) {
    console.warn('API /api/locations error, using default locations:', err);
    return [
      { id: "tech-hall", name: "Engineering & Tech Hall", code: "TECH", lat: 37.7749, lng: -122.4194, pos3d: [-4, 0, -3], floors: 4, category: "Academic", color: "#3b82f6" },
      { id: "science-center", name: "Life Sciences Complex", code: "SCI", lat: 37.7762, lng: -122.4178, pos3d: [4, 0, -4], floors: 5, category: "Labs & Research", color: "#10b981" },
      { id: "central-library", name: "Memorial University Library", code: "LIB", lat: 37.7741, lng: -122.4170, pos3d: [0, 0, 0], floors: 6, category: "Study & Commons", color: "#8b5cf6" },
      { id: "student-union", name: "Campus Student Union & Dining", code: "UNION", lat: 37.7735, lng: -122.4205, pos3d: [-5, 0, 3], floors: 3, category: "Student Life", color: "#f59e0b" },
      { id: "dorm-quad-north", name: "North Residential Quad", code: "DORM-N", lat: 37.7770, lng: -122.4210, pos3d: [-3, 0, -7], floors: 8, category: "Housing", color: "#ec4899" },
      { id: "athletics-center", name: "Sports & Aquatics Pavilion", code: "GYM", lat: 37.7725, lng: -122.4180, pos3d: [5, 0, 4], floors: 2, category: "Athletics", color: "#06b6d4" }
    ];
  }
}

export async function fetchIssues(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.building_id && filters.building_id !== 'all') params.append('building_id', filters.building_id);
    if (filters.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE_URL}/api/issues?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch issues');
    const data = await res.json();
    return data.issues || [];
  } catch (err) {
    console.warn('API /api/issues error, reading fallback seed:', err);
    return getFallbackSeedIssues();
  }
}

export async function createIssue(issueData) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issueData)
    });
    if (!res.ok) throw new Error('Failed to report issue');
    const data = await res.json();
    return data.issue;
  } catch (err) {
    console.warn('API create issue error, generating local issue:', err);
    return {
      id: `iss-${Math.random().toString(36).substring(2, 8)}`,
      ...issueData,
      status: 'reported',
      severity: 'medium',
      upvotes: 1,
      department: 'Campus Maintenance',
      created_at: new Date().toISOString()
    };
  }
}

export async function updateIssueStatus(issueId, status, notes = '') {
  try {
    const res = await fetch(`${API_BASE_URL}/api/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution_notes: notes })
    });
    if (!res.ok) throw new Error('Failed to update status');
    const data = await res.json();
    return data.issue;
  } catch (err) {
    console.warn('API update status error:', err);
    return { id: issueId, status, resolution_notes: notes };
  }
}

export async function upvoteIssue(issueId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/issues/${issueId}/upvote`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to upvote');
    const data = await res.json();
    return data.upvotes;
  } catch (err) {
    console.warn('API upvote error:', err);
    return null;
  }
}

export async function runTriage(data) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Triage request failed');
    const result = await res.json();
    return result.triage;
  } catch (err) {
    console.warn('API triage error, using client heuristic:', err);
    const text = `${data.title} ${data.description}`.toLowerCase();
    const isCritical = text.includes('water') || text.includes('pipe') || text.includes('leak') || text.includes('spark') || text.includes('smoke');
    return {
      severity: isCritical ? 'critical' : 'medium',
      category: data.category_hint || 'structural',
      priority_score: isCritical ? 9 : 5,
      department: isCritical ? 'Emergency Facility Services' : 'General Maintenance Team',
      safety_warning: isCritical ? 'Keep clear of pooling water or electrical hazards.' : 'Exercise caution in immediate area.',
      action_plan: ['Dispatch local area tech', 'Inspect and isolate failure point', 'Repair and verify integrity'],
      estimated_fix_time: isCritical ? '< 1 hour' : '2-4 hours'
    };
  }
}

function getFallbackSeedIssues() {
  return [
    {
      id: "iss-001",
      title: "Broken hydraulic door closer on main exit",
      description: "The heavy glass exterior door does not latch automatically and slams shut violently with loud banging, causing a pinch hazard for students.",
      category: "structural",
      status: "in_progress",
      severity: "medium",
      building_id: "tech-hall",
      building_name: "Engineering & Tech Hall",
      location_details: "Floor 1, West Exit Lobby Door 102",
      lat: 37.77495,
      lng: -122.41955,
      pos3d: [-4.2, 0.5, -3.1],
      image_url: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80",
      reporter_name: "Marcus Vance",
      upvotes: 14,
      department: "Facilities & Structural Hardware",
      safety_warning: "Watch fingers; high wind can slam door without resistance.",
      created_at: "2026-09-27T08:30:00Z"
    },
    {
      id: "iss-002",
      title: "Leaking cold water pipe under sink in Chemistry Lab 304",
      description: "Continuous leak pooling water beneath lab bench 4. Water is near 120V equipment grounding cables. Bucket placed temporarily.",
      category: "plumbing",
      status: "reported",
      severity: "critical",
      building_id: "science-center",
      building_name: "Life Sciences Complex",
      location_details: "Floor 3, Wet Lab Room 304, Bench 4",
      lat: 37.77625,
      lng: -122.41775,
      pos3d: [4.1, 1.8, -3.9],
      image_url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
      reporter_name: "Priya Sharma",
      upvotes: 29,
      department: "Plumbing & Chemical Safety",
      safety_warning: "Slip hazard and proximity to electrical conduits. Avoid touching wet grounding lines.",
      created_at: "2026-09-27T09:45:00Z"
    },
    {
      id: "iss-003",
      title: "High-frequency buzzing & flickering fluorescent ballast",
      description: "Overhead light fixture above the quiet study carrels is strobing intermittently and making a high-pitch hum, giving students headaches.",
      category: "electrical",
      status: "reported",
      severity: "low",
      building_id: "central-library",
      building_name: "Memorial University Library",
      location_details: "Floor 4, Silent Reading Wing East",
      lat: 37.77405,
      lng: -122.41695,
      pos3d: [0.3, 2.2, 0.4],
      image_url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
      reporter_name: "Avery Chen",
      upvotes: 8,
      department: "Campus Electrical Maintenance",
      safety_warning: "No direct shock hazard, avoid eye strain until replaced.",
      created_at: "2026-09-27T11:20:00Z"
    },
    {
      id: "iss-004",
      title: "Main elevator #2 floor indicator stuck between 2 and 3",
      description: "Elevator stopped between floors with slight shudder earlier today. Currently locked out with out-of-order tape, but needs technician recertification.",
      category: "hazard",
      status: "in_progress",
      severity: "high",
      building_id: "student-union",
      building_name: "Campus Student Union & Dining",
      location_details: "Central Shaft Elevator B",
      lat: 37.77348,
      lng: -122.42042,
      pos3d: [-5.1, 1.2, 2.9],
      image_url: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80",
      reporter_name: "Facility Desk",
      upvotes: 42,
      department: "Vertical Transportation Specialist",
      safety_warning: "Elevator cab locked out. Do not attempt manual door release.",
      created_at: "2026-09-27T07:10:00Z"
    }
  ];
}
