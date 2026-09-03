import React, { useState, useMemo } from 'react';
import { PAST_DRRS } from '../../data/districtData';
import { Award, Calendar, MapPin, Search, User, Sparkles, ArrowRight, Shield } from 'lucide-react';

const DRRCard = React.memo(function DRRCard({ drr, eraConfig, isCurrentDRR, initials }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`rotaract-card ${isCurrentDRR ? 'current-drr-card' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0px',
        borderRadius: '20px',
        overflow: 'hidden',
        border: isCurrentDRR 
          ? '1.5px solid rgba(216, 27, 96, 0.45)'
          : (isHovered ? '2px solid var(--rotaract-pink)' : '1px solid rgba(255, 255, 255, 0.2)'),
        backgroundColor: '#FFFFFF',
        boxShadow: isCurrentDRR 
          ? (isHovered ? '0 16px 40px rgba(216, 27, 96, 0.22), 0 0 0 1px rgba(216, 27, 96, 0.4)' : '0 8px 28px rgba(216, 27, 96, 0.12), 0 0 0 1px rgba(216, 27, 96, 0.25)')
          : (isHovered ? '0 20px 45px rgba(0, 0, 0, 0.28)' : '0 8px 24px rgba(0, 0, 0, 0.12)'),
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
        transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 450px'
      }}
    >
      {/* Photo or Themed Fallback Avatar */}
      <div 
        style={{ 
          width: '100%', 
          height: '330px', 
          position: 'relative', 
          overflow: 'hidden',
          backgroundColor: '#1E1E24'
        }}
      >
        {drr.photo ? (
          <img
            src={drr.photo}
            alt={drr.name}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 18%',
              transition: 'transform 0.4s ease',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)'
            }}
          />
        ) : (
          /* Themed Profile Placeholder for Archival DRRs Without Photos */
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(145deg, #1C1917 0%, #2A0818 45%, #880E4F 85%, #D81B60 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '24px',
              boxSizing: 'border-box'
            }}
          >
            {/* Subtle Rotary Cogwheel Watermark Pattern */}
            <div 
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.08,
                backgroundImage: `radial-gradient(circle at 50% 45%, #FFFFFF 12%, transparent 13%), radial-gradient(circle at 50% 45%, transparent 35%, #FFFFFF 36%, #FFFFFF 42%, transparent 43%)`,
                pointerEvents: 'none'
              }}
            />

            {/* Monogram Avatar Crest */}
            <div 
              style={{
                width: '94px',
                height: '94px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 100%)',
                border: '2px solid rgba(255, 224, 130, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 900,
                color: '#FFE082',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                marginBottom: '14px',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.08)' : 'scale(1)'
              }}
            >
              {initials}
            </div>

            <div style={{ fontSize: '0.76rem', color: '#FFE082', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Archival Record
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px', fontWeight: 600 }}>
              Rotary International District {drr.district}
            </div>
          </div>
        )}

        {/* Gradient Shadow Vignette for Text Legibility */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, transparent 45%, rgba(0, 0, 0, 0.88) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            pointerEvents: 'none'
          }}
        >
          {/* Top Row: District Era Pin Badge & Seniority Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isCurrentDRR ? (
              <>
                <span 
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#FFFFFF',
                    padding: '5px 13px',
                    borderRadius: '100px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    letterSpacing: '0.4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    border: '1px solid rgba(216, 27, 96, 0.45)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
                  }}
                >
                  <span className="live-indicator-dot" />
                  CURRENT DRR
                </span>

                <span 
                  style={{
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#F4F4F5',
                    padding: '3px 9px',
                    borderRadius: '100px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  #{drr.srNo}
                </span>
              </>
            ) : (
              <>
                <span 
                  style={{
                    background: eraConfig.bg,
                    color: eraConfig.textColor,
                    padding: '5px 12px',
                    borderRadius: '100px',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    border: `1px solid ${eraConfig.border}`,
                    boxShadow: eraConfig.shadow
                  }}
                >
                  <MapPin size={12} /> {eraConfig.label}
                </span>

                <span 
                  style={{
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#F4F4F5',
                    padding: '3px 9px',
                    borderRadius: '100px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  #{drr.srNo}
                </span>
              </>
            )}
          </div>

          {/* Bottom Row inside Photo: Rotary Year Tenure */}
          <div>
            <span 
              className="pill-gold" 
              style={{ 
                fontSize: '0.78rem', 
                padding: '4px 10px', 
                marginBottom: '6px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '5px' 
              }}
            >
              <Calendar size={12} /> {drr.tenure}
            </span>
          </div>
        </div>
      </div>

      {/* Card Information Body */}
      <div 
        style={{ 
          padding: '20px 22px 22px 22px', 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1,
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div>
          <h3 
            style={{ 
              fontSize: '1.25rem', 
              fontWeight: 900, 
              color: '#18181B', 
              lineHeight: 1.3, 
              margin: '0 0 6px 0', 
              letterSpacing: '-0.3px' 
            }}
          >
            {drr.name}
          </h3>

          <div 
            style={{ 
              fontSize: '0.84rem', 
              color: isCurrentDRR ? '#D81B60' : 'var(--rotaract-pink)', 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px', 
              marginTop: '4px' 
            }}
          >
            <Shield size={13} />
            District Rotaract Representative
          </div>
        </div>

        {/* District & Tenure Footer */}
        <div 
          style={{ 
            marginTop: '16px', 
            paddingTop: '12px', 
            borderTop: '1px solid #F4F4F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: '#52525B'
          }}
        >
          <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', color: isCurrentDRR ? '#D81B60' : eraConfig.pinColor }}>
            <MapPin size={13} style={{ color: isCurrentDRR ? '#D81B60' : eraConfig.pinColor }} /> District {drr.district}
          </span>
          <span 
            style={{ 
              fontWeight: 800, 
              color: isCurrentDRR ? '#D81B60' : eraConfig.pinColor,
              background: isCurrentDRR ? '#FFF0F5' : '#FAFAFA',
              padding: '4px 10px',
              borderRadius: '6px',
              border: isCurrentDRR ? '1px solid rgba(216, 27, 96, 0.25)' : '1px solid #E4E4E7',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isCurrentDRR && <span className="live-indicator-dot" style={{ width: '5px', height: '5px' }} />}
            {drr.tenure}
          </span>
        </div>
      </div>
    </div>
  );
});

