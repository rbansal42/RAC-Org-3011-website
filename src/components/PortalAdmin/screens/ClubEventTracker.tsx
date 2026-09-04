import { useState } from 'react';
import { Card, PageHeader, Field, inputClass, Button, Badge } from '../ui';

interface LoggedEvent { id: string; title: string; date: string; type: string; hasPhoto: boolean }

const seed: LoggedEvent[] = [
  { id: 'ev1', title: 'Monthly club meeting', date: '2026-08-04', type: 'Club meeting', hasPhoto: true },
  { id: 'ev2', title: 'Zone fellowship', date: '2026-08-11', type: 'Fellowship', hasPhoto: true },
  { id: 'ev3', title: 'Blood donation camp', date: '2026-08-22', type: 'Community service', hasPhoto: false },
];

export default function ClubEventTracker() {
  const [events, setEvents] = useState(seed);
  const [title, setTitle] = useState('');

  const addEvent = () => {
    if (!title.trim()) return;
    setEvents(prev => [{ id: `ev${prev.length + 1}`, title: title.trim(), date: new Date().toISOString().slice(0, 10), type: 'Community service', hasPhoto: false }, ...prev]);
    setTitle('');
  };

  return (
    <div>
      <PageHeader
        title="Our events"
        description="Everything the club has on. Anything logged here arrives pre-filled in the monthly report, so nothing has to be remembered twice."
      />

      <Card className="p-4 mb-5 flex items-end gap-3 flex-wrap">
        <Field label="Log something that just happened">
          <input className={`${inputClass} w-64`} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fresher's induction drive" />
        </Field>
        <Button onClick={addEvent}>Log it</Button>
      </Card>

      <Card>
        {events.map((e, i) => (
          <div key={e.id} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${i < events.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div>
              <p className="text-[13.5px] font-semibold text-text-primary">{e.title}</p>
              <p className="text-[11.5px] text-text-muted">{e.date} · {e.type}</p>
            </div>
            {e.hasPhoto ? <Badge tone="green">Photo attached</Badge> : <Badge tone="amber">Needs a photo</Badge>}
          </div>
        ))}
      </Card>
    </div>
  );
}
