// Shared types for the Portal Admin surface (spec: docs/superpowers/specs/2026-09-04-website-master-spec.md §6)

export type RuleType = 'flat' | 'per_unit' | 'tiered' | 'penalty';
export type RulePeriod = 'monthly' | 'yearly' | 'once';
export type PointCategory =
  | 'Community Services'
  | 'Vocational Services / Professional Development'
  | 'International Services'
  | 'Club Services'
  | 'Flagship Projects'
  | 'Club & District'
  | 'Reporting to District'
  | 'DRR Official Visit'
  | 'Membership Growth & Retention'
  | 'Rotary International'
  | 'Public Image'
  | 'District Dues'
  | 'MDIOs Presence';

export interface PointRuleTier {
  min: number;
  max: number | null;
  points: number;
}

export interface PointRule {
  id: string;
  category: PointCategory;
  label: string;
  ruleType: RuleType;
  period: RulePeriod;
  source: string; // "report_field:<key>" | "club_fact:<key>"
  points: number | null; // null when ruleType === 'tiered'
  tiers: PointRuleTier[];
}

export interface ClubFact {
  key: string;
  label: string;
  value: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  scopeType: 'none' | 'club' | 'zone' | 'project';
  permissions: string[];
  holderCount: number;
}

export interface ClubMonthScore {
  clubId: string;
  clubName: string;
  month: string;
  computedPoints: number;
  judgedPoints: number | null;
  judgedReason: string;
  status: 'not_filed' | 'to_score' | 'scored' | 'queried';
  ruleTrace: { category: PointCategory; label: string; points: number }[];
}

export interface Member {
  id: string;
  fullName: string;
  clubId: string;
  clubName: string;
  email: string;
  status: 'pending' | 'approved';
  skills: string[];
  interests: string[];
  hoursLogged: number;
  eventsAttended: number;
  memberSince: string;
}

export interface EffortLogEntry {
  id: string;
  personName: string;
  clubName: string;
  taskDescription: string;
  hours: number;
  date: string;
  loggedBy: string;
  pointsAwarded: number | null;
}

export interface FeedbackItem {
  id: string;
  submittedBy: string;
  clubName: string;
  category: string;
  message: string;
  eventName: string | null;
  status: 'open' | 'reviewed' | 'closed';
  reply: string | null;
  submittedAt: string;
}
