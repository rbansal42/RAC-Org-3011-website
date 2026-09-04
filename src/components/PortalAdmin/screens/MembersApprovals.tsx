import { useState } from 'react';
import { members as seedMembers } from '../mockData';
import { Card, PageHeader, Badge, Button } from '../ui';

export default function MembersApprovals() {
  const [members, setMembers] = useState(seedMembers);
  const pending = members.filter(m => m.status === 'pending');
  const approved = members.filter(m => m.status === 'approved');

  const approve = (id: string) => setMembers(prev => prev.map(m => m.id === id ? { ...m, status: 'approved' } : m));
  const reject = (id: string) => setMembers(prev => prev.filter(m => m.id !== id));

  return (
    <div>
      <PageHeader
        title="Members"
        description={`${members.length} on the roster, ${pending.length} waiting for you. Any member can submit a project to the showcase, so an account is worth approving quickly.`}
      />

      {pending.length > 0 && (
        <div className="mb-6">
          <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase mb-2.5">Waiting for approval</p>
          <Card>
            {pending.map((m, i) => (
              <div key={m.id} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${i < pending.length - 1 ? 'border-b border-border-light' : ''}`}>
                <div>
                  <p className="text-[13.5px] font-semibold text-text-primary">{m.fullName}</p>
                  <p className="text-[11.5px] text-text-muted">{m.clubName} · {m.email}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => approve(m.id)}>Approve</Button>
                  <Button variant="danger" onClick={() => reject(m.id)}>Reject</Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase mb-2.5">Approved ({approved.length})</p>
      <Card>
        {approved.map((m, i) => (
          <div key={m.id} className={`p-4 flex items-center justify-between gap-4 ${i < approved.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div>
              <p className="text-[13.5px] font-semibold text-text-primary">{m.fullName}</p>
              <p className="text-[11.5px] text-text-muted">{m.clubName}</p>
            </div>
            <Badge tone="green">Active</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
