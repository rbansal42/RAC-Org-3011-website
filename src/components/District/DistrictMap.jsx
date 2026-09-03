import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  User, 
  Sparkles, 
  X, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Search, 
  CheckCircle2, 
  Award,
  Globe,
  Layers,
  Compass,
  Info,
  Phone,
  Mail,
  MessageSquare,
  Copy,
  Check,
  UserCheck,
  Shield
} from 'lucide-react';
import { parseExcelClubs, getParsedClubsFromExcel } from '../../data/excelReader';
import { dbService } from '../../lib/supabaseClient';

export const REGIONAL_ZONES = [
  {
    id: 'zone-prithvi',
    name: 'Zone Prithvi',
    hindiName: 'पृथ्वी',
    zoneNumber: 'Zone 1',
    adrr: 'Rtr. Ayush Rai',
    zrr: 'Rtn. Rtr. Kanav Sachdeva',
    zrs: 'Rtr. Hitaishi Chawla',
    color: '#10b981',
    fillColor: '#10b981',
    clubsCount: 18,
    center: [28.5350, 77.2350],
    polygon: [
      [28.6000, 77.1600],
      [28.6000, 77.3800],
      [28.2500, 77.3800],
      [28.2500, 77.0500],
      [28.4500, 77.0500],
      [28.5000, 77.1600]
    ]
  },
  {
    id: 'zone-agni',
    name: 'Zone Agni',
    hindiName: 'अग्नि',
    zoneNumber: 'Zone 2',
    adrr: 'Rtr. Ayush Rai',
    zrr: 'Rtr. Dhruv Kumar Jha',
    zrs: 'Rtr. Kartik Kumar',
    color: '#D81B60',
    fillColor: '#D81B60',
    clubsCount: 19,
    center: [28.6250, 77.2150],
    polygon: [
      [28.7200, 77.1500],
      [28.7200, 77.3400],
      [28.5800, 77.3400],
      [28.5800, 77.2200],
      [28.3200, 77.3500],
      [28.3200, 77.1500],
      [28.5500, 77.1500]
    ]
  },
  {
    id: 'zone-vayu',
    name: 'Zone Vayu',
    hindiName: 'वायु',
    zoneNumber: 'Zone 3',
    adrr: 'Rtr. Radhika Bansal',
    zrr: 'Rtr. Tanishaa Sonker',
    zrs: 'Rtr. Pratham Girdhar',
    color: '#0284c7',
    fillColor: '#0284c7',
    clubsCount: 19,
    center: [28.6850, 77.1650],
    polygon: [
      [28.7800, 77.0000],
      [28.7800, 77.2000],
      [28.6200, 77.2000],
      [28.5800, 77.0500],
      [28.4200, 77.0500],
      [28.4200, 76.9500],
      [28.6500, 76.9500]
    ]
  },
  {
    id: 'zone-akash',
    name: 'Zone Akash',
    hindiName: 'आकाश',
    zoneNumber: 'Zone 4',
    adrr: 'Rtr. Radhika Bansal',
    zrr: 'Rtr. Palak Jain',
    zrs: 'Rtr. Arjun Pratap Singh',
    color: '#123499',
    fillColor: '#123499',
    clubsCount: 19,
    center: [28.6150, 77.0850],
    polygon: [
      [28.7200, 76.9000],
      [28.7200, 77.1200],
      [28.5800, 77.1200],
      [28.5200, 76.9800],
      [28.3000, 76.9800],
      [28.3000, 76.8500],
      [28.5500, 76.8500]
    ]
  }
];

