import { useState } from 'react';
import { clubs, clubFactsFor } from '../mockData';
import { Card, PageHeader, Field, inputClass, Button } from '../ui';

export default function ClubFacts() {
  const [clubId, setClubId] = useState(clubs[0].id);
  const club = clubs.find(c => c.id === clubId) ?? clubs[0];
  const facts = clubFactsFor(club.shortName);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div>
      <PageHeader
        title={`Club facts · ${club.shortName}`}
        description="A dozen slow-changing values the district holds, not the club. They drive points quietly, so they live on one screen with dates attached."
      />

      <Field label="Club">
        <select className={`${inputClass} max-w-sm mb-6`} value={clubId} onChange={e => { setClubId(e.target.value); setEditingKey(null); }}>
          {clubs.map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
        </select>
      </Field>

      <Card>
        {facts.map((fact, i) => (
          <div key={fact.key} className={`p-4 flex items-center justify-between gap-4 ${i < facts.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-text-primary">{fact.label}</p>
              <p className="text-[11.5px] text-text-muted">{fact.updatedAt !== '—' ? `Updated ${fact.updatedAt} by ${fact.updatedBy}` : 'Never updated'}</p>
            </div>
            {editingKey === fact.key ? (
              <div className="flex items-center gap-2 shrink-0">
                <input className={`${inputClass} w-40`} value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
                <Button onClick={() => setEditingKey(null)}>Save</Button>
                <Button variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditingKey(fact.key); setDraft(fact.value); }}
                className="min-h-[44px] px-3 rounded-lg text-[13.5px] font-bold text-text-primary hover:bg-bg-subtle shrink-0"
              >
                {fact.value}
              </button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
