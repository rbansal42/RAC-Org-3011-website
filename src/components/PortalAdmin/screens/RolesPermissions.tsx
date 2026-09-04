import { useState } from 'react';
import { roles as seedRoles } from '../mockData';
import { Card, PageHeader, Badge, Button, Field, inputClass } from '../ui';
import type { Role } from '../types';

const scopeLabel: Record<Role['scopeType'], string> = {
  none: 'District-wide', club: 'Per club', zone: 'Per zone', project: 'Per project',
};

export default function RolesPermissions() {
  const [roles, setRoles] = useState(seedRoles);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const addRole = () => {
    if (!newName.trim()) return;
    setRoles(prev => [...prev, { id: `r${prev.length + 1}`, name: newName.trim(), isSystem: false, scopeType: 'none', permissions: [], holderCount: 0 }]);
    setNewName('');
    setCreating(false);
  };

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        description="Six roles seeded, and you can add more. A person can hold several at once — most ZRRs are also a club president."
      />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreating(v => !v)}>New role</Button>
      </div>

      {creating && (
        <Card className="p-4 mb-4 flex items-end gap-3 flex-wrap">
          <Field label="Role name">
            <input className={`${inputClass} w-56`} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Zone Coordinator" />
          </Field>
          <Button onClick={addRole}>Create</Button>
          <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
        </Card>
      )}

      <Card>
        {roles.map((role, i) => (
          <div key={role.id} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${i < roles.length - 1 ? 'border-b border-border-light' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[13.5px] font-bold text-text-primary">{role.name}</span>
              {role.isSystem && <Badge>System</Badge>}
              <Badge tone="pink">{scopeLabel[role.scopeType]}</Badge>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-[12px] text-text-muted">{role.holderCount} {role.holderCount === 1 ? 'person' : 'people'}</span>
              <span className="text-[12px] text-text-muted max-w-[220px] truncate">{role.permissions.includes('*') ? 'All permissions' : role.permissions.join(', ')}</span>
              <Button variant="secondary">Edit</Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
