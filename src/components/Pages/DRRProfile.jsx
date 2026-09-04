import React from 'react';
import { ArrowLeft, Award, Shield } from 'lucide-react';

function getInitials(name = '') {
  return name.replace(/^Rtr\.?\s*/i, '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function DRRProfile({ drr, onBack }) {
  if (!drr) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.85)' }}>
        DRR record not found.
        <div style={{ marginTop: '16px' }}>
          <button onClick={onBack} className="btn-rotaract">
            <ArrowLeft size={16} /> Back to Past DRRs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '8px 24px 60px 24px', color: '#FFFFFF' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFE082', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0, marginBottom: '24px', fontSize: '0.9rem' }}
      >
        <ArrowLeft size={14} /> All past DRRs
      </button>

      <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '28px' }}>
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)',
            border: '2px solid rgba(255, 224, 130, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.6rem',
            fontWeight: 900,
            color: '#FFE082',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            flexShrink: 0
          }}
        >
          {drr.photo && drr.hasPhoto ? (
            <img src={drr.photo} alt={drr.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            getInitials(drr.name)
          )}
        </div>

        <div>
          <span className="pill-gold" style={{ fontSize: '0.78rem', marginBottom: '8px' }}>
            <Shield size={12} /> DISTRICT {drr.district} &middot; {drr.tenure || drr.year}
          </span>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.5px', margin: '4px 0' }}>
            {drr.name}
          </h1>
          <p style={{ opacity: 0.9, fontSize: '1rem' }}>
            District Rotaract Representative &middot; {drr.homeClub}
          </p>
        </div>
      </div>

      <div className="rotaract-card" style={{ padding: '28px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px' }}>
        <div style={{ fontSize: '0.78rem', color: '#FFE082', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Award size={14} /> From the year
        </div>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.98rem', lineHeight: 1.7 }}>
          A full write-up for {drr.name.replace(/^Rtr\.?\s*/i, '')}'s year as DRR of District {drr.district} is being
          compiled by the district secretariat from club records and their own recollections. Once available it
          will cover the roles they held on their way to DRR and what the district took on during {drr.tenure || drr.year}.
        </p>
      </div>
    </div>
  );
}
