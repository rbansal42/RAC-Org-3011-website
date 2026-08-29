import React, { useState, useEffect, useRef } from 'react';
import { DISTRICT_INFO, ROTARY_FOCUS_AREAS, IMPACT_METRICS } from '../../data/districtData';
import { ArrowRight, ArrowUp, ArrowDown, MapPin, Sparkles, Award, Heart, CheckCircle2, Shield, LogIn, Calculator, UserPlus, Send, X, Globe, Layers, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import rotaryWheelImg from '../../../images.png';
import InteractiveDotGrid from '../Layout/InteractiveDotGrid';
import Footer from '../Layout/Footer';

const FLAGSHIP_SLICES = [
  { id: 1, title: 'Mahadan 9.0', subtitle: 'Mega Blood Donation Drive Across NCR', image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80', metric: '12,500+ Units Donated' },
  { id: 2, title: 'Clean Yamuna & Green NCR', subtitle: 'Environmental Tree Plantation & Water Care', image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80', metric: '66,000 Saplings Planted' },
  { id: 3, title: 'Digital Literacy Labs', subtitle: 'Equipping Government Schools with Tech', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80', metric: '50+ Labs Installed' },
  { id: 4, title: 'Pediatric Health Screening', subtitle: 'Free Heart & Health Checkups for Children', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80', metric: '20,000+ Kids Screened' },
  { id: 5, title: 'Youth Leadership Assembly', subtitle: 'District Conference & Vocational Excellence', image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80', metric: '1,500 Delegates' }
];

function ScrambleTitle({ text, className, style }) {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    let iteration = 0;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 2;
    }, 45);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span
      className={className}
      style={{
        ...style,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {displayText}
    </span>
  );
}

function TypewriterText({ text, highlightText, speed = 40, delay = 0, className, style, showCursor = true }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const fullText = text + (highlightText ? highlightText : '');

  useEffect(() => {
    let timeout;
    let timer;

    timeout = setTimeout(() => {
      timer = setInterval(() => {
        setDisplayedLength((prev) => {
          if (prev >= fullText.length) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (timer) clearInterval(timer);
    };
  }, [fullText, speed, delay]);

  const mainPart = text.slice(0, Math.min(displayedLength, text.length));
  const highlightPart = highlightText
    ? highlightText.slice(0, Math.max(0, displayedLength - text.length))
    : '';

  const isDone = displayedLength >= fullText.length;

  return (
    <span className={className} style={style}>
      {mainPart}
      {highlightText && (
        <span style={{ color: 'var(--rotaract-pink)' }}>
          {highlightPart}
        </span>
      )}
      {showCursor && (
        <span
          style={{
            display: 'inline-block',
            width: '4px',
            height: '0.85em',
            backgroundColor: 'var(--rotaract-pink)',
            marginLeft: '6px',
            verticalAlign: 'middle',
            animation: 'typewriterBlink 0.8s infinite',
            opacity: isDone ? 0 : 1,
            transition: 'opacity 0.4s ease'
          }}
        />
      )}
    </span>
  );
}

function BigRotaryWheel({ containerRef }) {
  const wheelRef = useRef(null);
  const scrollYRef = useRef(0);
  const ambientRotationRef = useRef(0);
  const currentScaleRef = useRef(1);
  const currentLeftRef = useRef(92);
  const [screenSize, setScreenSize] = useState(() => {
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) setScreenSize('mobile');
      else if (w < 1024) setScreenSize('tablet');
      else setScreenSize('desktop');
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Skip heavy animation on mobile — wheel is hidden
    if (screenSize === 'mobile') return;

    let animFrameId;

    const handleScroll = () => {
      const windowScroll = window.scrollY || document.documentElement.scrollTop;
      const containerScroll = containerRef && containerRef.current ? containerRef.current.scrollTop : 0;
      scrollYRef.current = Math.max(windowScroll, containerScroll);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const containerEl = containerRef?.current;
    if (containerEl) {
      containerEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    const updateFrame = () => {
      ambientRotationRef.current += 0.06;

      const scrollY = scrollYRef.current;
      const scrollProgress = Math.min(1, Math.max(0, scrollY / 450));

      const baseLeft = screenSize === 'tablet' ? 95 : 92;
      const targetScale = 1.0 - scrollProgress * 0.28;
      const targetLeft = baseLeft + scrollProgress * 4;

      currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.08;
      currentLeftRef.current += (targetLeft - currentLeftRef.current) * 0.08;

      const totalRotation = ambientRotationRef.current + scrollY * 0.12;

      if (wheelRef.current) {
        const scale = currentScaleRef.current.toFixed(4);
        const left = currentLeftRef.current.toFixed(3);
        const rot = (totalRotation % 360).toFixed(2);

        wheelRef.current.style.left = `${left}%`;
        wheelRef.current.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`;
      }

      animFrameId = requestAnimationFrame(updateFrame);
    };

    animFrameId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('scroll', handleScroll);
      if (containerEl) {
        containerEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [containerRef, screenSize]);

  // Hide wheel entirely on mobile (approved in plan)
  if (screenSize === 'mobile') return null;

  const wheelSize = screenSize === 'tablet' ? '700px' : '1100px';

  return (
    <div
      ref={wheelRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: screenSize === 'tablet' ? '95%' : '92%',
        transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
        width: wheelSize,
        height: wheelSize,
        maxWidth: '95vw',
        maxHeight: '95vw',
        pointerEvents: 'none',
        zIndex: 1,
        willChange: 'transform, left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <img
        src={rotaryWheelImg}
        alt="Rotary Wheel Anchor"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
}

const BASE_PROJECTS = [
  { title: 'Project Alpha', category: 'Category A', subtitle: 'Placeholder Subtitle A', image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=80', metric: '10,000+ Units', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
  { title: 'Project Beta', category: 'Category B', subtitle: 'Placeholder Subtitle B', image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1000&q=80', metric: '5,000+ Items', description: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' },
  { title: 'Project Gamma', category: 'Category C', subtitle: 'Placeholder Subtitle C', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=80', metric: '1,000+ People', description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.' },
  { title: 'Project Delta', category: 'Category D', subtitle: 'Placeholder Subtitle D', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1000&q=80', metric: '50+ Locations', description: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },
  { title: 'Project Epsilon', category: 'Category E', subtitle: 'Placeholder Subtitle E', image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1000&q=80', metric: '200+ Events', description: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.' },
  { title: 'Project Zeta', category: 'Category F', subtitle: 'Placeholder Subtitle F', image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1000&q=80', metric: '15,000+ Kits', description: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos.' },
  { title: 'Project Eta', category: 'Category G', subtitle: 'Placeholder Subtitle G', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1000&q=80', metric: '900+ Matches', description: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam.' }
];

function ExpandingCarousel() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        width: '100%',
        maxWidth: '1350px',
        margin: '0 auto',
        gap: isMobile ? '10px' : '16px',
        /* Tablet: reduce height from 650px to 500px */
        height: isMobile ? 'auto' : isTablet ? '500px' : '650px',
        padding: isMobile ? '0 12px' : '0 20px',
        zIndex: 5,
        position: 'relative'
      }}
    >
      {BASE_PROJECTS.map((proj, idx) => {
        const isActive = idx === selectedIndex;
        return (
          <div
            key={idx}
            onMouseEnter={() => !isMobile && setSelectedIndex(idx)}
            onClick={() => isMobile && setSelectedIndex(idx)}
            style={{
              position: 'relative',
              flex: isActive ? (isMobile ? 'none' : 6) : (isMobile ? 'none' : 1),
              height: isMobile ? (isActive ? '350px' : '80px') : '100%',
              borderRadius: '32px',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'flex 0.7s cubic-bezier(0.25, 1, 0.5, 1), height 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
              backgroundColor: '#000',
              boxShadow: isActive ? '0 15px 35px rgba(216,27,96,0.3)' : '0 4px 10px rgba(0,0,0,0.1)'
            }}
          >
            <img
              src={proj.image}
              alt={proj.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isActive ? 1 : 0.5,
                transition: 'opacity 0.7s ease',
              }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isActive
                  ? 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)'
                  : 'rgba(0,0,0,0.3)',
                transition: 'background 0.7s ease',
              }}
            />

            <div
              style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                padding: '30px',
                color: '#FFF',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s',
                pointerEvents: isActive ? 'auto' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <h3 style={{ fontSize: 'clamp(1.5rem, 2vw, 2rem)', fontWeight: 900, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px' }}>
                {proj.title}
              </h3>
              <p style={{ fontSize: '0.95rem', margin: 0, opacity: 0.9, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                {proj.description}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', background: 'var(--rotaract-pink)', padding: '4px 10px', borderRadius: '4px' }}>
                  {proj.category}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px', backdropFilter: 'blur(4px)' }}>
                  {proj.metric}
                </span>
              </div>
            </div>

            {!isMobile && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '30px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  height: '100%',
                  width: '100%',
                  paddingBottom: '30px',
                  pointerEvents: 'none'
                }}
              >
                <div
                  style={{
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    whiteSpace: 'nowrap',
                    opacity: isActive ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                  }}
                >
                  {proj.title}
                </div>
              </div>
            )}

            {isMobile && !isActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  opacity: 1,
                  transition: 'opacity 0.3s ease',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  pointerEvents: 'none'
                }}
              >
                {proj.title}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PublicHome({ onNavigateDistrict, onNavigatePage, onOpenLoginModal }) {
  const containerRef = useRef(null);
  const isScrolling = useRef(false);
  const currentSectionRef = useRef(0);
  const lastScrollTime = useRef(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isDesktop) return;

    const SCROLL_LOCKOUT_MS = 1250;
    let wheelInertiaTimeout = null;

    const getClosestSectionIndex = () => {
      const sections = Array.from(el.querySelectorAll('.snap-section, .snap-section-footer'));
      const scrollTop = el.scrollTop;
      let closestIndex = 0;
      let minDiff = Infinity;

      sections.forEach((sec, idx) => {
        const diff = Math.abs(sec.offsetTop - scrollTop);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = idx;
        }
      });
      return closestIndex;
    };

    const scrollToSection = (targetIndex) => {
      const sections = Array.from(el.querySelectorAll('.snap-section, .snap-section-footer'));
      if (targetIndex < 0 || targetIndex >= sections.length) return;

      const target = sections[targetIndex];
      if (!target) return;

      currentSectionRef.current = targetIndex;
      isScrolling.current = true;
      lastScrollTime.current = Date.now();

      el.scrollTo({
        top: target.offsetTop,
        behavior: 'smooth'
      });

      setTimeout(() => {
        isScrolling.current = false;
      }, SCROLL_LOCKOUT_MS);
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const now = Date.now();

      clearTimeout(wheelInertiaTimeout);
      wheelInertiaTimeout = setTimeout(() => {
        if (Date.now() - lastScrollTime.current >= SCROLL_LOCKOUT_MS) {
          isScrolling.current = false;
        }
      }, 300);

      if (isScrolling.current || now - lastScrollTime.current < SCROLL_LOCKOUT_MS) {
        return;
      }

      if (Math.abs(e.deltaY) < 8) return;

      const sections = Array.from(el.querySelectorAll('.snap-section, .snap-section-footer'));
      if (sections.length === 0) return;

      const closest = getClosestSectionIndex();
      currentSectionRef.current = closest;

      if (e.deltaY > 0) {
        if (currentSectionRef.current < sections.length - 1) {
          scrollToSection(currentSectionRef.current + 1);
        }
      } else if (e.deltaY < 0) {
        if (currentSectionRef.current > 0) {
          scrollToSection(currentSectionRef.current - 1);
        }
      }
    };

    const handleKeyDown = (e) => {
      const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'];
      if (!keys.includes(e.key)) return;

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      e.preventDefault();
      const now = Date.now();
      if (isScrolling.current || now - lastScrollTime.current < SCROLL_LOCKOUT_MS) return;

      const sections = Array.from(el.querySelectorAll('.snap-section, .snap-section-footer'));
      if (sections.length === 0) return;

      const closest = getClosestSectionIndex();
      currentSectionRef.current = closest;

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        if (currentSectionRef.current < sections.length - 1) {
          scrollToSection(currentSectionRef.current + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        if (currentSectionRef.current > 0) {
          scrollToSection(currentSectionRef.current - 1);
        }
      } else if (e.key === 'Home') {
        scrollToSection(0);
      } else if (e.key === 'End') {
        scrollToSection(sections.length - 1);
      }
    };

    const handleScrollSync = () => {
      if (!isScrolling.current) {
        currentSectionRef.current = getClosestSectionIndex();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('scroll', handleScrollSync, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    return () => {
      clearTimeout(wheelInertiaTimeout);
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('scroll', handleScrollSync);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [contributionAmount, setContributionAmount] = useState(10000);

  const [activeSlice, setActiveSlice] = useState(1);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinZone, setJoinZone] = useState('Zone 2 - South Delhi');
  const [joinInterest, setJoinInterest] = useState('Community Service');
  const [joinSubmitted, setJoinSubmitted] = useState(false);

  const pediatricScreenings = Math.floor(contributionAmount / 500);
  const treesPlanted = Math.floor(contributionAmount / 150);
  const waterLiters = Math.floor(contributionAmount * 1.5);
  const hygieneKits = Math.floor(contributionAmount / 200);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    setJoinSubmitted(true);
    setTimeout(() => {
      setJoinSubmitted(false);
      setIsJoinModalOpen(false);
      setJoinName('');
      setJoinEmail('');
      setJoinPhone('');
    }, 2500);
  };

  return (
    <div ref={containerRef} className="snap-container" style={{ backgroundColor: '#FFFFFF' }}>

      <BigRotaryWheel containerRef={containerRef} />

      <section
        className="snap-section"
        style={{
          background: '#FFFFFF',
          textAlign: 'left',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'hidden',
          /* On mobile the section padding is handled by CSS media query;
             keep desktop padding here */
          padding: '0 4vw'
        }}
      >
        <InteractiveDotGrid />

        <div
          className="section-content-animate"
          style={{
            width: '100%',
            maxWidth: '100%',
            margin: '0',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            textAlign: 'left',
            paddingLeft: 'max(10px, 2vw)'
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 6vw, 6.5rem)',
              fontWeight: 900,
              color: '#1a1a1a',
              lineHeight: 0.95,
              margin: '0 0 16px 0',
              letterSpacing: '-1.5px',
              textTransform: 'uppercase',
              textAlign: 'left',
              whiteSpace: 'pre-line'
            }}
          >
            <TypewriterText
              text={"ROTARACT\nDISTRICT\nORGANISATION"}
              speed={38}
              delay={200}
              showCursor={false}
            />
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 'clamp(5rem, 9vw, 9.5rem)',
                fontWeight: 900,
                color: '#0044ff',
                lineHeight: 0.85,
                letterSpacing: '-3px'
              }}
            >
              <TypewriterText
                text="3011"
                speed={38}
                delay={1000}
                showCursor={false}
              />
            </span>

            <p
              style={{
                fontSize: 'clamp(1rem, 1.5vw, 1.4rem)',
                color: '#0044ff',
                margin: '0',
                lineHeight: 1.3,
                fontWeight: 600,
                textAlign: 'left',
                whiteSpace: 'pre-line'
              }}
            >
              <TypewriterText
                text={"brings together 70+ clubs\nand thousands of young leaders across\nDelhi NCR\nto drive sustainable social change."}
                speed={20}
                delay={1400}
                showCursor={true}
              />
            </p>
          </div>
        </div>
      </section>

      <section className="snap-section" style={{ backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
          <span className="pill-pink" style={{ marginBottom: '6px', fontSize: '0.85rem', padding: '5px 16px', borderRadius: '6px' }}>
            <Layers size={14} /> FLAGSHIP INITIATIVES
          </span>
          <h2 style={{ fontSize: 'clamp(2rem, 3.8vw, 3rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
            District 3011 Flagship Projects
          </h2>
        </div>

        <ExpandingCarousel />
      </section>

      <section className="snap-section" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FDF8FA 100%)', padding: '40px 32px' }}>
        <div className="section-content-animate" style={{ maxWidth: '1320px', width: '100%', position: 'relative', zIndex: 10 }}>

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span className="pill-pink" style={{ marginBottom: '10px', fontSize: '0.92rem', padding: '7px 20px' }}>
              <Calculator size={16} /> DYNAMIC IMPACT CALCULATOR
            </span>
            <h2 style={{ fontSize: 'clamp(2.4rem, 4.2vw, 3.5rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px', marginBottom: '8px' }}>
              See What Your Support Accomplishes
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', maxWidth: '720px', margin: '0 auto' }}>
              Slide the interactive bar or click a preset below to calculate real-world social impact in District 3011.
            </p>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              /* Reduce padding on mobile from 28px/36px to 16px */
              padding: 'clamp(16px, 3vw, 36px)',
              borderRadius: '24px',
              border: '2px solid rgba(216, 27, 96, 0.15)',
              boxShadow: '0 10px 35px rgba(216, 27, 96, 0.06)',
              marginBottom: '28px',
              width: '100%'
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Slide to Adjust Contribution
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FDF0F5', padding: '10px 24px', borderRadius: '8px', border: '2px solid var(--rotaract-pink)', boxShadow: '0 4px 15px rgba(216, 27, 96, 0.12)' }}>
                <span style={{ fontWeight: 900, color: 'var(--rotaract-pink)', fontSize: '1.4rem' }}>₹</span>
                <input
                  type="number"
                  step="500"
                  min="500"
                  max="100000"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(Math.max(0, Number(e.target.value)))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    width: '130px'
                  }}
                />
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
              <input
                type="range"
                min="1000"
                max="50000"
                step="1000"
                value={contributionAmount > 50000 ? 50000 : Math.max(1000, contributionAmount)}
                onChange={(e) => setContributionAmount(Number(e.target.value))}
                className="rotaract-slider-bar"
                style={{
                  width: '100%',
                  height: '12px',
                  borderRadius: '10px',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  background: `linear-gradient(to right, var(--rotaract-pink) 0%, var(--rotaract-pink) ${((Math.min(50000, Math.max(1000, contributionAmount)) - 1000) / (50000 - 1000)) * 100}%, #E4E4E7 ${((Math.min(50000, Math.max(1000, contributionAmount)) - 1000) / (50000 - 1000)) * 100}%, #E4E4E7 100%)`
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>
              <span>₹1,000</span>
              <span>₹10,000</span>
              <span>₹25,000</span>
              <span>₹50,000+</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '6px' }}>Quick Presets:</span>
              {[2500, 5000, 10000, 20000, 50000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setContributionAmount(preset)}
                  style={{
                    background: contributionAmount === preset ? 'var(--rotaract-pink)' : '#FDF0F5',
                    color: contributionAmount === preset ? '#FFFFFF' : 'var(--rotaract-pink)',
                    border: '1.5px solid rgba(216, 27, 96, 0.25)',
                    borderRadius: '6px',
                    padding: '7px 18px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: contributionAmount === preset ? '0 4px 14px rgba(216, 27, 96, 0.3)' : 'none'
                  }}
                >
                  ₹{preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '22px', width: '100%' }}>
            <div className="rotaract-card" style={{ padding: '26px 20px', textAlign: 'center', borderTop: '4px solid var(--rotaract-pink)' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--rotaract-pink)', lineHeight: 1 }}>
                {pediatricScreenings.toLocaleString()}
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                Child Health Screenings
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Free health checkups provided
              </div>
            </div>

            <div className="rotaract-card" style={{ padding: '26px 20px', textAlign: 'center', borderTop: '4px solid var(--skyline-gold)' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--skyline-gold-dark)', lineHeight: 1 }}>
                {treesPlanted.toLocaleString()}
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                Native Trees Planted
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Environmental saplings across NCR
              </div>
            </div>

            <div className="rotaract-card" style={{ padding: '26px 20px', textAlign: 'center', borderTop: '4px solid var(--rotaract-pink)' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--rotaract-pink)', lineHeight: 1 }}>
                {waterLiters.toLocaleString()} L
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                Clean Water Filtered
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Drinking water supply delivered
              </div>
            </div>

            <div className="rotaract-card" style={{ padding: '26px 20px', textAlign: 'center', borderTop: '4px solid var(--skyline-gold)' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--skyline-gold-dark)', lineHeight: 1 }}>
                {hygieneKits.toLocaleString()}
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                Hygiene Dignity Kits
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Sanitary & wellness kits distributed
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="snap-section" style={{ backgroundColor: '#FDF8FA' }}>
        <div className="section-content-animate" style={{ maxWidth: '1280px', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span className="pill-gold" style={{ marginBottom: '12px', fontSize: '0.92rem', padding: '7px 20px' }}>
              DISTRICT IMPACT SNAPSHOT
            </span>
            <h2 style={{ fontSize: 'clamp(2.8rem, 5vw, 3.8rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
              Measurable Change Across Delhi & NCR
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '28px' }}>
            {IMPACT_METRICS.map((metric, idx) => (
              <div key={idx} className="rotaract-card" style={{ padding: '34px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(2.8rem, 4.8vw, 3.8rem)', fontWeight: 900, color: 'var(--rotaract-pink)', marginBottom: '4px' }}>
                  {metric.value}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  {metric.label}
                </div>
                <span className="pill-pink" style={{ fontSize: '0.84rem' }}>
                  {metric.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="snap-section" style={{ backgroundColor: '#FFFFFF', padding: '24px 24px' }}>
        <div className="section-content-animate" style={{ maxWidth: '1280px', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <span className="pill-pink" style={{ marginBottom: '8px', fontSize: '0.85rem', padding: '5px 18px' }}>
              AREAS OF FOCUS
            </span>
            <h2 style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.2rem)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-1px' }}>
              Causes We Support
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '680px', margin: '0 auto' }}>
              Aligned with Rotary International's 7 Causes to address critical community challenges.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {ROTARY_FOCUS_AREAS.map((area) => (
              <div
                key={area.id}
                className="rotaract-card"
                style={{
                  padding: '20px 18px',
                  borderTop: '4px solid var(--rotaract-pink)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'var(--rotaract-pink-light)',
                    color: 'var(--rotaract-pink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {area.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="snap-section-footer" style={{ scrollSnapAlign: 'start', width: '100%', position: 'relative', zIndex: 20, backgroundColor: '#18181B' }}>
        <Footer
          isFullScreen={false}
          onNavigatePage={(page) => {
            if (onNavigatePage) {
              onNavigatePage(page);
            } else if (page === 'district' && onNavigateDistrict) {
              onNavigateDistrict();
            } else if (page === 'home') {
              handleScrollToTop();
            }
          }}
        />
      </div>

      {/* Floating Home Quick-Scroll Navigator (Go to Top & Go to Bottom) */}
      <div
        style={{
          position: 'fixed',
          right: isMobile ? '12px' : '24px',
          bottom: isMobile ? '16px' : '28px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <button
          onClick={handleScrollToTop}
          style={{
            width: isMobile ? '40px' : '46px',
            height: isMobile ? '40px' : '46px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(216, 27, 96, 0.35)',
            color: 'var(--rotaract-pink)',
            boxShadow: '0 8px 24px rgba(216, 27, 96, 0.25)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)';
            e.currentTarget.style.backgroundColor = 'var(--rotaract-pink)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
            e.currentTarget.style.color = 'var(--rotaract-pink)';
          }}
          title="Go to Top of Homepage"
          aria-label="Go to Top"
        >
          <ArrowUp size={isMobile ? 18 : 22} />
        </button>

        <button
          onClick={handleScrollToBottom}
          style={{
            width: isMobile ? '40px' : '46px',
            height: isMobile ? '40px' : '46px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(216, 27, 96, 0.35)',
            color: 'var(--rotaract-pink)',
            boxShadow: '0 8px 24px rgba(216, 27, 96, 0.25)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(3px) scale(1.08)';
            e.currentTarget.style.backgroundColor = 'var(--rotaract-pink)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
            e.currentTarget.style.color = 'var(--rotaract-pink)';
          }}
          title="Go to Bottom of Homepage"
          aria-label="Go to Bottom"
        >
          <ArrowDown size={isMobile ? 18 : 22} />
        </button>
      </div>

      {isJoinModalOpen && (
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
              maxWidth: '520px',
              padding: '32px',
              position: 'relative',
              border: '2px solid var(--rotaract-pink)',
              animation: 'fadeInUp 0.3s ease-out forwards'
            }}
          >
            <button
              onClick={() => setIsJoinModalOpen(false)}
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

            {joinSubmitted ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--rotaract-pink-light)', color: 'var(--rotaract-pink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Thank You for Your Interest!
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Our District Membership Committee and Zone Representative will reach out to you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleJoinSubmit}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <span className="pill-pink" style={{ marginBottom: '8px' }}>
                    JOIN ROTARACT DISTRICT 3011
                  </span>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    Express Your Interest
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    Fill out this form to connect with a Rotaract club in your area.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ananya Sharma"
                      required
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7' }}
                    />
                  </div>

                  {/* Email and Phone: single column on mobile, two columns on desktop */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        placeholder="you@email.com"
                        required
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={joinPhone}
                        onChange={(e) => setJoinPhone(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                      Preferred Zone / Location in NCR *
                    </label>
                    <select
                      value={joinZone}
                      onChange={(e) => setJoinZone(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7' }}
                    >
                      <option value="Zone Prithvi">Zone Prithvi (पृथ्वी) - South & East NCR</option>
                      <option value="Zone Agni">Zone Agni (अग्नि) - Central & Faridabad</option>
                      <option value="Zone Vayu">Zone Vayu (वायु) - North & Gurugram</option>
                      <option value="Zone Akash">Zone Akash (आकाश) - West & University</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '4px' }}>
                      What area interests you most?
                    </label>
                    <select
                      value={joinInterest}
                      onChange={(e) => setJoinInterest(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E4E7' }}
                    >
                      <option value="Community Service">Community Service & Health</option>
                      <option value="Professional Development">Professional & Vocational Development</option>
                      <option value="Youth Leadership">Youth Leadership & Public Speaking</option>
                      <option value="International Exchange">International Fellowship & Exchange</option>
                      <option value="Sports & Culture">Cultural Festivals & Sports</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn-rotaract" style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>
                  <Send size={18} /> Submit Interest Form
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
