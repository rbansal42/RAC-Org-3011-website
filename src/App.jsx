import React, { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import PublicHome from './components/Pages/PublicHome';
import DistrictAccess from './components/Pages/DistrictAccess';
const PortalPage = React.lazy(() => import('./components/Pages/PortalPage'));
import LoginModal from './components/Modals/LoginModal';
import PresidentModal from './components/Modals/PresidentModal';
import { INITIAL_CLUBS } from './data/districtData';
import { getParsedClubsFromExcel } from './data/excelReader';
import { dbService } from './lib/supabaseClient';
import rotaryLogoImg from '../images.png';

// Spinning Rotary Wheel Logo for Glass Loading Screen
function RotaryLoaderLogo({ size = 96 }) {
  return (
    <img
      src={rotaryLogoImg}
      alt="Rotary International Logo"
      loading="eager"
      decoding="async"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        animation: 'rotarySpin 3.5s linear infinite'
      }}
    />
  );
}

// URL Route Mapping Table for Browser Deep Linking & History Navigation
const ROUTE_MAP = {
  '/': { page: 'home', tab: 'map-clubs' },
  '/directory': { page: 'district', tab: 'map-clubs' },
  '/map': { page: 'district', tab: 'map-clubs' },
  '/heritage': { page: 'district', tab: 'heritage' },
  '/initiatives': { page: 'district', tab: 'initiatives' },
  '/governance': { page: 'district', tab: 'leadership' },
  '/leadership': { page: 'district', tab: 'leadership' },
  '/portal': { page: 'portal', tab: 'map-clubs' }
};

const getPathFromState = (page, tab) => {
  if (page === 'home') return '/';
  if (page === 'portal') return '/portal';
  if (page === 'district') {
    if (tab === 'heritage') return '/heritage';
    if (tab === 'initiatives') return '/initiatives';
    if (tab === 'leadership') return '/governance';
    return '/directory';
  }
  return '/';
};

