import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, Sparkles, MapPin, Award, BookOpen, Shield, Globe, 
  Compass, ExternalLink, LogIn, LogOut, UserCheck, ChevronRight, 
  ChevronDown, Home, Users, FolderKanban, LayoutDashboard, X 
} from 'lucide-react';
import DistrictLogo from './DistrictLogo';

export default function MorphedMenu({
  activePage,
  setActivePage,
  activeDistrictTab,
  setActiveDistrictTab,
  isLoggedIn,
  userRole,
  onOpenLoginModal,
  onLogout,
  onMenuOpenChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [hoveredSubNav, setHoveredSubNav] = useState(null);
  const [hoveredFooter, setHoveredFooter] = useState(null);
  const [districtExpanded, setDistrictExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const menuRef = useRef(null);

  useEffect(() => {
    if (onMenuOpenChange) onMenuOpenChange(isOpen);
  }, [isOpen, onMenuOpenChange]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mainLinks = [
    {
      id: 'home',
      title: 'Home',
      icon: <Home size={18} />,
      action: () => {
        setActivePage('home');
        setIsOpen(false);
      },
      active: activePage === 'home'
    },
    {
      id: 'district',
      title: 'Know Our District',
      icon: <Globe size={18} />,
      hasSubNav: true,
      action: () => {
        if (setActiveDistrictTab) {
          setActiveDistrictTab('map-clubs');
        } else {
          setActivePage('district', 'map-clubs');
        }
        setIsOpen(false);
      },
      active: activePage === 'district',
      subTabs: [
        {
          id: 'map-clubs',
          title: 'Interactive Map & Clubs',
          icon: <MapPin size={15} />,
          action: () => {
            if (setActiveDistrictTab) {
              setActiveDistrictTab('map-clubs');
            } else {
              setActivePage('district', 'map-clubs');
            }
            setIsOpen(false);
          },
          active: activePage === 'district' && activeDistrictTab === 'map-clubs'
        },
        {
          id: 'heritage',
          title: 'Past DRR & Heritage',
          icon: <Award size={15} />,
          action: () => {
            if (setActiveDistrictTab) {
              setActiveDistrictTab('heritage');
            } else {
              setActivePage('district', 'heritage');
            }
            setIsOpen(false);
          },
          active: activePage === 'district' && activeDistrictTab === 'heritage'
        },
        {
          id: 'initiatives',
          title: 'Initiatives Showcase',
          icon: <Sparkles size={15} />,
          action: () => {
            if (setActiveDistrictTab) {
              setActiveDistrictTab('initiatives');
            } else {
              setActivePage('district', 'initiatives');
            }
            setIsOpen(false);
          },
          active: activePage === 'district' && activeDistrictTab === 'initiatives'
        },
        {
          id: 'leadership',
          title: 'District Leadership',
          icon: <Users size={15} />,
          action: () => {
            if (setActiveDistrictTab) {
              setActiveDistrictTab('leadership');
            } else {
              setActivePage('district', 'leadership');
            }
            setIsOpen(false);
          },
          active: activePage === 'district' && activeDistrictTab === 'leadership'
        }
      ]
    },
    {
      id: 'portal',
      title: 'District Portal',
      icon: <LayoutDashboard size={18} />,
      action: () => {
        if (isLoggedIn) {
          setActivePage('portal');
        } else {
          onOpenLoginModal();
        }
        setIsOpen(false);
      },
      active: activePage === 'portal'
    }
  ];

  const footerLinks = [
    { title: 'Interactive Map', action: () => { setActivePage('district'); setActiveDistrictTab('map-clubs'); setIsOpen(false); } },
    { title: 'Rotaract Global', url: 'https://www.rotary.org/en/get-involved/rotaract-clubs' },
    { title: 'Official Instagram', url: 'https://www.instagram.com/rotaractdistrict.3011/' }
  ];

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block', zIndex: 9999 }}>

        {/* Mobile Backdrop Overlay when Menu is Open */}
        {isOpen && isMobile && (
          <div
            onClick={() => setIsOpen(false)}
            onTouchStart={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 10000,
              transition: 'opacity 0.3s ease'
            }}
          />
        )}

        <div
          style={{
            position: isMobile && isOpen ? 'fixed' : 'absolute',
            top: isMobile && isOpen ? '12px' : '-7px',
            left: isMobile && isOpen ? '50%' : 'auto',
            right: isMobile && isOpen ? 'auto' : '-18px',
            transform: isMobile && isOpen ? 'translateX(-50%)' : 'none',
            width: isOpen ? (isMobile ? 'calc(100vw - 24px)' : 'min(420px, 92vw)') : (isMobile ? '64px' : '60px'),
            maxWidth: '420px',
            height: isOpen ? (isMobile ? 'min(640px, calc(100dvh - 24px))' : 'min(640px, 90vh)') : (isMobile ? '44px' : '36px'),
            backgroundColor: 'rgba(15, 18, 26, 0.88)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(216, 27, 96, 0.16) 0%, rgba(197, 160, 89, 0.08) 40%, transparent 75%)',
            borderRadius: isMobile ? '20px' : '24px',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            boxShadow: isOpen 
              ? '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 30px rgba(216, 27, 96, 0.25)' 
              : '0 4px 15px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: isOpen ? 'auto' : 'none',
            opacity: isOpen ? 1 : 0,
            transformOrigin: isMobile ? 'top center' : 'top right',
            zIndex: 10001
          }}
        >
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #D81B60 0%, #123499 50%, #880E4F 100%)' }} />

          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: 'calc(100% - 3px)', 
              padding: isMobile ? '18px 18px 16px 18px' : '24px 26px 20px 26px', 
              justifyContent: 'space-between',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DistrictLogo size="medium" />
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  padding: '5px 14px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(216, 27, 96, 0.8)';
                  e.currentTarget.style.borderColor = '#D81B60';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <X size={14} /> Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px 0 16px 0' }}>
              {mainLinks.map((link, idx) => {
                const isHovered = hoveredNav === idx;
                return (
                  <div key={link.id} style={{ perspective: '800px', perspectiveOrigin: 'bottom' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '100px',
                        background: link.active ? 'rgba(255, 255, 255, 0.08)' : isHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                        border: link.active ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
                        transform: isOpen ? 'rotateX(0deg) translateY(0px)' : 'rotateX(45deg) translateY(30px)',
                        opacity: isOpen ? 1 : 0,
                        transition: `transform 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.04 + 0.08}s, opacity 0.45s ease ${idx * 0.04 + 0.08}s, background 0.2s ease`
                      }}
                    >
                      <div
                        onClick={link.action}
                        onMouseEnter={() => setHoveredNav(idx)}
                        onMouseLeave={() => setHoveredNav(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          flex: 1
                        }}
                      >
                        <div
                          style={{
                            width: isHovered ? '20px' : '0px',
                            opacity: isHovered ? 1 : 0,
                            overflow: 'hidden',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            color: '#FFFFFF'
                          }}
                        >
                          <ArrowRight size={18} />
                        </div>

                        <span style={{ color: link.active ? '#FF4081' : 'rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center' }}>
                          {link.icon}
                        </span>

                        <span
                          style={{
                            color: link.active ? '#FFFFFF' : isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
                            fontSize: '0.90rem',
                            fontWeight: link.active ? 800 : 700,
                            letterSpacing: '0px',
                            transition: 'color 0.25s ease, transform 0.25s ease',
                            transform: isHovered ? 'translateX(4px)' : 'translateX(0)'
                          }}
                        >
                          {link.title}
                        </span>

                        {link.active && (
                          <span 
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#FF4081',
                              boxShadow: '0 0 10px #FF4081',
                              marginLeft: '6px'
                            }}
                          />
                        )}
                      </div>

                      {link.hasSubNav && (
                        <button
                          onClick={() => setDistrictExpanded(!districtExpanded)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.6)',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.2s ease'
                          }}
                        >
                          {districtExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                    </div>

                    {link.hasSubNav && districtExpanded && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          marginLeft: '28px',
                          marginTop: '4px',
                          marginBottom: '6px',
                          borderLeft: '2px solid rgba(255, 255, 255, 0.15)',
                          paddingLeft: '12px'
                        }}
                      >
                        {link.subTabs.map((sub, sIdx) => {
                          const isSubHovered = hoveredSubNav === sIdx;
                          return (
                            <div
                              key={sub.id}
                              onClick={sub.action}
                              onMouseEnter={() => setHoveredSubNav(sIdx)}
                              onMouseLeave={() => setHoveredSubNav(null)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '5px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: sub.active ? 'rgba(255, 255, 255, 0.1)' : isSubHovered ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                border: sub.active ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <span style={{ color: sub.active ? '#FF4081' : isSubHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)' }}>
                                {sub.icon}
                              </span>
                              <span
                                style={{
                                  color: sub.active ? '#FFFFFF' : isSubHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
                                  fontSize: '0.82rem',
                                  fontWeight: sub.active ? 700 : 600
                                }}
                              >
                                {sub.title}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                paddingTop: '14px',
                paddingBottom: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                margin: '8px 0 16px 0',
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? 'translateY(0)' : 'translateY(15px)',
                transition: 'all 0.45s ease 0.18s'
              }}
            >
              {isLoggedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div 
                      style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        background: 'rgba(216, 27, 96, 0.2)', 
                        border: '1px solid #D81B60', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: '#D81B60' 
                      }}
                    >
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <div style={{ color: '#FFFFFF', fontSize: '0.86rem', fontWeight: 800 }}>
                        District Portal
                      </div>
                      <span 
                        style={{ 
                          fontSize: '0.72rem', 
                          padding: '2px 10px', 
                          borderRadius: '6px', 
                          background: userRole === 'officer' 
                            ? 'rgba(245, 158, 11, 0.18)' 
                            : userRole === 'secretary'
                            ? 'rgba(14, 165, 233, 0.18)'
                            : 'rgba(216, 27, 96, 0.18)',
                          border: userRole === 'officer'
                            ? '1px solid #F59E0B'
                            : userRole === 'secretary'
                            ? '1px solid #38BDF8'
                            : '1px solid #FF4081',
                          color: userRole === 'officer'
                            ? '#FBBF24'
                            : userRole === 'secretary'
                            ? '#38BDF8'
                            : '#FF6B8B',
                          fontWeight: 800,
                          display: 'inline-block',
                          marginTop: '2px',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {(userRole || 'MEMBER').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsOpen(false);
                    }}
                    style={{
                      background: 'rgba(225, 29, 72, 0.15)',
                      border: '1px solid rgba(225, 29, 72, 0.4)',
                      color: '#FF6B8B',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onOpenLoginModal();
                    setIsOpen(false);
                  }}
                  className="btn-rotaract"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '9px 16px',
                    fontSize: '0.86rem',
                    borderRadius: '10px',
                    boxShadow: '0 4px 15px rgba(216, 27, 96, 0.4)'
                  }}
                >
                  <LogIn size={15} /> Login to District Portal
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 14px',
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.5s ease 0.22s'
              }}
            >
              {footerLinks.map((fLink, fIdx) => {
                const isHoveredF = hoveredFooter === fIdx;
                return (
                  <div
                    key={fIdx}
                    onMouseEnter={() => setHoveredFooter(fIdx)}
                    onMouseLeave={() => setHoveredFooter(null)}
                    onClick={() => {
                      if (fLink.action) fLink.action();
                      if (fLink.url) window.open(fLink.url, '_blank');
                    }}
                    style={{
                      position: 'relative',
                      width: 'fit-content',
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      style={{
                        color: isHoveredF ? '#D81B60' : 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.80rem',
                        fontWeight: 600,
                        transition: 'color 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {fLink.title}
                      {fLink.url && <ExternalLink size={10} />}
                    </span>

                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: '-2px',
                        height: '2px',
                        backgroundColor: '#D81B60',
                        width: isHoveredF ? '100%' : '0%',
                        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          style={{
            position: 'relative',
            height: isMobile ? '44px' : '36px',
            minWidth: isMobile ? '64px' : 'auto',
            padding: isMobile ? '0 14px' : '0 8px',
            borderRadius: '18px',
            overflow: 'hidden',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#FFFFFF',
            boxShadow: 'none',
            cursor: 'pointer',
            zIndex: 10000,
            outline: 'none',
            opacity: isOpen ? 0 : 1,
            pointerEvents: isOpen ? 'none' : 'auto',
            transform: isOpen ? 'scale(0.85)' : 'scale(1)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transform: isOpen ? 'translateY(-100%)' : 'translateY(0%)',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  letterSpacing: '1.2px',
                  color: '#FFFFFF',
                  transform: btnHovered ? 'translateY(-100%)' : 'translateY(0%)',
                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                MENU
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  letterSpacing: '1.2px',
                  color: '#FFFFFF',
                  transform: btnHovered ? 'translateY(0%)' : 'translateY(100%)',
                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                MENU
              </div>
            </div>

            <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  letterSpacing: '1.2px',
                  color: '#000000',
                  transform: btnHovered ? 'translateY(-100%)' : 'translateY(0%)',
                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                CLOSE
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  letterSpacing: '1.2px',
                  color: '#D81B60',
                  transform: btnHovered ? 'translateY(0%)' : 'translateY(100%)',
                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                CLOSE
              </div>
            </div>

          </div>
        </button>

      </div>
  );
}
