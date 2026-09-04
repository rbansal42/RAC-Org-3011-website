import { useState } from 'react';
import { districtSettings, clubs } from '../mockData';
import { Card, PageHeader, Field, inputClass, Toggle, Badge } from '../ui';

const SUBDOMAIN_LABELS: Record<string, string> = {
  mission3011: 'Mission 3011', drishti: 'Project Drishti', rcl: 'Rotaract Cricket League',
  careerbridge: 'Career Bridge', ride: 'RIDE',
};

export default function DistrictSettings() {
  const [settings, setSettings] = useState(districtSettings);

  const toggleSubdomain = (key: string) => setSettings(prev => ({
    ...prev,
    activeSubdomains: {
      ...prev.activeSubdomains,
      [key]: { ...prev.activeSubdomains[key as keyof typeof prev.activeSubdomains], active: !prev.activeSubdomains[key as keyof typeof prev.activeSubdomains].active },
    },
  }));

  return (
    <div>
      <PageHeader title="District settings" description="The handful of switches that change what the public site shows. Everything here is a value, not a deploy." />

      <div className="space-y-6 max-w-[640px]">
        <div>
          <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase mb-2.5">Project subdomains</p>
          <Card>
            {Object.entries(settings.activeSubdomains).map(([key, val], i, arr) => (
              <div key={key} className={`p-4 flex items-center justify-between gap-4 flex-wrap ${i < arr.length - 1 ? 'border-b border-border-light' : ''}`}>
                <div>
                  <p className="text-[13.5px] font-semibold text-text-primary">{SUBDOMAIN_LABELS[key]}</p>
                  <p className="text-[11.5px] text-text-muted">{val.leadClub ? `Lead club: ${val.leadClub}` : 'Open for bidding — unassigned'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {!val.active && <Badge tone="amber">Unassigned state</Badge>}
                  <Toggle checked={val.active} onChange={() => toggleSubdomain(key)} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase mb-2.5">DRR availability</p>
          <Card className="p-4 space-y-3">
            <Field label="Working days">
              <div className="flex gap-2 flex-wrap">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <Badge key={d} tone={settings.drrAvailability.workingDays.includes(d) ? 'pink' : 'neutral'}>{d}</Badge>
                ))}
              </div>
            </Field>
            <Field label="Buffer between slots (minutes)">
              <input type="number" className={`${inputClass} w-32`} defaultValue={settings.drrAvailability.bufferMinutes} />
            </Field>
          </Card>
        </div>

        <div>
          <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase mb-2.5">Compliance</p>
          <Card className="p-4">
            <Field label="Flag a club as behind after this many missed months" hint={`${clubs.length} clubs tracked district-wide`}>
              <input type="number" className={`${inputClass} w-32`} defaultValue={settings.complianceThresholdMonths} />
            </Field>
          </Card>
        </div>
      </div>
    </div>
  );
}
