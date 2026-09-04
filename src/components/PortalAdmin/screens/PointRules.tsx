import { useState } from 'react';
import { pointRules } from '../mockData';
import { Card, PageHeader, Badge, Button } from '../ui';
import type { PointRule } from '../types';

const ruleTypeTone: Record<PointRule['ruleType'], 'pink' | 'neutral' | 'amber' | 'red'> = {
  flat: 'pink', per_unit: 'neutral', tiered: 'amber', penalty: 'red',
};
const periodLabel: Record<PointRule['period'], string> = { monthly: 'Monthly', yearly: 'Yearly', once: 'One-time' };

const CATEGORIES = Array.from(new Set(pointRules.map(r => r.category)));

export default function PointRules() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Point rules"
        description="Thirteen categories from the RID 3011 points document, RY 2026–27. Editing a rule changes future months only — past scores keep the rule that produced them."
      />

      <div className="space-y-6">
        {CATEGORIES.map(category => (
          <div key={category}>
            <p className="text-[12px] font-bold tracking-wide text-text-muted uppercase mb-2.5">{category}</p>
            <Card>
              {pointRules.filter(r => r.category === category).map((rule, i, arr) => (
                <div key={rule.id} className={i < arr.length - 1 ? 'border-b border-border-light' : ''}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === rule.id ? null : rule.id)}
                    className="w-full flex items-center justify-between gap-4 p-4 text-left min-h-[44px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge tone={ruleTypeTone[rule.ruleType]}>{rule.ruleType}</Badge>
                      <span className="text-[13.5px] font-semibold text-text-primary truncate">{rule.label}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11.5px] text-text-muted">{periodLabel[rule.period]}</span>
                      <span className="text-[14px] font-bold text-text-primary">
                        {rule.ruleType === 'tiered' ? `${rule.tiers.length} tiers` : `${rule.points! > 0 ? '+' : ''}${rule.points}`}
                      </span>
                    </div>
                  </button>
                  {expanded === rule.id && (
                    <div className="px-4 pb-4 pt-1">
                      <p className="text-[11.5px] text-text-muted mb-3">
                        Source: <code className="text-cranberry-dark">{rule.source}</code>
                      </p>
                      {rule.ruleType === 'tiered' ? (
                        <div className="space-y-1.5">
                          {rule.tiers.map((t, ti) => (
                            <div key={ti} className="flex items-center justify-between text-[12.5px] bg-bg-subtle rounded-lg px-3 py-2">
                              <span className="text-text-secondary">{t.min}% – {t.max ?? '100+'}%</span>
                              <span className={`font-bold ${t.points < 0 ? 'text-red-600' : 'text-text-primary'}`}>{t.points > 0 ? '+' : ''}{t.points}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button variant="secondary">Edit points value</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
