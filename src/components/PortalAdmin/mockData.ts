// Mock data grounded in the real club dataset; no backend exists yet, so
// every Portal Admin screen reads/writes local state only.
import { INITIAL_CLUBS } from '../../data/districtData';
import type {
  PointRule, ClubFact, Role, ClubMonthScore, Member, EffortLogEntry, FeedbackItem,
} from './types';

export const clubs = INITIAL_CLUBS as Array<{ id: string; name: string; shortName: string; zone: string; president: string }>;

const findClub = (shortName: string) => clubs.find(c => c.shortName === shortName) ?? clubs[0];

// One representative rule per category (not the full ~60-row document).
export const pointRules: PointRule[] = [
  { id: 'pr1', category: 'Community Services', label: 'Rotaract initiated (by your club)', ruleType: 'flat', period: 'monthly', source: 'report_field:activity_type', points: 20, tiers: [] },
  { id: 'pr2', category: 'Community Services', label: 'Organising an associated camp (health/polio/blood)', ruleType: 'per_unit', period: 'monthly', source: 'report_field:camps_organised', points: 30, tiers: [] },
  { id: 'pr3', category: 'Club Services', label: 'Holding physical club meeting', ruleType: 'per_unit', period: 'monthly', source: 'report_field:physical_meetings', points: 20, tiers: [] },
  { id: 'pr4', category: 'Club & District', label: 'Attendance at district events', ruleType: 'tiered', period: 'monthly', source: 'ratio:event_checkins/club_member_count', points: null, tiers: [
    { min: 0, max: 25, points: 10 }, { min: 25, max: 50, points: 20 }, { min: 50, max: 75, points: 30 }, { min: 75, max: null, points: 50 },
  ] },
  { id: 'pr5', category: 'Reporting to District', label: 'Reporting within the given timeline', ruleType: 'flat', period: 'monthly', source: 'club_fact:report_filed_on_time', points: 20, tiers: [] },
  { id: 'pr6', category: 'Membership Growth & Retention', label: 'Membership retention', ruleType: 'tiered', period: 'yearly', source: 'ratio:retained_members/prior_year_members', points: null, tiers: [
    { min: 50, max: 75, points: 20 }, { min: 75, max: 100, points: 30 }, { min: 100, max: null, points: 70 },
  ] },
  { id: 'pr7', category: 'District Dues', label: 'District dues paid', ruleType: 'tiered', period: 'yearly', source: 'club_fact:dues_paid_date', points: null, tiers: [
    { min: 0, max: 1, points: 50 }, { min: 1, max: 2, points: 30 }, { min: 2, max: null, points: -500 },
  ] },
  { id: 'pr8', category: 'Rotary International', label: 'Encouraging members to become Paul Harris Fellow', ruleType: 'per_unit', period: 'yearly', source: 'club_fact:paul_harris_fellow_count', points: 250, tiers: [] },
  { id: 'pr9', category: 'International Services', label: 'RIDE — hosting a district', ruleType: 'per_unit', period: 'once', source: 'club_fact:ride_hosting_days', points: 40, tiers: [] },
  { id: 'pr10', category: 'Public Image', label: 'Active social presence of club', ruleType: 'per_unit', period: 'monthly', source: 'club_fact:active_social_handles', points: 10, tiers: [] },
  { id: 'pr11', category: 'DRR Official Visit', label: 'Holding DRR official visit', ruleType: 'flat', period: 'once', source: 'club_fact:drr_visit_completed', points: 40, tiers: [] },
  { id: 'pr12', category: 'Flagship Projects', label: 'Continued flagship project (one-day, physical)', ruleType: 'flat', period: 'monthly', source: 'report_field:flagship_continued', points: 50, tiers: [] },
  { id: 'pr13', category: 'MDIOs Presence', label: 'Presence at RSA/SEARIC/Rotaract India MDIO events', ruleType: 'per_unit', period: 'yearly', source: 'club_fact:mdio_events_attended', points: 100, tiers: [] },
];