export default function App() {
  // Get initial route from browser URL
  const initialPath = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  const initialRoute = ROUTE_MAP[initialPath] || { page: 'home', tab: 'map-clubs' };

  // Navigation State ('home' | 'district' | 'portal')
  const [activePage, setActivePageState] = useState(initialRoute.page);

  // District Sub-navigation ('map-clubs' | 'heritage' | 'initiatives' | 'leadership')
  const [activeDistrictTab, setActiveDistrictTabState] = useState(initialRoute.tab);

  // Router Handlers with HTML5 History API Sync
  const handlePageChange = (page, tab = null) => {
    const targetTab = tab || (page === 'district' ? (activeDistrictTab || 'map-clubs') : 'map-clubs');
    if (page === activePage && targetTab === activeDistrictTab) return;

    setActivePageState(page);
    setActiveDistrictTabState(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const path = getPathFromState(page, targetTab);
    if (window.location.pathname !== path) {
      window.history.pushState({ page, tab: targetTab }, '', path);
    }
  };

  const handleDistrictTabChange = (tab) => {
    if (tab === activeDistrictTab && activePage === 'district') return;

    setActivePageState('district');
    setActiveDistrictTabState(tab);

    const path = getPathFromState('district', tab);
    if (window.location.pathname !== path) {
      window.history.pushState({ page: 'district', tab }, '', path);
    }
  };

  // Listen to Browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      const route = ROUTE_MAP[currentPath] || { page: 'home', tab: 'map-clubs' };
      setActivePageState(route.page);
      setActiveDistrictTabState(route.tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dynamic Clubs Data State
  const [clubs, setClubs] = useState(INITIAL_CLUBS);

  // Sync Supabase Database & Excel roster into global clubs state
  useEffect(() => {
    async function syncClubsData() {
      try {
        // 1. Fetch live clubs from Supabase
        const spClubs = await dbService.fetchClubs();
        if (spClubs && spClubs.length > 0) {
          setClubs(spClubs);
          return;
        }

        // 2. Fallback to local Excel roster sync
        const parsed = await getParsedClubsFromExcel();
        if (parsed && parsed.length > 0) {
          setClubs(prev => {
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
                  zone: matched.zone || c.zone,
                  phone: matched.phone || c.phone,
                  email: matched.email || c.email
                };
              }
              return c;
            });
          });
        }
      } catch (err) {
        console.warn('Clubs sync notice:', err);
      }
    }
    syncClubsData();
  }, []);

  // Authentication & Access Role Tier State (Persisted in localStorage for 5 Hours)
  const [userSession, setUserSession] = useState(() => {
    try {
      const saved = localStorage.getItem('district3011_session_v1');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Verify session expiry (5 hours minimum logged in period)
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem('district3011_session_v1');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(userSession));
  const [userRole, setUserRole] = useState(() => userSession?.role || null);

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [uploaderModalMode, setUploaderModalMode] = useState(null); // null | 'uploadClub' | 'postInitiative'
  const [preselectedClubForModal, setPreselectedClubForModal] = useState(null);

  // Contextual Morphing Custom Cursor (Zero-Lag Direct DOM Ref)
  const cursorDotRef = useRef(null);
  const cursorFollowerRef = useRef(null);
  const [cursorHovered, setCursorHovered] = useState(false);

  // Staggered Curtain Reveal State for VERY BEGINNING Initial Load (Rotaract Pink)
  const [showCurtain, setShowCurtain] = useState(true);
  const [curtainAnimated, setCurtainAnimated] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setCurtainAnimated(true);
    }, 150);
    const timer2 = setTimeout(() => {
      setShowCurtain(false);
    }, 2200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    let rAFId = null;

    const handleMouseMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;

      if (rAFId) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        if (cursorDotRef.current) {
          cursorDotRef.current.style.left = `${x}px`;
          cursorDotRef.current.style.top = `${y}px`;
        }
        if (cursorFollowerRef.current) {
          cursorFollowerRef.current.style.left = `${x}px`;
          cursorFollowerRef.current.style.top = `${y}px`;
        }
      });

      const target = e.target.closest('[data-cursor]');
      const isHovering = Boolean(target);
      setCursorHovered((prev) => (prev !== isHovering ? isHovering : prev));
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rAFId) cancelAnimationFrame(rAFId);
    };
  }, []);

  // Universal Page & Sub-Tab Loader State
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Add uploaded club
  const handleAddClub = (newClub) => {
    setClubs((prevClubs) => [newClub, ...prevClubs]);
    handlePageChange('district', 'map-clubs');
  };

  // Add posted initiative
  const handleAddInitiative = (targetClubId, newInitiative) => {
    setClubs((prevClubs) =>
      prevClubs.map((club) => {
        if (club.id === targetClubId) {
          return {
            ...club,
            initiatives: [newInitiative, ...(club.initiatives || [])]
          };
        }
        return club;
      })
    );
    handlePageChange('district', 'map-clubs');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>

      {/* 1. INITIAL SITE ENTRANCE: Staggered Rotaract Pink Curtain Reveal Overlay */}
      {showCurtain && (
        <div className={`curtain-container ${curtainAnimated ? 'animate' : ''}`}>
          <div className="curtain-strip" />
          <div className="curtain-strip" />
          <div className="curtain-strip" />
          <div className="curtain-strip" />
          <div className="curtain-strip" />
        </div>
      )}

      {/* 2. SUBSEQUENT PAGE & TAB NAVIGATIONS: Translucent Glass Loading Screen with Spinning Rotary Logo */}
      {isPageLoading && (
        <div className="glass-loading-screen">
          <div className="glass-loading-card">
            <RotaryLoaderLogo size={96} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '2px', color: '#FFFFFF', textTransform: 'uppercase' }}>
              ROTARACT DISTRICT 3011
            </span>
          </div>
        </div>
      )}

      {/* Contextual Morphing Custom Cursor (Desktop Only) */}
      <div
        ref={cursorDotRef}
        className="custom-cursor-dot"
        style={{ left: '-100px', top: '-100px' }}
      />
      <div
        ref={cursorFollowerRef}
        className={`custom-cursor-follower ${cursorHovered ? 'hovered' : ''}`}
        style={{ left: '-100px', top: '-100px' }}
      />

      {/* Top Navbar */}
      <Navbar
        activePage={activePage}
        setActivePage={handlePageChange}
        activeDistrictTab={activeDistrictTab}
        setActiveDistrictTab={handleDistrictTabChange}
        isLoggedIn={isLoggedIn}
        userRole={userRole}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={() => {
          setIsLoggedIn(false);
          setUserSession(null);
          try { localStorage.removeItem('district3011_session_v1'); } catch (e) {}
          if (activePage === 'portal') handlePageChange('home');
        }}
      />

      {/* Main Workspace Body */}
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {activePage === 'home' && (
          <PublicHome
            onNavigateDistrict={() => {
              handlePageChange('district', 'map-clubs');
            }}
            onNavigatePage={(page) => handlePageChange(page)}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        )}

        {activePage === 'district' && (
          <DistrictAccess
            clubs={clubs}
            activeDistrictTab={activeDistrictTab}
            isLoggedIn={isLoggedIn}
            userRole={userRole}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenUploadClubModal={() => setUploaderModalMode('uploadClub')}
            onOpenPostInitiativeModal={(club) => {
              setPreselectedClubForModal(club);
              setUploaderModalMode('postInitiative');
            }}
          />
        )}

        {activePage === 'portal' && (
          <Suspense fallback={
            <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <RotaryLoaderLogo size={64} />
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--rotaract-pink)', letterSpacing: '1px' }}>
                LOADING DISTRICT 3011 PORTAL...
              </div>
            </div>
          }>
            <PortalPage
              isLoggedIn={isLoggedIn}
              userRole={userRole}
              setUserRole={setUserRole}
              userSession={userSession}
              onLogout={() => {
                setIsLoggedIn(false);
                setUserSession(null);
                handlePageChange('home');
              }}
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onOpenUploadClubModal={() => setUploaderModalMode('uploadClub')}
              onOpenPostInitiativeModal={() => {
                setPreselectedClubForModal(null);
                setUploaderModalMode('postInitiative');
              }}
              clubs={clubs}
            />
          </Suspense>
        )}

        {/* Shared Footer (rendered inside main scroll container for non-home pages) */}
        {activePage !== 'home' && (
          <Footer onNavigatePage={(page) => handlePageChange(page)} />
        )}
      </main>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(session) => {
            setIsLoggedIn(true);
            setUserSession(session);
            setUserRole(session.role || null);
            try { localStorage.setItem('district3011_session_v1', JSON.stringify(session)); } catch (e) {}
            handlePageChange('portal');
          }}
        />
      )}

      {/* Club & Initiative Uploader Modals */}
      {uploaderModalMode && (
        <PresidentModal
          mode={uploaderModalMode}
          onClose={() => setUploaderModalMode(null)}
          onLoginSuccess={() => { }}
          onAddClub={handleAddClub}
          onAddInitiative={handleAddInitiative}
          clubs={clubs}
          preselectedClub={preselectedClubForModal}
        />
      )}

    </div>
  );
}