export default function PastDRRShowcase() {
  const [selectedEra, setSelectedEra] = useState('all'); // 'all' | '3011' | '3010' | '301'
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered DRRs
  const filteredDRRs = useMemo(() => {
    return PAST_DRRS.filter(drr => {
      const matchesEra = selectedEra === 'all' || drr.district === selectedEra;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        drr.name.toLowerCase().includes(query) || 
        drr.year.toLowerCase().includes(query) ||
        drr.district.includes(query) ||
        (drr.homeClub && drr.homeClub.toLowerCase().includes(query));
      return matchesEra && matchesSearch;
    });
  }, [selectedEra, searchQuery]);

  // Era statistics
  const counts = useMemo(() => ({
    all: PAST_DRRS.length,
    '3011': PAST_DRRS.filter(d => d.district === '3011').length,
    '3010': PAST_DRRS.filter(d => d.district === '3010').length,
    '301': PAST_DRRS.filter(d => d.district === '301').length,
  }), []);

  // Helpers for styling based on district era
  const getEraBadgeConfig = (district) => {
    switch (district) {
      case '3011':
        return {
          label: 'District 3011',
          bg: 'linear-gradient(135deg, #D81B60 0%, #AD1457 100%)',
          border: 'rgba(216, 27, 96, 0.4)',
          textColor: '#FFFFFF',
          shadow: '0 4px 14px rgba(216, 27, 96, 0.35)',
          pinColor: '#D81B60'
        };
      case '3010':
        return {
          label: 'District 3010',
          bg: 'linear-gradient(135deg, #1E3A8A 0%, #172554 100%)',
          border: 'rgba(30, 58, 138, 0.4)',
          textColor: '#FFFFFF',
          shadow: '0 4px 14px rgba(30, 58, 138, 0.35)',
          pinColor: '#1E3A8A'
        };
      case '301':
        return {
          label: 'District 301',
          bg: 'linear-gradient(135deg, #065F46 0%, #064E3B 100%)',
          border: 'rgba(6, 95, 70, 0.4)',
          textColor: '#FFFFFF',
          shadow: '0 4px 14px rgba(6, 95, 70, 0.35)',
          pinColor: '#065F46'
        };
      default:
        return {
          label: `District ${district}`,
          bg: '#D81B60',
          border: '#D81B60',
          textColor: '#FFFFFF',
          shadow: 'none',
          pinColor: '#D81B60'
        };
    }
  };

  const getInitials = (name) => {
    const clean = name.replace(/^(Rtn\.|Rtr\.|PDRR|\s+)+/gi, '').trim();
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (clean.slice(0, 2) || 'DR').toUpperCase();
  };

  return (
    <div style={{ marginTop: '10px', color: '#FFFFFF' }}>
      
      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span className="pill-gold" style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Award size={14} /> DISTRICT HERITAGE & COUNCIL OF DRRs
        </span>
        <h1 style={{ fontSize: '2.8rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px', margin: '4px 0 12px 0' }}>
          Council of Past DRRs
        </h1>
        <p style={{ color: '#FCE4EC', fontSize: '1.1rem', maxWidth: '760px', margin: '0 auto', lineHeight: 1.6 }}>
          Honoring four decades of visionary leadership, selfless service, and transformative impact across our District.
        </p>
      </div>

      {/* Filter Bar & Search */}
      <div 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '32px',
          background: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Era Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Past DRRs (${counts.all})`, color: 'var(--rotaract-pink)' },
            { id: '3011', label: `District 3011 (${counts['3011']})`, color: '#D81B60' },
            { id: '3010', label: `District 3010 (${counts['3010']})`, color: '#1E3A8A' },
            { id: '301', label: `District 301 (${counts['301']})`, color: '#065F46' }
          ].map(era => {
            const isActive = selectedEra === era.id;
            return (
              <button
                key={era.id}
                onClick={() => setSelectedEra(era.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: isActive ? `2px solid ${era.color}` : '1px solid #E4E4E7',
                  background: isActive ? era.color : '#F4F4F5',
                  color: isActive ? '#FFFFFF' : '#3F3F46',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? `0 4px 14px ${era.color}40` : 'none'
                }}
              >
                <MapPin size={13} style={{ opacity: isActive ? 1 : 0.6 }} />
                {era.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div 
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            minWidth: '260px',
            flex: '1 1 260px',
            maxWidth: '380px'
          }}
        >
          <Search size={16} style={{ position: 'absolute', left: '12px', color: '#71717A' }} />
          <input
            type="text"
            placeholder="Search by DRR name or year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: '10px',
              border: '1.5px solid #E4E4E7',
              fontSize: '0.88rem',
              outline: 'none',
              color: '#18181B',
              fontWeight: 600,
              background: '#FAFAFA'
            }}
          />
        </div>
      </div>

      {/* DRR Grid */}
      {filteredDRRs.length === 0 ? (
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            padding: '60px 20px',
            textAlign: 'center',
            color: '#52525B'
          }}
        >
          <User size={48} style={{ color: 'var(--rotaract-pink)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#18181B' }}>No DRR Records Found</h3>
          <p style={{ fontSize: '0.95rem', color: '#71717A', marginTop: '6px' }}>
            No leader matched your current filter or search criteria.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '26px' }}>
          {filteredDRRs.map((drr) => {
            const isCurrentDRR = drr.year === '2026-27' || drr.name.toLowerCase().includes('archit');
            const eraConfig = getEraBadgeConfig(drr.district);
            return (
              <DRRCard
                key={drr.id}
                drr={drr}
                eraConfig={eraConfig}
                isCurrentDRR={isCurrentDRR}
                initials={getInitials(drr.name)}
              />
            );
          })}
        </div>
      )}

      {/* Bottom Summary Counter */}
      <div 
        style={{
          marginTop: '45px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: '0.9rem',
          fontWeight: 600
        }}
      >
        Preserving the 40+ year legacy of leadership across Rotary International Districts 301, 3010, and 3011.
      </div>

    </div>
  );
}
