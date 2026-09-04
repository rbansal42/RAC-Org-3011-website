import { useState } from 'react';
import { clubMonthScores } from '../mockData';
import { Card, PageHeader, Badge, Button, Field, inputClass } from '../ui';
import type { ClubMonthScore } from '../types';

const statusTone: Record<ClubMonthScore['status'], 'neutral' | 'amber' | 'green' | 'red'> = {
  not_filed: 'neutral', to_score: 'amber', scored: 'green', queried: 'red',
};
const statusLabel: Record<ClubMonthScore['status'], string> = {
  not_filed: 'Not filed', to_score: 'To score', scored: 'Scored', queried: 'Queried',
};

export default function ScoreMonth() {
  const [selectedId, setSelectedId] = useState(clubMonthScores[0].clubId);
  const [scores, setScores] = useState(clubMonthScores);
  const [judgedInput, setJudgedInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  const selected = scores.find(s => s.clubId === selectedId) ?? scores[0];
  const total = selected.computedPoints + (selected.judgedPoints ?? 0);

  const handleScore = () => {
    const points = Number(judgedInput);
    if (Number.isNaN(points) || !reasonInput.trim()) return;
    setScores(prev => prev.map(s => s.clubId === selected.clubId
      ? { ...s, judgedPoints: points, judgedReason: reasonInput.trim(), status: 'scored' }
      : s));
    setJudgedInput('');
    setReasonInput('');
  };

  const handleQuery = () => {
    setScores(prev => prev.map(s => s.clubId === selected.clubId ? { ...s, status: 'queried' } : s));
  };

  return (
    <div>
      <PageHeader
        title={`${selected.clubName} · ${selected.month}`}
        description={`${selected.computedPoints} points computed from the rules. One number is yours to set.`}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {scores.map(s => (
          <button
            key={s.clubId}
            type="button"
            onClick={() => setSelectedId(s.clubId)}
            className={`min-h-[44px] px-3.5 rounded-lg text-[12.5px] font-semibold border transition-colors ${
              s.clubId === selectedId ? 'border-rotaract-pink bg-rotaract-pink-light text-rotaract-pink' : 'border-border-light text-text-secondary hover:bg-bg-subtle'
            }`}
          >
            {s.clubName} <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card className="p-6">
          <p className="text-[11px] font-bold tracking-wide text-text-muted uppercase mb-3">Computed — shown, not edited</p>
          <div className="space-y-2 mb-6">
            {selected.ruleTrace.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border-light last:border-0">
                <div>
                  <p className="text-[13px] font-semibold text-text-primary">{r.label}</p>
                  <p className="text-[11.5px] text-text-muted">{r.category}</p>
                </div>
                <span className="text-[14px] font-bold text-text-primary">+{r.points}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[13px] font-bold text-text-primary">Computed subtotal</span>
              <span className="text-[16px] font-extrabold text-rotaract-pink">{selected.computedPoints}</span>
            </div>
          </div>

          <div className="pt-5 border-t border-border-light">
            <p className="text-[11px] font-bold tracking-wide text-cranberry-dark uppercase mb-3">Judged — the only place a person types</p>
            {selected.judgedPoints !== null ? (
              <div className="bg-rotaract-pink-light/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-semibold text-text-primary">Judged points</span>
                  <span className="text-[14px] font-bold text-rotaract-pink">+{selected.judgedPoints}</span>
                </div>
                <p className="text-[12.5px] text-text-secondary italic">"{selected.judgedReason}"</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Points">
                  <input type="number" className={inputClass} value={judgedInput} onChange={e => setJudgedInput(e.target.value)} placeholder="e.g. 15" />
                </Field>
                <Field label="Reason (required — goes into the audit log with your name)">
                  <textarea className={`${inputClass} min-h-[80px] py-2.5`} value={reasonInput} onChange={e => setReasonInput(e.target.value)} placeholder="Why does this club earn judged points this month?" />
                </Field>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleScore} disabled={!judgedInput || !reasonInput.trim()}>Save score</Button>
                  <Button variant="secondary" onClick={handleQuery}>Query this report</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 h-fit">
          <p className="text-[11px] font-bold tracking-wide text-text-muted uppercase mb-3">Month total</p>
          <p className="text-[40px] font-extrabold text-text-primary leading-none mb-1">{total}</p>
          <p className="text-[12px] text-text-muted mb-5">{selected.computedPoints} computed + {selected.judgedPoints ?? 0} judged</p>
          <Badge tone={statusTone[selected.status]}>{statusLabel[selected.status]}</Badge>
        </Card>
      </div>
    </div>
  );
}
