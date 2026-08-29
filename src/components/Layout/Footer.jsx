import React, { useState, useEffect } from 'react';
import DistrictLogo from './DistrictLogo';
import { Heart, ExternalLink } from 'lucide-react';

export default function Footer({ onNavigatePage, isFullScreen = false }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* Shared style for nav link buttons — 44px touch target on mobile */
  const navLinkStyle = {
    background: 'none',
    border: 'none',
    color: '#A1A1AA',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'color 0.2s',
    padding: isMobile ? '10px 0' : '4px 0',
    minHeight: isMobile ? '44px' : 'auto',
    display: 'flex',
    alignItems: 'center'
  };

  return (
    <footer
      style={{
        backgroundColor: '#18181B',
        color: '#FAFAFA',
        borderTop: '4px solid var(--rotaract-pink)',
        paddingTop: isMobile ? '40px' : '60px',
        paddingBottom: isMobile ? '28px' : '40px',
        position: 'relative',
        zIndex: 20,
        width: '100%',
        minHeight: isFullScreen ? '100vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: isMobile ? '32px' : '60px', marginBottom: isMobile ? '32px' : '50px' }}>
          
          <div>
            <div style={{ background: 'transparent', padding: '0px', display: 'inline-block', marginBottom: '20px' }}>
              <DistrictLogo size="small" />
            </div>
            <p style={{ color: '#A1A1AA', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: '1.7', marginBottom: '20px' }}>
              Rotaract District Organization 3011 encompasses over 70+ clubs across Delhi &amp; NCR, uniting young leaders for impact, service, and global fellowship.
            </p>
            <span className="pill-gold" style={{ fontSize: '0.8rem' }}>
              Service Above Self • RY 2026-27
            </span>
          </div>

          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', letterSpacing: '0.5px' }}>
              Quick Navigation
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: isMobile ? '0' : '8px' }}>
              <li>
                <button
                  onClick={() => onNavigatePage && onNavigatePage('home')}
                  style={navLinkStyle}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D81B60'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  Home Page
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigatePage && onNavigatePage('district')}
                  style={navLinkStyle}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D81B60'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  District Directory (RY 2026-27)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigatePage && onNavigatePage('portal')}
                  style={navLinkStyle}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D81B60'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  District Portal Access
                </button>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/rotaractdistrict.3011/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...navLinkStyle, color: '#A1A1AA', textDecoration: 'none', gap: '6px' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D81B60'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  Official Instagram <ExternalLink size={14} />
                </a>
              </li>
              <li>
                <a
                  href="https://www.rotary.org"
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...navLinkStyle, color: '#A1A1AA', textDecoration: 'none', gap: '6px' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#D81B60'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#A1A1AA'}
                >
                  Rotary International <ExternalLink size={14} />
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright bar */}
        <div style={{
          borderTop: '1px solid #27272A',
          paddingTop: '24px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'center' : 'space-between',
          alignItems: 'center',
          gap: isMobile ? '10px' : '16px',
          fontSize: '0.85rem',
          color: '#71717A',
          textAlign: isMobile ? 'center' : 'left'
        }}>
          <div>
            © 2026 Rotaract District Organization 3011. All Rights Reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Built with <Heart size={14} fill="#D81B60" color="#D81B60" /> for District 3011 Rotaractors
          </div>
        </div>
      </div>
    </footer>
  );
}