// District-tracked club_facts, not self-reported by the club.
export const clubFactsFor = (_clubShortName: string): ClubFact[] => [
  { key: 'dues_paid_date', label: 'District dues paid', value: '2026-10-18', updatedAt: '2026-10-18', updatedBy: 'Sarthak Bansal' },
  { key: 'ri_citation_completed', label: 'RI Citation completed', value: 'No', updatedAt: '—', updatedBy: '—' },
  { key: 'paul_harris_fellow_count', label: 'Paul Harris Fellows', value: '2', updatedAt: '2026-08-30', updatedBy: 'Sarthak Bansal' },
  { key: 'dual_membership_count', label: 'Dual memberships', value: '1', updatedAt: '2026-08-30', updatedBy: 'Sarthak Bansal' },
  { key: 'mdio_committee_membership', label: 'MDIO committee seats', value: '0', updatedAt: '—', updatedBy: '—' },
  { key: 'sister_club_signed_date', label: 'Sister-club agreement signed', value: 'Not signed', updatedAt: '—', updatedBy: '—' },
  { key: 'active_social_handles', label: 'Active social media handles', value: '3', updatedAt: '2026-08-15', updatedBy: 'Shefali' },
  { key: 'drr_visit_completed', label: 'DRR official visit held', value: 'Yes — 12 Aug', updatedAt: '2026-08-12', updatedBy: 'Archit Bhatia' },
  { key: 'mdio_events_attended', label: 'MDIO events attended', value: '1', updatedAt: '2026-08-01', updatedBy: 'Sarthak Bansal' },
  { key: 'ride_hosting_days', label: 'RIDE hosting days', value: '0', updatedAt: '—', updatedBy: '—' },
  { key: 'club_merchandise', label: 'Club merchandise', value: 'Yes', updatedAt: '2026-07-20', updatedBy: 'Shefali' },
  { key: 'report_filed_on_time', label: 'Filed on time (this month)', value: 'Yes', updatedAt: '2026-09-01', updatedBy: 'system' },
];

// Seed roles, plus the Editing Team role decided in the design session.
export const roles: Role[] = [
  { id: 'r1', name: 'Member', isSystem: true, scopeType: 'club', permissions: ['profile:edit', 'showcase:submit', 'directory:view'], holderCount: 267 },
  { id: 'r2', name: 'President', isSystem: true, scopeType: 'club', permissions: ['reports:submit', 'members:approve', 'showcase:submit'], holderCount: 75 },
  { id: 'r3', name: 'Secretary', isSystem: true, scopeType: 'club', permissions: ['reports:submit', 'members:approve', 'showcase:submit'], holderCount: 71 },
  { id: 'r4', name: 'ZRR', isSystem: true, scopeType: 'zone', permissions: ['reports:view', 'showcase:publish', 'clubs:view'], holderCount: 4 },
  { id: 'r5', name: 'DSC / Admin', isSystem: true, scopeType: 'none', permissions: ['reports:approve', 'points:assign', 'roles:manage', 'content:edit', 'users:manage'], holderCount: 9 },
  { id: 'r6', name: 'Super Admin', isSystem: true, scopeType: 'none', permissions: ['*'], holderCount: 1 },
  { id: 'r7', name: 'Editing Team', isSystem: false, scopeType: 'none', permissions: ['content:edit', 'content:publish'], holderCount: 2 },
];

// Scoring table — computed vs judged points kept as separate fields.
export const clubMonthScores: ClubMonthScore[] = [
  { clubId: findClub('College of Vocational Studies').id, clubName: 'Delhi Rajdhani', month: 'August', computedPoints: 89, judgedPoints: null, judgedReason: '', status: 'to_score', ruleTrace: [
    { category: 'Club Services', label: 'Physical club meeting × 2', points: 40 },
    { category: 'Community Services', label: 'Blood camp organised', points: 30 },
    { category: 'Reporting to District', label: 'Filed on time', points: 20 },
  ] },
  { clubId: findClub('Galgotias Educational Institutions').id, clubName: 'Galgotias Educational Institutions', month: 'August', computedPoints: 54, judgedPoints: 15, judgedReason: 'Strong cross-club collaboration on the polio camp — exceeded the usual reach.', status: 'scored', ruleTrace: [
    { category: 'Club Services', label: 'Physical club meeting × 1', points: 20 },
    { category: 'Community Services', label: 'Rotaract initiated project', points: 20 },
    { category: 'Reporting to District', label: 'Filed on time', points: 14 },
  ] },
  { clubId: findClub('Ingenious Minds').id, clubName: 'Saksham', month: 'August', computedPoints: 31, judgedPoints: null, judgedReason: '', status: 'queried', ruleTrace: [
    { category: 'Club Services', label: 'Virtual club meeting × 1', points: 10 },
    { category: 'Reporting to District', label: 'Filed on time', points: 21 },
  ] },
];

