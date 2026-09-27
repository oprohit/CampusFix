import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, ChevronRight, ThumbsUp, Wrench } from 'lucide-react';

// Controller to smoothly animate to selected issue or building
function MapController({ selectedIssue, selectedBuilding, pinpointMode, onPinpoint }) {
  const map = useMap();

  useEffect(() => {
    if (selectedIssue && selectedIssue.lat && selectedIssue.lng) {
      map.flyTo([selectedIssue.lat, selectedIssue.lng], 18, {
        duration: 0.9,
        easeLinearity: 0.25
      });
    } else if (selectedBuilding && selectedBuilding.lat && selectedBuilding.lng) {
      map.flyTo([selectedBuilding.lat, selectedBuilding.lng], 17, {
        duration: 0.8
      });
    }
  }, [selectedIssue, selectedBuilding, map]);

  useMapEvents({
    click(e) {
      if (pinpointMode && onPinpoint) {
        onPinpoint(e.latlng);
      }
    }
  });

  return null;
}

// Generate category-specific clean SVG map markers
function createCustomPinIcon(category, severity, isSelected, status) {
  const categoryColors = {
    plumbing: '#0284c7',
    electrical: '#eab308',
    structural: '#f97316',
    hvac: '#06b6d4',
    hazard: '#ef4444',
    furniture: '#a855f7',
    it_network: '#10b981',
    other: '#64748b'
  };

  const color = status === 'resolved' ? '#10b981' : (categoryColors[category] || '#0ea5e9');
  const isCritical = (severity === 'critical' || severity === 'high') && status !== 'resolved';

  const categorySymbols = {
    plumbing: '💧',
    electrical: '⚡',
    structural: '🚪',
    hvac: '❄️',
    hazard: '⚠️',
    furniture: '🪑',
    it_network: '📡',
    other: '🔧'
  };

  const symbol = categorySymbols[category] || '🔧';

  const html = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -100%);">
      ${isCritical ? `
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${color}; opacity: 0.25; animation: ping 1.5s infinite;"></div>
      ` : ''}
      <div style="
        width: 30px; 
        height: 30px; 
        border-radius: 50% 50% 50% 0; 
        transform: rotate(-45deg); 
        background: ${color}; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 ${isSelected ? '14px' : '6px'} ${color};
        border: 2px solid ${isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)'};
      ">
        <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px;">
          ${symbol}
        </div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: html,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30]
  });
}

// Crosshair Pin for Pinpointing
const crosshairIcon = L.divIcon({
  className: 'pinpoint-crosshair',
  html: `
    <div style="position: relative; width: 30px; height: 30px; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 26px; height: 26px; border: 2px dashed #38bdf8; border-radius: 50%;"></div>
      <div style="width: 8px; height: 8px; background: #38bdf8; border-radius: 50%; box-shadow: 0 0 8px #38bdf8;"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

export default function CampusLeafletMap({
  locations = [],
  issues = [],
  selectedIssue,
  selectedBuilding,
  onSelectIssue,
  onSelectBuilding,
  pinpointMode = false,
  pinpointCoord = null,
  onPinpoint = null
}) {
  const defaultCenter = [37.7749, -122.4194];

  return (
    <div className="map-panel">
      <MapContainer
        center={defaultCenter}
        zoom={16}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', background: '#080c14' }}
      >
        {/* Watermark-free OpenStreetMap with Dark Theme Matrix Filter */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="dark-map-tiles"
          maxZoom={19}
        />

        {/* Dynamic Fly-To Controller */}
        <MapController
          selectedIssue={selectedIssue}
          selectedBuilding={selectedBuilding}
          pinpointMode={pinpointMode}
          onPinpoint={onPinpoint}
        />

        {/* Campus Building Zones */}
        {locations.map((b) => (
          <Circle
            key={b.id}
            center={[b.lat, b.lng]}
            radius={40}
            pathOptions={{
              color: selectedBuilding?.id === b.id ? '#38bdf8' : (b.color || '#3b82f6'),
              fillColor: b.color || '#3b82f6',
              fillOpacity: selectedBuilding?.id === b.id ? 0.35 : 0.12,
              weight: selectedBuilding?.id === b.id ? 2.5 : 1.2,
              dashArray: selectedBuilding?.id === b.id ? null : '4, 4'
            }}
            eventHandlers={{
              click: () => onSelectBuilding && onSelectBuilding(b)
            }}
          />
        ))}

        {/* Issue Pins */}
        {issues.map((iss) => {
          if (!iss.lat || !iss.lng) return null;
          const isSelected = selectedIssue?.id === iss.id;

          return (
            <Marker
              key={iss.id}
              position={[iss.lat, iss.lng]}
              icon={createCustomPinIcon(iss.category, iss.severity, isSelected, iss.status)}
              eventHandlers={{
                click: () => onSelectIssue && onSelectIssue(iss)
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div style={{
                  padding: '12px',
                  minWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`badge badge-${iss.severity}`}>
                      {iss.severity} Priority
                    </span>
                    <span className={`badge-status ${iss.status}`}>
                      {iss.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', margin: '2px 0 0 0', lineHeight: 1.3 }}>
                    {iss.title}
                  </h4>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} style={{ color: 'var(--brand-primary)' }} />
                    <span>{iss.building_name} ({iss.location_details})</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                      🔥 {iss.upvotes || 1} confirms
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIssue && onSelectIssue(iss);
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '10px', padding: '3px 8px' }}
                    >
                      <span>Inspect</span>
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Pinpoint Indicator */}
        {pinpointMode && pinpointCoord && (
          <Marker position={[pinpointCoord.lat, pinpointCoord.lng]} icon={crosshairIcon} />
        )}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="map-legend-pill">
        <span style={{ fontWeight: 700, color: '#ffffff' }}>Campus Facilities Map</span>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#0284c7' }}></span>
          <span>Plumbing</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#eab308' }}></span>
          <span>Electrical</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#f97316' }}></span>
          <span>Structural</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#ef4444' }}></span>
          <span>Hazard</span>
        </div>
      </div>

      {/* Pinpoint Mode Banner */}
      {pinpointMode && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 500,
          background: '#0284c7',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(2, 132, 199, 0.6)'
        }}>
          <Navigation size={15} />
          <span>Click anywhere on campus map to set exact issue coordinates</span>
          {pinpointCoord && (
            <span style={{ background: '#ffffff', color: '#0284c7', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              Lat {pinpointCoord.lat.toFixed(4)}, Lng {pinpointCoord.lng.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
