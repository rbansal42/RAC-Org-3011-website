import React from 'react';
import { MapPin, Phone, Mail, MessageSquare, User, UserCheck, ArrowLeft, Sparkles } from 'lucide-react';

function ContactRow({ phone, email, tone = 'pink' }) {
  const accent = tone === 'green' ? '#059669' : 'var(--rotaract-pink)';
  const accentBg = tone === 'green' ? '#F0FDF4' : 'var(--rotaract-pink-light)';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
      {phone && (
        <a
          href={`https://wa.me/91${phone.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#25D366', color: '#FFFFFF', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}
        >
          <MessageSquare size={14} /> WhatsApp
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: accentBg, color: accent, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <Mail size={14} /> {email}
        </a>
      )}
    </div>
  );
}

export default function ClubDetail({ club, onBack, onNavigateInitiatives, onNavigateLeadership }) {
  if (!club) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Club not found.
        <div style={{ marginTop: '16px' }}>
          <button onClick={onBack} className="btn-rotaract">
            <ArrowLeft size={16} /> Back to Clubs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 80px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rotaract-pink)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}
        >
          <ArrowLeft size={14} /> All clubs
        </button>
        <span>/</span>
        <span>{club.zone}</span>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{club.shortName || club.name}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span className="pill-pink" style={{ fontSize: '0.78rem' }}>
          <MapPin size={12} /> {club.zone}
        </span>
        {club.rotaryId && (
          <span className="pill-gold" style={{ fontSize: '0.78rem' }}>
            Rotary ID {club.rotaryId}
          </span>
        )}
      </div>

      <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
        {club.name}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '32px' }}>
        {club.isDirector ? `Institution Director: ${club.isDirector}` : 'Community-based Rotaract club, District 3011'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="rotaract-card" style={{ padding: '22px', borderTop: '4px solid var(--rotaract-pink)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--rotaract-pink)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
            <User size={14} /> President
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {club.president || 'Rtr. Club President'}
          </div>
          <ContactRow phone={club.phone} email={club.email} tone="pink" />
        </div>

        {(club.secretary || club.secretaryPhone || club.secretaryEmail) && (
          <div className="rotaract-card" style={{ padding: '22px', borderTop: '4px solid #10b981' }}>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
              <UserCheck size={14} /> Secretary
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {club.secretary || 'Rtr. Club Secretary'}
            </div>
            <ContactRow phone={club.secretaryPhone} email={club.secretaryEmail} tone="green" />
          </div>
        )}
      </div>

      <div className="rotaract-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} style={{ color: 'var(--rotaract-pink)' }} /> Recent Projects
          </h3>
          {onNavigateInitiatives && (
            <button
              onClick={onNavigateInitiatives}
              style={{ background: 'none', border: 'none', color: 'var(--rotaract-pink)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              See all district initiatives &rarr;
            </button>
          )}
        </div>

        {club.initiatives && club.initiatives.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {club.initiatives.map((init, idx) => (
              <div key={idx} style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{init.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>{init.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No initiatives uploaded yet for this club. Presidents can log in to add one.
          </p>
        )}
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>
        Board of directors are not shown here individually: the district holds portrait and contact records for a
        handful of club officers, not all two hundred plus. President and secretary details above are kept current
        via the district roster sync.
      </p>
    </div>
  );
}
