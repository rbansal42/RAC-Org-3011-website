import { useMemo, useState } from 'react';
import { clubs, roles, members } from '../mockData';
import { Card, PageHeader, Field, inputClass, Button } from '../ui';

const ZONES = Array.from(new Set(clubs.map(c => c.zone)));

export default function AudienceBuilder() {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  const toggleRole = (name: string) => setSelectedRoles(prev => prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]);
  const toggleClub = (id: string) => setSelectedClubs(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const estimatedCount = useMemo(() => {
    if (selectedClubs.length > 0) return selectedClubs.length * 2 + 1;
    const roleTotal = selectedRoles.reduce((sum, name) => sum + (roles.find(r => r.name === name)?.holderCount ?? 0), 0);
    const zoneClubs = selectedZone ? clubs.filter(c => c.zone === selectedZone).length : clubs.length;
    return roleTotal || (selectedZone ? zoneClubs * 2 : members.length);
  }, [selectedRoles, selectedZone, selectedClubs]);

  return (
    <div>
      <PageHeader title="Who should get this?" description="Build the audience from roles, zones and clubs. The count updates as you narrow it." />

      <Card className="p-6 space-y-5 max-w-[640px]">
        <Field label="Roles">
          <div className="flex gap-2 flex-wrap">
            {roles.map(r => (
              <button key={r.id} type="button" onClick={() => toggleRole(r.name)}
                className={`min-h-[44px] px-3 rounded-lg text-[12.5px] font-semibold border ${selectedRoles.includes(r.name) ? 'border-rotaract-pink bg-rotaract-pink-light text-rotaract-pink' : 'border-border-light text-text-secondary'}`}>
                {r.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Zone">
          <select className={inputClass} value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
            <option value="">All zones</option>
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </Field>

        <Field label="Or pick specific clubs (replaces the zone filter)">
          <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
            {clubs.slice(0, 12).map(c => (
              <button key={c.id} type="button" onClick={() => toggleClub(c.id)}
                className={`min-h-[36px] px-2.5 rounded-md text-[11.5px] font-medium border ${selectedClubs.includes(c.id) ? 'border-rotaract-pink bg-rotaract-pink-light text-rotaract-pink' : 'border-border-light text-text-secondary'}`}>
                {c.shortName}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Message"><textarea className={`${inputClass} min-h-[100px] py-2.5`} value={message} onChange={e => setMessage(e.target.value)} /></Field>

        <label className="flex items-center gap-2 min-h-[44px]">
          <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="w-4 h-4" />
          <span className="text-[13px] text-text-primary">Also send by email</span>
        </label>

        <div className="flex items-center justify-between pt-2 border-t border-border-light">
          <span className="text-[13px] font-bold text-text-primary">~{estimatedCount} recipients</span>
          <Button disabled={!message.trim()}>Send</Button>
        </div>
      </Card>
    </div>
  );
}
