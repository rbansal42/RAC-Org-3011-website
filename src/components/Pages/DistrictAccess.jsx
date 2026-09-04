import React, { useState } from 'react';
import DistrictMap from '../District/DistrictMap';
import ClubInitiativesList from '../District/ClubInitiativesList';
import PastDRRShowcase from '../District/PastDRRShowcase';
import { DISTRICT_LEADERSHIP } from '../../data/districtData';
import { Shield, Sparkles, MapPin, Award, BookOpen, User, CheckCircle2 } from 'lucide-react';

export default function DistrictAccess({
  clubs,
  activeDistrictTab,
  isLoggedIn,
  userRole,
  onOpenLoginModal,
  onOpenUploadClubModal,
  onOpenPostInitiativeModal,
  onOpenClubProfile,
  onOpenDRRProfile,
  onOpenInitiativeDetail
}) {
  const [selectedClubId, setSelectedClubId] = useState(null);

  return (
    <div style={{ background: (activeDistrictTab === 'map-clubs' || !activeDistrictTab) ? '#FDF8FA' : 'linear-gradient(180deg, #D81B60 0%, #AD1457 100%)', minHeight: '100vh', padding: (activeDistrictTab === 'map-clubs' || !activeDistrictTab) ? '0px' : '40px 24px 80px 24px', color: 'var(--text-primary)' }}>
      {(!activeDistrictTab || activeDistrictTab === 'map-clubs') ? (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 70px)' }}>
          <DistrictMap
            clubs={clubs}
            isLoggedIn={isLoggedIn}
            userRole={userRole}
            onOpenLoginModal={onOpenLoginModal}
            onOpenUploadClubModal={onOpenUploadClubModal}
            onOpenPostInitiativeModal={onOpenPostInitiativeModal}
            onViewClubProfile={onOpenClubProfile}
          />
        </div>
      ) : (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {activeDistrictTab === 'heritage' && (
          <PastDRRShowcase onSelectDRR={onOpenDRRProfile} />
        )}

        {activeDistrictTab === 'initiatives' && (
          <ClubInitiativesList
            clubs={clubs}
            isLoggedIn={isLoggedIn}
            userRole={userRole}
            onOpenLoginModal={onOpenLoginModal}
            onOpenPostInitiativeModal={onOpenPostInitiativeModal}
            onSelectClub={onOpenClubProfile}
            onSelectInitiative={onOpenInitiativeDetail}
          />
        )}

        {activeDistrictTab === 'leadership' && (
          <div>
            <div style={{ textAlign: 'center', color: '#FFFFFF', marginBottom: '40px' }}>
              <span className="pill-gold" style={{ fontSize: '0.82rem', marginBottom: '12px' }}>
                EXECUTIVE COUNCIL RY 2026-27
              </span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
                District Secretariat & Leadership
              </h2>
              <p style={{ opacity: 0.9, fontSize: '1.05rem', maxWidth: '640px', margin: '8px auto 0 auto' }}>
                Guided by experience and passion, leading Rotaract District 3011 towards fellowship and service excellence.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {DISTRICT_LEADERSHIP.map((leader, index) => (
                <div 
                  key={index} 
                  className="rotaract-card" 
                  style={{ 
                    padding: '28px', 
                    textAlign: 'center', 
                    backgroundColor: '#FFFFFF', 
                    borderRadius: '24px',
                    border: '2px solid rgba(216, 27, 96, 0.15)',
                    transition: 'all 0.3s ease' 
                  }}
                >
                  <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--rotaract-pink) 0%, var(--rotaract-cranberry-dark) 100%)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '1.8rem', fontWeight: 900, boxShadow: '0 10px 25px rgba(216,27,96,0.3)' }}>
                    {leader.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {leader.name}
                  </h3>
                  <div style={{ color: 'var(--rotaract-pink)', fontWeight: 800, fontSize: '0.88rem', marginBottom: '12px' }}>
                    {leader.role}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: '#FDF5F8', padding: '6px 12px', borderRadius: '100px', display: 'inline-block' }}>
                    Home Club: {leader.homeClub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