export default function DistrictMap({ clubs = [], selectedClubId, onSelectClub }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const [activeClubs, setActiveClubs] = useState(clubs);
  const [excelLoaded, setExcelLoaded] = useState(false);

  const [hoveredClub, setHoveredClub] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, transform: 'translate(-50%, -100%)' });
  const [activeSlideoutClub, setActiveSlideoutClub] = useState(null);
  const [activeZoneId, setActiveZoneId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const updateTooltipPos = (clientX, clientY) => {
    const tooltipWidth = 320;
    const padding = 20;
    let x = clientX;
    let y = clientY - 16;
    let transform = 'translate(-50%, -100%)';

    // Horizontal clamping: ensure tooltip never overflows left or right edges of viewport
    if (x - tooltipWidth / 2 < padding) {
      x = padding;
      transform = 'translate(0%, -100%)';
    } else if (x + tooltipWidth / 2 > window.innerWidth - padding) {
      x = window.innerWidth - padding;
      transform = 'translate(-100%, -100%)';
    }

    // Vertical clamping: if cursor is near top of screen (e.g. y < 200px), flip below cursor
    if (clientY < 200) {
      y = clientY + 24;
      transform = transform.replace('-100%)', '0%)');
    }

    setTooltipPos({ x, y, transform });
  };

  const handleMouseMove = (e) => {
    updateTooltipPos(e.clientX, e.clientY);
  };

  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1800);
  };

  useEffect(() => {
    let isMounted = true;
    
    if (clubs && clubs.length > 0) {
      setActiveClubs(clubs);
    }

    async function loadLiveClubs() {
      // 1. Fetch live clubs directly from Supabase database
      try {
        const spClubs = await dbService.fetchClubs();
        if (spClubs && spClubs.length > 0 && isMounted) {
          setActiveClubs(spClubs);
          setExcelLoaded(true);
          return;
        }
      } catch (err) {
        console.warn('Supabase clubs fetch error in DistrictMap:', err);
      }

      // 2. Fallback to parsed excel roster
      try {
        const parsed = await getParsedClubsFromExcel();
        if (parsed && parsed.length > 0 && isMounted) {
          setActiveClubs(prev => {
            return prev.map(c => {
              const clean = (s) => (s || '').toLowerCase().replace(/rotaract|club|of|\s+/g, '');
              const matched = parsed.find(ec => 
                ec.name.toLowerCase().trim() === c.name.toLowerCase().trim() ||
                ec.name.toLowerCase().includes(c.name.toLowerCase()) || 
                c.name.toLowerCase().includes(ec.name.toLowerCase()) ||
                (c.shortName && ec.name.toLowerCase().includes(c.shortName.toLowerCase())) ||
                clean(ec.name).includes(clean(c.shortName || c.name)) ||
                clean(c.name).includes(clean(ec.name))
              );
              if (matched) {
                return {
                  ...c,
                  president: matched.president || c.president,
                  isDirector: matched.isDirector || c.isDirector || '',
                  phone: matched.phone || c.phone,
                  email: matched.email || c.email,
                  zone: matched.zone || c.zone
                };
              }
              return c;
            });
          });
          setExcelLoaded(true);
        }
      } catch (err) {
        console.warn('Excel load error:', err);
      }
    }

    loadLiveClubs();
    return () => { isMounted = false; };
  }, [clubs]);

  useEffect(() => {
    if (selectedClubId) {
      const found = activeClubs.find(c => c.id === selectedClubId);
      if (found) setActiveSlideoutClub(found);
    } else {
      setActiveSlideoutClub(null);
    }
  }, [selectedClubId, activeClubs]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = window.L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [28.5800, 77.1025],
      zoom: 11,
      scrollWheelZoom: false,
      zoomControl: false
    });

    mapInstanceRef.current = map;

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      opacity: 0.9
    }).addTo(map);

    renderLeafletMarkers(L, map, activeClubs);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && window.L) {
      renderLeafletMarkers(window.L, mapInstanceRef.current, activeClubs);
    }
  }, [activeClubs, searchQuery, activeZoneId]);

  const renderLeafletMarkers = (L, map, clubsList) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = clubsList.filter(c => {
      const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.president?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesZone = !activeZoneId || (
        (activeZoneId === 'zone-prithvi' && (c.zone?.toLowerCase().includes('prithvi') || c.zone?.toLowerCase().includes('south'))) ||
        (activeZoneId === 'zone-agni' && (c.zone?.toLowerCase().includes('agni') || c.zone?.toLowerCase().includes('central') || c.zone?.toLowerCase().includes('faridabad'))) ||
        (activeZoneId === 'zone-vayu' && (c.zone?.toLowerCase().includes('vayu') || c.zone?.toLowerCase().includes('north') || c.zone?.toLowerCase().includes('gurugram'))) ||
        (activeZoneId === 'zone-akash' && (c.zone?.toLowerCase().includes('akash') || c.zone?.toLowerCase().includes('west')))
      );
      return matchesSearch && matchesZone;
    });

    const coordCounts = {};

    filtered.forEach((club, index) => {
      let lat = club.lat || 28.5800;
      let lng = club.lng || 77.1025;

      // Smart coordinate dispersion so close pins don't overlap
      const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
      if (coordCounts[key]) {
        const count = coordCounts[key];
        const angle = (count * 60) * (Math.PI / 180);
        const radius = 0.007 * Math.ceil(count / 5);
        lat += Math.sin(angle) * radius;
        lng += Math.cos(angle) * radius;
        coordCounts[key] = count + 1;
      } else {
        coordCounts[key] = 1;
      }

      let neonColor = '#10b981'; // Prithvi
      if (club.zone?.toLowerCase().includes('agni')) neonColor = '#D81B60';
      if (club.zone?.toLowerCase().includes('vayu')) neonColor = '#0284c7';
      if (club.zone?.toLowerCase().includes('akash')) neonColor = '#123499';

      const displayName = (club.shortName || club.name).replace(/^RAC\s+/i, '');
      const isActive = selectedClubId === club.id || activeSlideoutClub?.id === club.id;

      const customIcon = L.divIcon({
        className: `leaflet-neon-marker ${isActive ? 'active-marker' : ''}`,
        html: `
          <div class="neon-marker-container">
            <div class="neon-marker-core" style="background-color: ${neonColor}; box-shadow: 0 0 14px ${neonColor};"></div>
            <div class="neon-marker-pulse" style="border: 2px solid ${neonColor};"></div>
            <div class="neon-marker-label" style="border: 1.5px solid ${neonColor}; background: #FFFFFF; color: #0F172A; font-weight: 800;">
              ${displayName}
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      marker.on('mouseover', (e) => {
        setHoveredClub(club);
        if (e && e.originalEvent) {
          updateTooltipPos(e.originalEvent.clientX, e.originalEvent.clientY);
        }
      });
      marker.on('mousemove', (e) => {
        if (e && e.originalEvent) {
          updateTooltipPos(e.originalEvent.clientX, e.originalEvent.clientY);
        }
      });
      marker.on('mouseout', () => setHoveredClub(null));
      marker.on('click', () => {
        setActiveSlideoutClub(club);
        if (onSelectClub) onSelectClub(club.id);
        map.flyTo([lat, lng], 13.5, { duration: 1.2 });
      });

      markersRef.current.push(marker);
    });
  };

  const getClubNeonColor = (c) => {
    if (!c) return '#D81B60';
    if (c.zone?.toLowerCase().includes('prithvi')) return '#10b981';
    if (c.zone?.toLowerCase().includes('agni')) return '#D81B60';
    if (c.zone?.toLowerCase().includes('vayu')) return '#0284c7';
    if (c.zone?.toLowerCase().includes('akash')) return '#123499';
    return '#D81B60';
  };

  const handleZoneSelect = (zoneId) => {
    if (activeZoneId === zoneId) {
      setActiveZoneId(null);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([28.5800, 77.1025], 11, { duration: 1.2 });
      }
    } else {
      setActiveZoneId(zoneId);
      const zoneObj = REGIONAL_ZONES.find(z => z.id === zoneId);
      if (zoneObj && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(zoneObj.center, 12, { duration: 1.2 });
      }
    }
  };

  const activeZoneObj = REGIONAL_ZONES.find(z => z.id === activeZoneId);

  return (
    <div 
      id="district-map-section"
      onMouseMove={handleMouseMove}
      style={{
        position: isFullScreen ? 'fixed' : 'relative',
        inset: isFullScreen ? 0 : 'auto',
        zIndex: isFullScreen ? 99999 : 1,
        width: '100%',
        height: isFullScreen ? '100vh' : 'calc(100vh - 72px)',
        minHeight: isFullScreen ? '100vh' : '780px',
        backgroundColor: '#FDF8FA',
        borderRadius: '0px',
        overflow: 'hidden',
        border: 'none',
        boxShadow: 'none',
        transition: 'all 0.3s ease'
      }}
    >
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}
      />

      {/* FLOATING ZONE LEADERSHIP OVERLAY CARD */}
      {activeZoneObj && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            left: '20px',
            zIndex: 1010,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `2px solid ${activeZoneObj.color}`,
            borderRadius: '16px',
            padding: '16px 20px',
            maxWidth: '360px',
            boxShadow: `0 16px 40px rgba(0,0,0,0.18), 0 0 20px ${activeZoneObj.color}35`,
            animation: 'fadeInUp 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: activeZoneObj.color,
                  color: '#FFFFFF',
                  padding: '3px 10px',
                  borderRadius: '100px',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  letterSpacing: '0.5px'
                }}
              >
                {activeZoneObj.zoneNumber}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#1E1E24' }}>
                {activeZoneObj.name} <span style={{ color: activeZoneObj.color, fontFamily: 'serif' }}>({activeZoneObj.hindiName})</span>
              </h3>
            </div>
            <button
              onClick={() => handleZoneSelect(activeZoneId)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F8FAFC', padding: '6px 10px', borderRadius: '8px' }}>
              <span style={{ color: '#64748B', fontWeight: 700 }}>ADRR:</span>
              <strong style={{ color: '#0F172A' }}>{activeZoneObj.adrr}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F8FAFC', padding: '6px 10px', borderRadius: '8px' }}>
              <span style={{ color: '#64748B', fontWeight: 700 }}>ZRR:</span>
              <strong style={{ color: activeZoneObj.color }}>{activeZoneObj.zrr}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F8FAFC', padding: '6px 10px', borderRadius: '8px' }}>
              <span style={{ color: '#64748B', fontWeight: 700 }}>ZRS:</span>
              <strong style={{ color: '#0F172A' }}>{activeZoneObj.zrs}</strong>
            </div>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748B' }}>
            <span>Active Clubs in Zone:</span>
            <span style={{ fontWeight: 800, color: activeZoneObj.color, fontSize: '0.82rem' }}>
              {activeZoneObj.clubsCount} Clubs
            </span>
          </div>
        </div>
      )}

      <div 
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          zIndex: 1000,
          pointerEvents: 'none',
          flexWrap: 'wrap'
        }}
      >
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(216, 27, 96, 0.2)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: '#1E1E24',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            pointerEvents: 'auto'
          }}
        >
          <div 
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#D81B60',
              boxShadow: '0 0 12px #D81B60',
              animation: 'neonPulse 1.8s infinite ease-in-out'
            }}
          />
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.5px', color: '#1E1E24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ROTARACT DISTRICT 3011 • SATELLITE DIRECTORY
              {excelLoaded && (
                <span className="pill-pink" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  <CheckCircle2 size={10} /> RY 2026-27 Active
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#4A4A5A', fontWeight: 600 }}>
              ESRI High-Res Satellite • 4 Elemental Zones (Prithvi, Agni, Vayu, Akash) • {activeClubs.length} Active Clubs
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto', flexWrap: 'wrap' }}>
          <div 
            style={{
              position: 'relative',
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(216, 27, 96, 0.2)',
              borderRadius: '8px',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
            }}
          >
            <Search size={16} style={{ color: 'var(--rotaract-pink)' }} />
            <input
              type="text"
              placeholder="Search full club name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#1E1E24',
                fontSize: '0.84rem',
                fontWeight: 600,
                width: '170px'
              }}
            />
            {searchQuery && (
              <X size={14} style={{ color: '#71717A', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleZoneSelect(null)}
              style={{
                background: !activeZoneId ? '#FFFFFF' : '#0E0E0E',
                backdropFilter: 'blur(12px)',
                color: !activeZoneId ? '#0E0E0E' : '#FFFFFF',
                border: !activeZoneId ? '2px solid #0E0E0E' : '1px solid #0E0E0E',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: !activeZoneId ? '0 4px 14px rgba(0,0,0,0.18)' : 'none'
              }}
            >
              All Zones ({activeClubs.length})
            </button>
            {REGIONAL_ZONES.map(z => (
              <button
                key={z.id}
                onClick={() => handleZoneSelect(z.id)}
                style={{
                  background: activeZoneId === z.id ? 'rgba(255, 255, 255, 0.96)' : z.color,
                  backdropFilter: 'blur(12px)',
                  color: activeZoneId === z.id ? z.color : '#FFFFFF',
                  border: activeZoneId === z.id ? `2px solid ${z.color}` : `1px solid ${z.color}`,
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: activeZoneId === z.id ? `0 4px 14px ${z.color}45` : '0 2px 8px rgba(0,0,0,0.12)'
                }}
              >
                {z.name} <span style={{ opacity: 0.85, fontSize: '0.72rem' }}>({z.hindiName})</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(216, 27, 96, 0.25)',
              color: 'var(--rotaract-pink)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
            }}
            title={isFullScreen ? "Exit Fullscreen" : "Full Screen Mode"}
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {hoveredClub && (
        <div 
          className="glass-hover-tooltip"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: tooltipPos.transform || 'translate(-50%, -100%)',
            zIndex: 10000
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getClubNeonColor(hoveredClub),
                boxShadow: `0 0 8px ${getClubNeonColor(hoveredClub)}`
              }} 
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: getClubNeonColor(hoveredClub), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {hoveredClub.zone || 'District 3011'}
            </span>
          </div>

          <h4 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#1E1E24', margin: '2px 0 8px 0', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {hoveredClub.name}
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.85rem', color: '#4A4A5A', fontWeight: 700 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} style={{ color: 'var(--rotaract-pink)', flexShrink: 0 }} />
              <span style={{ wordBreak: 'break-word' }}>President: {hoveredClub.president || 'Rtr. Club President'}</span>
            </div>
            {hoveredClub.secretary && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={14} style={{ color: '#0284c7' }} />
                <span>Secretary: {hoveredClub.secretary}</span>
              </div>
            )}
            {hoveredClub.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#166534' }}>
                <Phone size={12} style={{ color: '#10b981' }} />
                <span>{hoveredClub.phone}</span>
              </div>
            )}
            {hoveredClub.isDirector && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                <Globe size={13} style={{ color: '#123499' }} />
                <span>ISD: {hoveredClub.isDirector}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(() => {
        const currentSlideoutClub = activeSlideoutClub 
          ? (activeClubs.find(c => c.id === activeSlideoutClub.id) || activeSlideoutClub)
          : null;

        return (
          <>
            <div 
              className={`frosted-slideout-overlay ${currentSlideoutClub ? 'open' : ''}`}
              onClick={() => {
                setActiveSlideoutClub(null);
                if (onSelectClub) onSelectClub(null);
              }}
              style={{ zIndex: 99998 }}
            />

            <aside className={`frosted-slideout-panel ${currentSlideoutClub ? 'open' : ''}`}>
              {currentSlideoutClub && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '85px 30px 40px 30px', boxSizing: 'border-box' }}>
                  
                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            background: '#FDF0F5',
                            border: '1px solid rgba(216, 27, 96, 0.25)',
                            color: '#D81B60',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            marginBottom: '8px'
                          }}
                        >
                          {currentSlideoutClub.zone || 'District 3011'}
                        </span>
                        
                        <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#1E1E24', lineHeight: 1.2, margin: 0 }}>
                          {currentSlideoutClub.name}
                        </h2>
                      </div>

                <button
                  onClick={() => {
                    setActiveSlideoutClub(null);
                    if (onSelectClub) onSelectClub(null);
                  }}
                  style={{
                    background: '#FDF0F5',
                    border: '1px solid rgba(216, 27, 96, 0.25)',
                    color: '#D81B60',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#D81B60'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#FDF0F5'}
                  title="Close Sidebar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Leadership & Personal Data from Database */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
                
                {/* Club President Card */}
                <div 
                  style={{
                    background: '#FFF8FA',
                    border: '1.5px solid rgba(216, 27, 96, 0.2)',
                    borderRadius: '16px',
                    padding: '16px 18px',
                    boxShadow: '0 4px 14px rgba(216, 27, 96, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#D81B60', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <User size={13} /> Club President (RY 2026-27)
                    </span>
                    {currentSlideoutClub.rotaryId && (
                      <span style={{ fontSize: '0.68rem', color: '#71717A', background: '#FFFFFF', border: '1px solid #E4E4E7', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                        Rotary ID: {currentSlideoutClub.rotaryId}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#18181B' }}>
                    {currentSlideoutClub.president || 'Rtr. Club President'}
                  </div>

                  {/* President Contact Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {currentSlideoutClub.phone && (
                      <>
                        <a
                          href={`tel:${currentSlideoutClub.phone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            borderRadius: '8px',
                            background: '#FFFFFF',
                            border: '1px solid #E4E4E7',
                            color: '#0F172A',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Phone size={12} style={{ color: '#10b981' }} /> {currentSlideoutClub.phone}
                        </a>

                        <a
                          href={`https://wa.me/91${currentSlideoutClub.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            borderRadius: '8px',
                            background: '#25D366',
                            color: '#FFFFFF',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)'
                          }}
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </a>

                        <button
                          onClick={() => handleCopy(currentSlideoutClub.phone, `phone-${currentSlideoutClub.id}`)}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E4E4E7',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            color: '#71717A'
                          }}
                          title="Copy phone"
                        >
                          {copiedField === `phone-${currentSlideoutClub.id}` ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                        </button>
                      </>
                    )}

                    {currentSlideoutClub.email && (
                      <a
                        href={`mailto:${currentSlideoutClub.email}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 11px',
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          border: '1px solid #E4E4E7',
                          color: '#D81B60',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Mail size={12} /> {currentSlideoutClub.email}
                      </a>
                    )}
                  </div>
                </div>

                {/* Club Secretary Card */}
                {(currentSlideoutClub.secretary || currentSlideoutClub.secretaryPhone || currentSlideoutClub.secretaryEmail) && (
                  <div 
                    style={{
                      background: '#F0FDF4',
                      border: '1.5px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '16px',
                      padding: '16px 18px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.05)'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <UserCheck size={13} /> Club Secretary (RY 2026-27)
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#18181B' }}>
                      {currentSlideoutClub.secretary || 'Rtr. Club Secretary'}
                    </div>

                    {/* Secretary Contact Actions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      {currentSlideoutClub.secretaryPhone && (
                        <>
                          <a
                            href={`tel:${currentSlideoutClub.secretaryPhone}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 11px',
                              borderRadius: '8px',
                              background: '#FFFFFF',
                              border: '1px solid #D1FAE5',
                              color: '#0F172A',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <Phone size={12} style={{ color: '#059669' }} /> {currentSlideoutClub.secretaryPhone}
                          </a>

                          <a
                            href={`https://wa.me/91${currentSlideoutClub.secretaryPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 11px',
                              borderRadius: '8px',
                              background: '#25D366',
                              color: '#FFFFFF',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)'
                            }}
                          >
                            <MessageSquare size={12} /> WhatsApp
                          </a>

                          <button
                            onClick={() => handleCopy(currentSlideoutClub.secretaryPhone, `sec-phone-${currentSlideoutClub.id}`)}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #D1FAE5',
                              borderRadius: '8px',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              color: '#71717A'
                            }}
                            title="Copy secretary phone"
                          >
                            {copiedField === `sec-phone-${currentSlideoutClub.id}` ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                          </button>
                        </>
                      )}

                      {currentSlideoutClub.secretaryEmail && (
                        <a
                          href={`mailto:${currentSlideoutClub.secretaryEmail}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            borderRadius: '8px',
                            background: '#FFFFFF',
                            border: '1px solid #D1FAE5',
                            color: '#059669',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Mail size={12} /> {currentSlideoutClub.secretaryEmail}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* ISD & Charter Year Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {currentSlideoutClub.isDirector && (
                    <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '14px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#1E40AF', fontWeight: 800, textTransform: 'uppercase' }}>
                        IS Director
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E3A8A', marginTop: '3px' }}>
                        {currentSlideoutClub.isDirector}
                      </div>
                    </div>
                  )}

                  {currentSlideoutClub.charterYear && (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '14px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#92400E', fontWeight: 800, textTransform: 'uppercase' }}>
                        Charter Year
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#B45309', marginTop: '3px' }}>
                        {currentSlideoutClub.charterYear}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div style={{ marginBottom: '24px' }}>
                <div 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#FFFBEB',
                    border: '1px solid #123499',
                    padding: '4px 16px',
                    borderRadius: '6px',
                    marginBottom: '14px'
                  }}
                >
                  <span 
                    style={{
                      color: 'var(--skyline-gold-dark)',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}
                  >
                    CLUB KPIs
                  </span>
                </div>

                {(currentSlideoutClub.initiatives && currentSlideoutClub.initiatives.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {(currentSlideoutClub.initiatives || []).map((init, idx) => (
                      <div 
                        key={idx}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #F3E5EB',
                          borderRadius: '16px',
                          padding: '18px 20px',
                          boxShadow: '0 4px 14px rgba(216, 27, 96, 0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                          <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--rotaract-pink)', lineHeight: 1.25, margin: 0 }}>
                            {init.title}
                          </h4>
                          <span className="pill-pink" style={{ fontSize: '0.72rem', padding: '2px 8px', flexShrink: 0 }}>
                            {init.category}
                          </span>
                        </div>

                        <p style={{ color: '#4A4A5A', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '10px', fontWeight: 500 }}>
                          {init.description}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', color: 'var(--skyline-gold-dark)', fontWeight: 800, borderTop: '1px solid #F3E5EB', paddingTop: '10px' }}>
                          <span>Impact: {init.impact}</span>
                          {init.date && <span style={{ color: '#71717A', fontWeight: 600 }}>{init.date}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    style={{
                      background: '#FFFFFF',
                      border: '1px dashed #E4E4E7',
                      borderRadius: '14px',
                      padding: '20px',
                      textAlign: 'center',
                      color: '#71717A',
                      fontSize: '0.88rem',
                      fontWeight: 500
                    }}
                  >
                    No monthly report KPIs uploaded yet for this club.
                  </div>
                )}
              </div>

            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <a
                href={`mailto:${currentSlideoutClub.email || currentSlideoutClub.presidentEmail || ''}?subject=${encodeURIComponent(`Connecting with ${currentSlideoutClub.name} (RY 2026-27)`)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: '#FFFFFF',
                  background: 'linear-gradient(135deg, #D81B60 0%, #AD1457 100%)',
                  textDecoration: 'none',
                  boxShadow: '0 8px 24px rgba(216, 27, 96, 0.25)',
                  transition: 'transform 0.2s ease'
                }}
              >
                Connect via Email <ChevronRight size={18} />
              </a>
            </div>

          </div>
        )}
      </aside>
    </>
  );
})()}

      <div 
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '65px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          zIndex: 1000,
          pointerEvents: 'none',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(216, 27, 96, 0.2)',
            padding: '10px 22px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            pointerEvents: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#1E1E24', fontWeight: 700 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            Zone Prithvi (पृथ्वी)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#1E1E24', fontWeight: 700 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#D81B60', boxShadow: '0 0 8px #D81B60' }} />
            Zone Agni (अग्नि)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#1E1E24', fontWeight: 700 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
            Zone Vayu (वायु)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#1E1E24', fontWeight: 700 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#123499', boxShadow: '0 0 8px #123499' }} />
            Zone Akash (आकाश)
          </div>
        </div>

        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(216, 27, 96, 0.2)',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '0.76rem',
            color: '#4A4A5A',
            fontWeight: 700,
            pointerEvents: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
          }}
        >
          Click pin to view Club Overview & Project Spotlight
        </div>
      </div>

    </div>
  );
}
