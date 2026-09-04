import { useState } from 'react';
import { Card, PageHeader, Field, inputClass, Button, Badge } from '../ui';

const AREAS = [
  { key: 'home-hero', label: 'Home — hero text', type: 'text' },
  { key: 'home-carousel', label: 'Home — carousel photos', type: 'link-list' },
  { key: 'showcase-featured', label: 'Showcase — featured projects', type: 'list' },
  { key: 'newsletter', label: 'Monthly newsletter (PDF)', type: 'link' },
  { key: 'announcements', label: 'Announcements', type: 'list' },
  { key: 'partners', label: 'Partner logos', type: 'link-list' },
  { key: 'footer', label: 'Footer text', type: 'text' },
] as const;

export default function ContentEditor() {
  const [activeKey, setActiveKey] = useState<typeof AREAS[number]['key']>('home-hero');
  const active = AREAS.find(a => a.key === activeKey)!;
  const [link, setLink] = useState('');
  const [linkStatus, setLinkStatus] = useState<'idle' | 'checking' | 'ok' | 'broken'>('idle');

  const checkLink = () => {
    setLinkStatus('checking');
    setTimeout(() => setLinkStatus(link.includes('drive.google.com') || link.includes('photos.google.com') ? 'ok' : 'broken'), 600);
  };

  return (
    <div>
      <PageHeader
        title="Content"
        description="Publish rights only. You can change what the public sees and nothing else — no club data, no reports, no accounts."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <div className="space-y-1">
          {AREAS.map(a => (
            <button
              key={a.key}
              type="button"
              onClick={() => { setActiveKey(a.key); setLinkStatus('idle'); setLink(''); }}
              className={`w-full text-left min-h-[44px] px-3 rounded-lg text-[13px] font-medium ${
                a.key === activeKey ? 'bg-rotaract-pink-light text-rotaract-pink' : 'text-text-secondary hover:bg-bg-subtle'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <Card className="p-6">
          {active.type === 'text' && (
            <Field label={active.label}><textarea className={`${inputClass} min-h-[120px] py-2.5`} /></Field>
          )}
          {(active.type === 'link' || active.type === 'link-list') && (
            <div className="space-y-3">
              <Field label="Paste a shareable link (Google Drive/Photos) — no file storage of our own" hint="Every asset field works this way. We check access and can flag it if it later breaks.">
                <div className="flex gap-2">
                  <input className={inputClass} value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/..." />
                  <Button onClick={checkLink} disabled={!link}>Check</Button>
                </div>
              </Field>
              {linkStatus === 'checking' && <Badge>Checking access…</Badge>}
              {linkStatus === 'ok' && <Badge tone="green">Accessible</Badge>}
              {linkStatus === 'broken' && <Badge tone="red">Not accessible — check sharing permissions</Badge>}
            </div>
          )}
          {active.type === 'list' && (
            <p className="text-[12.5px] text-text-muted">List editor for {active.label.toLowerCase()} — add, reorder, and remove entries.</p>
          )}
          <div className="pt-5 mt-5 border-t border-border-light">
            <Button>Publish</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
