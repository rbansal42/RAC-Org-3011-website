import type { ReactNode } from 'react';

export function PageHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-8 max-w-[640px]">
      <h1 className="text-[27px] font-extrabold tracking-[-0.5px] text-text-primary mb-1.5 leading-tight">{title}</h1>
      {description && <p className="text-[13.5px] leading-relaxed text-text-secondary">{description}</p>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-border-light rounded-2xl shadow-[0_4px_15px_rgba(216,27,96,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled = false, className = '',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const styles = {
    primary: 'bg-rotaract-pink text-white hover:bg-rotaract-pink-hover',
    secondary: 'bg-white text-text-primary border border-border-light hover:bg-bg-subtle',
    ghost: 'bg-transparent text-text-secondary hover:bg-bg-subtle',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] inline-flex items-center justify-center px-4 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'pink' | 'green' | 'amber' | 'red' }) {
  const styles = {
    neutral: 'bg-bg-subtle text-text-muted',
    pink: 'bg-rotaract-pink-light text-rotaract-pink',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${styles}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text-primary">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'min-h-[44px] w-full rounded-lg border border-border-light px-3 text-[13.5px] text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-rotaract-pink/30 focus:border-rotaract-pink';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-rotaract-pink' : 'bg-border-light'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-[13px] text-text-primary">{label}</span>}
    </label>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="text-[14px] font-bold text-text-primary mb-1">{title}</p>
      {body && <p className="text-[12.5px] text-text-muted max-w-[360px] mx-auto">{body}</p>}
    </div>
  );
}
