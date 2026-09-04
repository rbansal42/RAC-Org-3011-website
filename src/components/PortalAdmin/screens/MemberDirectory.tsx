import { useMemo, useState } from 'react';
import { members } from '../mockData';
import { Card, PageHeader, Badge, inputClass, EmptyState } from '../ui';

export default function MemberDirectory() {
  const [query, setQuery] = useState('');
  const approved = members.filter(m => m.status === 'approved');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return approved;
    return approved.filter(m =>
      m.fullName.toLowerCase().includes(q) ||
      m.clubName.toLowerCase().includes(q) ||
      m.skills.some(s => s.toLowerCase().includes(q)) ||
      m.interests.some(s => s.toLowerCase().includes(q))
    );
  }, [query, approved]);

  return (
    <div>
      <PageHeader
        title="District directory"
        description="312 members across 75 clubs, searchable by what they can do. Useful when a project needs a videographer and nobody knows one."
      />

      <input
        className={`${inputClass} max-w-md mb-6`}
        placeholder="Search by name, club, skill or interest…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {results.length === 0 ? (
        <EmptyState title="No matches" body="Try a different skill, interest, or club name." />
      ) : (
        <Card>
          {results.map((m, i) => (
            <div key={m.id} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${i < results.length - 1 ? 'border-b border-border-light' : ''}`}>
              <div>
                <p className="text-[13.5px] font-semibold text-text-primary">{m.fullName}</p>
                <p className="text-[11.5px] text-text-muted">{m.clubName}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {[...m.skills, ...m.interests].map(tag => <Badge key={tag}>{tag}</Badge>)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
