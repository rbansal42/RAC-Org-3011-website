import { useState, type ReactNode } from 'react';
import districtLogo from '../../../20260803_134104_0000.jpg';

export type AdminScreenKey =
  | 'score-month' | 'point-rules' | 'club-facts' | 'report-form' | 'ad-hoc'
  | 'content' | 'roles' | 'events' | 'check-in' | 'members' | 'directory'
  | 'effort-log' | 'audience' | 'settings' | 'feedback';

const NAV: { section: string; items: { key: AdminScreenKey; label: string }[] }[] = [
  { section: 'Reporting & scoring', items: [
    { key: 'score-month', label: 'Score a month' },
    { key: 'point-rules', label: 'Point rules' },
    { key: 'club-facts', label: 'Club facts' },
    { key: 'report-form', label: 'Report form builder' },
    { key: 'ad-hoc', label: 'Ad-hoc request' },
  ] },
  { section: 'Site', items: [
    { key: 'content', label: 'Content' },
    { key: 'audience', label: 'Audience builder' },
    { key: 'settings', label: 'District settings' },
  ] },
  { section: 'People', items: [
    { key: 'roles', label: 'Roles & permissions' },
    { key: 'members', label: 'Members & approvals' },
    { key: 'directory', label: 'Member directory' },
    { key: 'effort-log', label: 'Effort log' },
    { key: 'feedback', label: 'Feedback' },
  ] },
  { section: 'Events', items: [
    { key: 'events', label: 'Club event tracker' },
    { key: 'check-in', label: 'Event check-in' },
  ] },
];

interface Props {
  active: AdminScreenKey;
  onNavigate: (key: AdminScreenKey) => void;
  children: ReactNode;
}

export default function PortalAdminLayout({ active, onNavigate, children }: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-subtle font-sans flex">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#18181B] flex flex-col transition-transform lg:translate-x-0 lg:static ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-[58px] px-5 flex items-center gap-2.5 border-b border-white/10 shrink-0">
          <img src={districtLogo} alt="Rotaract District 3011" className="h-[26px] w-auto" />
          <span className="text-white text-[13px] font-bold tracking-wide">PORTAL ADMIN</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV.map(section => (
            <div key={section.section}>
              <p className="px-2 mb-1.5 text-[10px] font-bold tracking-[0.08em] text-white/40 uppercase">{section.section}</p>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { onNavigate(item.key); setMobileNavOpen(false); }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors min-h-[44px] flex items-center ${
                      active === item.key
                        ? 'bg-rotaract-pink text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="lg:hidden h-14 bg-white border-b border-border-light flex items-center px-4 gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-bg-subtle"
            aria-label="Open navigation"
          >
            <span className="block w-5 h-0.5 bg-text-primary relative before:content-[''] before:absolute before:w-5 before:h-0.5 before:bg-text-primary before:-top-1.5 after:content-[''] after:absolute after:w-5 after:h-0.5 after:bg-text-primary after:top-1.5" />
          </button>
          <span className="text-[13px] font-bold text-text-primary">Portal Admin</span>
        </div>
        <main className="p-5 sm:p-7 lg:p-10 max-w-[1100px]">{children}</main>
      </div>
    </div>
  );
}
