import React from 'react';
import { ArrowLeft, MapPin, Calendar, Users, Award } from 'lucide-react';

export default function ShowcaseDetail({ initiative, club, allClubs, onBack, onOpenClubProfile }) {
  if (!initiative || !club) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Project not found.
        <div style={{ marginTop: '16px' }}>
          <button onClick={onBack} className="btn-rotaract">
            <ArrowLeft size={16} /> Back to Showcase
          </button>
        </div>
      </div>
    );
  }

  const related = (allClubs || [])
    .flatMap((c) => (c.initiatives || []).map((i) => ({ club: c, initiative: i })))
    .filter((entry) => entry.initiative.category === initiative.category && entry.initiative.title !== initiative.title)
    .slice(0, 3);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 80px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rotaract-pink)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}
        >
          <ArrowLeft size={14} /> All projects
        </button>
        <span>/</span>
        <span>{initiative.category}</span>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{initiative.title}</span>
      </div>

      <span className="pill-pink" style={{ fontSize: '0.78rem', marginBottom: '10px' }}>
        {initiative.category}
      </span>

      <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: '8px 0 16px 0' }}>
        {initiative.title}
      </h1>

      <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '24px' }}>
        {initiative.description}
      </p>

      <div className="rotaract-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--rotaract-pink)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Run By
        </div>
        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {club.name}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} /> {club.zone}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '16px' }}>
          {initiative.impact && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Award size={14} style={{ color: 'var(--skyline-gold-dark)' }} /> Impact: {initiative.impact}
            </span>
          )}
          {initiative.beneficiaries && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> Target: {initiative.beneficiaries}
            </span>
          )}
          {initiative.date && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> {initiative.date}
            </span>
          )}
        </div>

        {onOpenClubProfile && (
          <button
            onClick={() => onOpenClubProfile(club.id)}
            style={{ background: 'var(--rotaract-pink)', color: '#FFFFFF', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
          >
            See the club's page
          </button>
        )}
      </div>

      {related.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
            Also in {initiative.category}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {related.map((entry, idx) => (
              <div key={idx} className="rotaract-card" style={{ padding: '16px' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{entry.initiative.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '4px' }}>{entry.club.shortName || entry.club.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