export const members: Member[] = [
  { id: 'm1', fullName: 'Meera Nair', clubId: findClub('College of Vocational Studies').id, clubName: 'Delhi Rajdhani', email: 'meera.nair@example.com', status: 'approved', skills: ['Photography', 'Video editing'], interests: ['Community Service', 'Public Image'], hoursLogged: 34, eventsAttended: 11, memberSince: '2024-08-01' },
  { id: 'm2', fullName: 'Aarav Sharma', clubId: findClub('Galgotias Educational Institutions').id, clubName: 'Galgotias Educational Institutions', email: 'aarav.sharma@example.com', status: 'pending', skills: ['Graphic design'], interests: ['Public Image'], hoursLogged: 0, eventsAttended: 0, memberSince: '2026-09-02' },
  { id: 'm3', fullName: 'Isha Verma', clubId: findClub('Ingenious Minds').id, clubName: 'Saksham', email: 'isha.verma@example.com', status: 'pending', skills: [], interests: [], hoursLogged: 0, eventsAttended: 0, memberSince: '2026-09-03' },
];

export const effortLog: EffortLogEntry[] = [
  { id: 'e1', personName: 'Lalit', clubName: 'College of Vocational Studies', taskDescription: 'DOLLS release video edit', hours: 4, date: '2026-08-20', loggedBy: 'Archit Bhatia', pointsAwarded: 20 },
  { id: 'e2', personName: 'Garv', clubName: 'Galgotias Educational Institutions', taskDescription: 'Data sorting for district directory', hours: 2.5, date: '2026-08-22', loggedBy: 'Archit Bhatia', pointsAwarded: null },
];

export const feedbackItems: FeedbackItem[] = [
  { id: 'f1', submittedBy: 'Aarav Sharma', clubName: 'Galgotias Educational Institutions', category: 'Portal bug', message: 'The report form loses my draft if I switch tabs.', eventName: null, status: 'open', reply: null, submittedAt: '2026-09-02' },
  { id: 'f2', submittedBy: 'Meera Nair', clubName: 'Delhi Rajdhani', category: 'Event feedback', message: 'CLS venue was hard to find — signage would help next time.', eventName: 'CLS · 6 September', status: 'reviewed', reply: 'Thanks — we\'ll add signage at the gate this year.', submittedAt: '2026-09-01' },
];

export const districtSettings = {
  drrAvailability: { workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], bufferMinutes: 30 },
  complianceThresholdMonths: 3,
  activeSubdomains: {
    mission3011: { active: true, leadClub: 'Delhi Rajdhani' },
    drishti: { active: true, leadClub: 'Galgotias Educational Institutions' },
    rcl: { active: false, leadClub: null },
    careerbridge: { active: true, leadClub: 'Ingenious Minds' },
    ride: { active: false, leadClub: null },
  },
};

export const reportFormSchema = {
  version: 4,
  liveSince: '2026-08-01',
  fields: [
    { key: 'activity_title', label: 'Activity title', type: 'text', required: true },
    { key: 'activity_date', label: 'Date', type: 'date', required: true },
    { key: 'area_of_focus', label: 'Area of focus', type: 'select', required: true },
    { key: 'people_reached', label: 'People reached', type: 'number', required: true },
    { key: 'collaborating_clubs', label: 'Collaborating organisations', type: 'multiselect', required: false },
    { key: 'showcase_summary', label: 'Showcase summary', type: 'textarea', required: false },
  ],
};
