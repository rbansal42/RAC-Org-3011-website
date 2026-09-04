import { useState } from 'react';
import { effortLog as seed } from '../mockData';
import { Card, PageHeader, Field, inputClass, Button, Badge } from '../ui';

export default function EffortLog() {
  const [entries, setEntries] = useState(seed);
  const [form, setForm] = useState({ personName: '', clubName: '', taskDescription: '', hours: '' });
  const [awarding, setAwarding] = useState<string | null>(null);
  const [pointsDraft, setPointsDraft] = useState('');

  const addEntry = () => {
    if (!form.personName.trim() || !form.taskDescription.trim()) return;
    setEntries(prev => [{
      id: `e${prev.length + 1}`, personName: form.personName, clubName: form.clubName,
      taskDescription: form.taskDescription, hours: Number(form.hours) || 0,
      date: new Date().toISOString().slice(0, 10), loggedBy: 'You', pointsAwarded: null,
    }, ...prev]);
    setForm({ personName: '', clubName: '', taskDescription: '', hours: '' });
  };

  const awardPoints = (id: string) => {
    const points = Number(pointsDraft);
    if (Number.isNaN(points)) return;
    setEntries(prev => prev.map(e => e.id === id ? { ...e, pointsAwarded: points } : e));
    setAwarding(null);
    setPointsDraft('');
  };

  return (
    <div>
      <PageHeader
        title="Effort log"
        description="People who helped outside a formal project. Internal only — this replaces a spreadsheet, not a public page."
      />

      <Card className="p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Person"><input className={inputClass} value={form.personName} onChange={e => setForm(f => ({ ...f, personName: e.target.value }))} /></Field>
        <Field label="Club"><input className={inputClass} value={form.clubName} onChange={e => setForm(f => ({ ...f, clubName: e.target.value }))} /></Field>
        <Field label="What did they do"><input className={inputClass} value={form.taskDescription} onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))} /></Field>
        <Field label="Hours"><input type="number" className={inputClass} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></Field>
        <div className="sm:col-span-2"><Button onClick={addEntry}>Log it</Button></div>
      </Card>

      <Card>
        {entries.map((e, i) => (
          <div key={e.id} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${i < entries.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div>
              <p className="text-[13.5px] font-semibold text-text-primary">{e.personName} · {e.clubName}</p>
              <p className="text-[11.5px] text-text-muted">{e.taskDescription} — {e.hours}h, {e.date}</p>
            </div>
            {e.pointsAwarded !== null ? (
              <Badge tone="green">+{e.pointsAwarded} pts (discretionary)</Badge>
            ) : awarding === e.id ? (
              <div className="flex items-center gap-2">
                <input className={`${inputClass} w-20`} value={pointsDraft} onChange={ev => setPointsDraft(ev.target.value)} autoFocus />
                <Button onClick={() => awardPoints(e.id)}>Save</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setAwarding(e.id)}>Award points</Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
