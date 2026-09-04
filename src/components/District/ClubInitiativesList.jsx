import React, { useState } from 'react';
import { Search, MapPin, User, Globe, Sparkles, PlusCircle, Calendar, Award, ChevronDown, CheckCircle2, Mail, ExternalLink } from 'lucide-react';

export default function ClubInitiativesList({
  clubs,
  selectedClubId,
  onSelectClub,
  isPresidentLoggedIn,
  onOpenPostInitiativeForClub,
  onOpenUploadClubModal,
  onSelectInitiative
}) {
  const [hoveredClubId, setHoveredClubId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');

  const zones = ['All', 'Zone Prithvi', 'Zone Agni', 'Zone Vayu', 'Zone Akash'];

  const filteredClubs = clubs.filter((club) => {
    const matchesSearch =
      club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      club.president.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (club.initiatives && club.initiatives.some(i => i.title.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesZone = selectedZone === 'All' || club.zone === selectedZone || (club.zone && club.zone.includes(selectedZone));

    return matchesSearch && matchesZone;
  });

  return (
    <div style={{ marginTop: '40px' }}>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
        <div>
          <span className="pill-gold" style={{ marginBottom: '8px' }}>
            FEATURED SHOWCASE (RY 2026-27)
          </span>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 900, color: '#FFFFFF' }}>
            Rotaract Featured Initiatives (RY 2026-27)
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.92)', fontSize: '0.95rem', marginTop: '6px', fontWeight: 500 }}>
            Manually curated flagship community service initiatives selected by Club Presidents & District Officers.
          </p>
        </div>

        <button
          onClick={() => {
            if (onOpenPostInitiativeModal) {
              onOpenPostInitiativeModal(null);
            } else if (onOpenUploadClubModal) {
              onOpenUploadClubModal();
            }
          }}
          className="btn-rotaract"
          style={{ padding: '12px 24px', fontSize: '0.95rem', backgroundColor: '#FFFFFF', color: 'var(--rotaract-pink)', fontWeight: 800, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          <PlusCircle size={18} />
          + Add Featured Initiative
        </button>
      </div>

      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(216, 27, 96, 0.15)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '32px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(216, 27, 96, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px', background: '#FDF5F8', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(216, 27, 96, 0.12)' }}>
          <Search size={18} style={{ color: 'var(--rotaract-pink)' }} />
          <input
            type="text"
            placeholder="Search by Club Name, President, or Initiative..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              fontSize: '0.9rem',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Filter Zone:</span>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(216, 27, 96, 0.2)',
              backgroundColor: '#FFFFFF',
              color: 'var(--rotaract-pink)',
              fontWeight: 700,
              fontSize: '0.88rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {zones.map((z, idx) => (
              <option key={idx} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '28px', alignItems: 'start' }}>
        {filteredClubs.map((club) => {
          const hasActiveHover = hoveredClubId !== null;
          const isHovered = hoveredClubId === club.id;
          const isSelected = selectedClubId === club.id;

          return (
            <div
              key={club.id}
              className="rotaract-card"
              onMouseEnter={() => setHoveredClubId(club.id)}
              onMouseLeave={() => setHoveredClubId(null)}
              onClick={() => {
                if (onSelectClub) onSelectClub(club.id);
                const mapElem = document.getElementById('district-map-section');
                if (mapElem) {
                  mapElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              style={{
                padding: '24px',
                border: isHovered || isSelected ? '2px solid var(--rotaract-pink)' : '2px solid rgba(216, 27, 96, 0.12)',
                backgroundColor: '#FFFFFF',
                boxShadow: isHovered ? '0 20px 50px rgba(216, 27, 96, 0.22)' : 'var(--shadow-sm)',
                transform: isHovered ? 'scale(1.03) translateY(-6px)' : 'scale(1) translateY(0)',
                filter: hasActiveHover && !isHovered ? 'blur(2px) opacity(0.55)' : 'none',
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, filter 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: 'pointer',
                position: 'relative',
                zIndex: isHovered ? 10 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pill-pink" style={{ fontSize: '0.78rem' }}>
                  <MapPin size={12} /> {club.zone}
                </span>
                {club.badge && (
                  <span className="pill-gold" style={{ fontSize: '0.76rem' }}>
                    {club.badge}
                  </span>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--rotaract-pink)', marginBottom: '6px', lineHeight: 1.25, wordBreak: 'break-word' }}>
                  {club.name}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.92rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} style={{ color: 'var(--skyline-gold-dark)' }} />
                    <span>President: {club.president}</span>
                  </div>
                  {club.isDirector && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#123499' }}>
                      <Globe size={16} />
                      <span>IS Director: {club.isDirector}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '0.84rem', color: 'var(--text-secondary)', background: '#FDF5F8', padding: '10px 14px', borderRadius: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                {club.isDirector && (
                  <>
                    <div><strong>IS Director:</strong> {club.isDirector}</div>
                    <div>•</div>
                  </>
                )}
                <div><strong>Initiatives:</strong> {club.initiatives ? club.initiatives.length : 0}</div>
              </div>

              <div
                style={{
                  maxHeight: isHovered || isSelected ? '400px' : '0px',
                  opacity: isHovered || isSelected ? 1 : 0,
                  overflow: 'hidden',
                  transition: isHovered || isSelected 
                    ? 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease 0.05s, padding-top 0.35s ease, border-color 0.3s ease'
                    : 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out, padding-top 0.35s ease, border-color 0.2s ease',
                  borderTop: '1px dashed',
                  borderColor: isHovered || isSelected ? 'rgba(216, 27, 96, 0.25)' : 'transparent',
                  paddingTop: isHovered || isSelected ? '16px' : '0px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--rotaract-pink)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', margin: 0 }}>
                    Club Initiatives
                  </h4>
                  {isPresidentLoggedIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenPostInitiativeForClub) onOpenPostInitiativeForClub(club);
                      }}
                      style={{
                        background: 'var(--rotaract-pink-light)',
                        border: '1px solid rgba(216, 27, 96, 0.3)',
                        color: 'var(--rotaract-pink)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      + Add Initiative
                    </button>
                  )}
                </div>

                {club.initiatives && club.initiatives.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {club.initiatives.map((init, iIdx) => (
                      <div
                        key={iIdx}
                        onClick={(e) => {
                          if (onSelectInitiative) {
                            e.stopPropagation();
                            onSelectInitiative(club, init);
                          }
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #F3E5EB',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          cursor: onSelectInitiative ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {init.title}
                          </h5>
                          <span style={{ fontSize: '0.72rem', background: '#FDF0F5', color: 'var(--rotaract-pink)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            {init.category}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
                          {init.description}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--skyline-gold-dark)', fontWeight: 700 }}>
                          <span>Impact: {init.impact}</span>
                          {init.beneficiaries && <span>Target: {init.beneficiaries}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', italic: 'true' }}>
                    No initiatives uploaded yet. Presidents can log in to add initiatives.
                  </p>
                )}
              </div>

              <div 
                style={{ 
                  textAlign: 'center', 
                  fontSize: '0.8rem', 
                  color: 'var(--rotaract-pink)', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '4px',
                  maxHeight: isHovered || isSelected ? '0px' : '30px',
                  opacity: isHovered || isSelected ? 0 : 1,
                  overflow: 'hidden',
                  marginTop: isHovered || isSelected ? '0px' : '4px',
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: 'none'
                }}
              >
                <span>Hover to reveal initiatives</span>
                <ChevronDown size={14} />
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
