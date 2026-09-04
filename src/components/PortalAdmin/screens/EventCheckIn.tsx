import { useState } from 'react';
import { clubs } from '../mockData';
import { Card, PageHeader, Field, inputClass, Button, Badge } from '../ui';

interface CheckIn { memberName: string; clubName: string; at: string }

export default function EventCheckIn() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([
    { memberName: 'Meera Nair', clubName: 'Delhi Rajdhani', at: '09:42 am' },
  ]);
  const [code, setCode] = useState('');

  const submit = () => {
    if (!code.trim()) return;
    const club = clubs[Math.floor(Math.random() * clubs.length)];
    setCheckIns(prev => [{ memberName: `Member (QR ${code.trim()})`, clubName: club.shortName, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setCode('');
  };

  return (
    <div>
      <PageHeader
        title="CLS · 6 September"
        description="Attendance is the heaviest point category in the document, so it has to be captured at the door rather than claimed afterwards."
      />

      <Card className="p-6 mb-5 max-w-[420px]">
        <Field label="Scan or enter member QR code" hint="Feeds the attendance-percentage point brackets directly.">
          <div className="flex gap-2">
            <input className={inputClass} value={code} onChange={e => setCode(e.target.value)} placeholder="QR-XXXXXX" onKeyDown={e => e.key === 'Enter' && submit()} />
            <Button onClick={submit} disabled={!code.trim()}>Check in</Button>
          </div>
        </Field>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase">Checked in ({checkIns.length})</p>
        <Badge tone="pink">Live</Badge>
      </div>
      <Card>
        {checkIns.map((c, i) => (
          <div key={i} className={`p-4 flex items-center justify-between gap-4 ${i < checkIns.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div>
              <p className="text-[13.5px] font-semibold text-text-primary">{c.memberName}</p>
              <p className="text-[11.5px] text-text-muted">{c.clubName}</p>
            </div>
            <span className="text-[12px] text-text-muted">{c.at}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
