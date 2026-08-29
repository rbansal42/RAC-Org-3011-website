import React, { useState } from 'react';
import { X, Shield, PlusCircle, Sparkles, MapPin, User, CheckCircle2, Lock } from 'lucide-react';

export default function PresidentModal({
  mode,
  onClose,
  onAddInitiative,
  clubs,
  preselectedClub
}) {
  const [targetClubId, setTargetClubId] = useState(preselectedClub?.id || clubs[0]?.id || '');
  const [initTitle, setInitTitle] = useState('');
  const [initCategory, setInitCategory] = useState('Community Service & Health');
  const [initImpact, setInitImpact] = useState('');
  const [initDesc, setInitDesc] = useState('');
  const [initBeneficiaries, setInitBeneficiaries] = useState('');

  const handlePostInitiative = (e) => {
    e.preventDefault();
    if (!initTitle) return;

    const newInit = {
      id: `init-${Date.now()}`,
      title: initTitle,
      category: initCategory,
      impact: initImpact || 'High Community Impact',
      date: 'RY 2026-27',
      description: initDesc || 'Initiative executed under District 3011 guidelines.',
      beneficiaries: initBeneficiaries || 'Local Community'
    };

    onAddInitiative(targetClubId, newInit);
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="rotaract-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          position: 'relative',
          border: '2px solid var(--rotaract-pink)',
          animation: 'fadeInUp 0.3s ease-out forwards'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#FDF0F5',
            border: 'none',
            color: 'var(--rotaract-pink)',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        <form onSubmit={handlePostInitiative}>
          <div style={{ marginBottom: '20px' }}>
            <span className="pill-pink" style={{ fontSize: '0.78rem', marginBottom: '8px' }}>
              OFFICER PROJECT SUBMISSION
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Post New Project Initiative
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              This initiative will be published to the District 3011 Directory and reveal on hover.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                Select Rotaract Club *
              </label>
              <select
                value={targetClubId}
                onChange={(e) => setTargetClubId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7', outline: 'none' }}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                Initiative / Project Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Project Sparsh: Pediatric Cardiac Surgery Camp"
                required
                value={initTitle}
                onChange={(e) => setInitTitle(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                  Focus Area / Category
                </label>
                <select
                  value={initCategory}
                  onChange={(e) => setInitCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7', outline: 'none' }}
                >
                  <option value="Peacebuilding and conflict prevention">Peacebuilding and conflict prevention</option>
                  <option value="Disease prevention and treatment">Disease prevention and treatment</option>
                  <option value="Water, sanitation, and hygiene (WASH)">Water, sanitation, and hygiene (WASH)</option>
                  <option value="Maternal and child health">Maternal and child health</option>
                  <option value="Basic education and literacy">Basic education and literacy</option>
                  <option value="Community economic development">Community economic development</option>
                  <option value="Supporting the environment">Supporting the environment</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                  Impact Metric
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 Blood Units Collected"
                  value={initImpact}
                  onChange={(e) => setInitImpact(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                Project Description
              </label>
              <textarea
                rows="3"
                placeholder="Describe the objective, beneficiaries, and execution details..."
                value={initDesc}
                onChange={(e) => setInitDesc(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7', outline: 'none' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-rotaract" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
            <Sparkles size={18} /> Publish Initiative to Directory
          </button>
        </form>
      </div>
    </div>
  );
}
