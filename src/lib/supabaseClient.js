import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('YOUR_SUPABASE')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const MOCK_STORAGE_KEY = 'district3011_monthly_reports_v3';
const MOCK_ANNOUNCEMENTS_KEY = 'district3011_announcements_v2';

export const REPORT_SECTIONS = [
  { id: 'clubMeetings', label: 'Club Meetings', icon: 'Users' },
  { id: 'clubServices', label: 'Club Services', icon: 'HeartHandshake' },
  { id: 'communityServices', label: 'Community Services', icon: 'Globe' },
  { id: 'internationalServices', label: 'International Services', icon: 'Plane' },
  { id: 'vocationalServices', label: 'Vocational Services', icon: 'Briefcase' },
  { id: 'districtProjects', label: 'District Projects', icon: 'Award' }
];

export const INITIAL_STRUCTURED_REPORT = null;

const parseSubFromDB = (item) => {
  let sections = {
    clubMeetings: [],
    clubServices: [],
    communityServices: [],
    internationalServices: [],
    vocationalServices: [],
    districtProjects: []
  };
  let month = item.month || 'August 2026';

  try {
    if (item.sections_json) {
      const sec = typeof item.sections_json === 'string' ? JSON.parse(item.sections_json) : item.sections_json;
      sections = { ...sections, ...sec };
    } else if (item.description && (item.description.startsWith('{') || item.description.startsWith('['))) {
      const parsed = JSON.parse(item.description);
      if (parsed.sections) {
        sections = { ...sections, ...parsed.sections };
        month = parsed.month || item.title?.replace('Monthly Report - ', '') || month;
      }
    } else if (item.title && item.title.includes('Monthly')) {
      sections.communityServices.push({
        id: `legacy-${item.id}`,
        eventName: item.title,
        date: item.submitted_at ? item.submitted_at.split('T')[0] : '2026-08-15',
        venue: 'Delhi NCR',
        areaOfFocus: item.category || 'Disease prevention and treatment',
        clubStrength: '30 Members',
        initiatedBy: 'Rotaract',
        collaboratingOrgs: 'District 3011',
        districtOfficials: 'District Officials',
        beneficiaryCount: item.beneficiaries || '200 People',
        description: item.description || item.narrative || 'Legacy project submission.',
        showcaseLink: item.proof_url || '',
        driveLink: ''
      });
      month = item.category?.includes('Monthly') ? item.category.replace('Monthly Report (', '').replace(')', '') : 'August 2026';
    }
  } catch (err) {
    console.warn('Parser warning:', err);
  }

  let sectionFlags = {};
  try {
    if (item.section_flags) {
      sectionFlags = typeof item.section_flags === 'string' ? JSON.parse(item.section_flags) : item.section_flags;
    } else if (item.sectionFlags) {
      sectionFlags = item.sectionFlags;
    }
  } catch (e) {}

  const cleanClubName = (item.club_name || item.clubName || '').trim();
  const cleanClubEmail = (item.club_email || item.clubEmail || '').trim();
  const uniqueId = String(item.id || `mr-${cleanClubEmail || cleanClubName || 'club'}-${month}`).trim();

  return {
    id: uniqueId,
    month: month,
    clubName: cleanClubName,
    clubEmail: cleanClubEmail,
    submittedBy: item.submitted_by || item.submittedBy || 'Rotaract Officer',
    submittedAt: item.submitted_at ? item.submitted_at.split('T')[0] : item.submittedAt || new Date().toISOString().split('T')[0],
    status: item.status || 'reported',
    flagComment: item.flag_comment || item.flagComment || null,
    flagReason: item.flag_reason || item.flagReason || null,
    flaggedBy: item.flagged_by || item.flaggedBy || null,
    flaggedAt: item.flagged_at || item.flaggedAt || null,
    sectionFlags: sectionFlags || {},
    sections: item.sections || sections
  };
};

export const dbService = {
  authenticateUser: async (rotaryIdInput, passwordInput) => {
    const cleanId = rotaryIdInput ? rotaryIdInput.trim() : '';
    const cleanPass = passwordInput ? passwordInput.trim() : '';

    if (!cleanId) {
      return { success: false, error: 'Please enter your official Rotary ID or Email.' };
    }

    // Check Supabase Database & Auth if Supabase is connected
    if (isSupabaseConfigured && supabase) {
      try {
        // Secure Server-Side RPC Function (100% Locked Table Authentication)
        const { data: rpcUser, error: rpcErr } = await supabase
          .rpc('authenticate_rotaract_user', {
            p_identity: cleanId,
            p_password: cleanPass
          });

        if (!rpcErr && rpcUser && rpcUser.length > 0) {
          const row = rpcUser[0];
          
          if (!row.role) {
            return { success: false, error: 'Access Denied: Role is missing in Supabase database.' };
          }

          const rawRole = String(row.role).toLowerCase().trim();

          if (rawRole === 'dac_member') {
            return { success: false, error: 'Access Denied: DAC Members do not have access to District or Club Portals.' };
          }

          if (rawRole !== 'officer' && rawRole !== 'president' && rawRole !== 'secretary') {
            return { success: false, error: `Access Denied: Role '${row.role}' is not authorized for portal access.` };
          }

          return {
            success: true,
            user: {
              id: row.id,
              rotaryId: row.rotary_id || cleanId,
              email: row.email || cleanId,
              role: rawRole,
              fullName: row.full_name || row.fullName || null,
              clubName: row.club_name || row.clubName || null,
              post: row.post || row.designation || null,
              totpSecret: row.totp_secret || null
            }
          };
        }

        if (rpcErr) {
          console.warn('RPC authentication notice:', rpcErr.message || rpcErr);
        }
      } catch (err) {
        console.warn('Supabase auth error:', err);
      }
    }

    return { success: false, error: 'Incorrect Rotary ID/Email or Portal Password.' };
  },

  fetchClubs: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        // Fetch from dedicated 'clubs' table in Supabase if it exists
        const { data: clubsTableData, error: clubsErr } = await supabase
          .from('clubs')
          .select('*');

        if (!clubsErr && clubsTableData && clubsTableData.length > 0) {
          return clubsTableData.map((c, idx) => ({
            id: c.id || `sp-club-${idx}`,
            name: c.name || c.club_name,
            shortName: c.short_name || (c.name || c.club_name || '').replace(/^(Rotaract\s+(Club\s+of\s+)?|RAC\s+)/i, '').trim(),
            president: c.president || c.president_name || 'Rtr. President',
            isDirector: c.is_director || c.isDirector || '',
            zone: c.zone || 'District 3011',
            phone: c.phone || '',
            email: c.email || '',
            rotaryId: c.rotary_id || c.rotaryId || '',
            secretary: c.secretary || '',
            secretaryPhone: c.secretary_phone || c.secretaryPhone || '',
            secretaryEmail: c.secretary_email || c.secretaryEmail || '',
            charterYear: c.charter_year || c.charterYear || '',
            lat: typeof c.lat === 'number' ? c.lat : (parseFloat(c.lat) || 28.6139),
            lng: typeof c.lng === 'number' ? c.lng : (parseFloat(c.lng) || 77.2090),
            initiatives: c.initiatives || []
          }));
        }
      } catch (err) {
        console.warn('Supabase fetchClubs notice:', err);
      }
    }
    return null;
  },

  fetchSubmissions: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Fetch from monthly_reports table
        const { data: reportData, error: reportErr } = await supabase
          .from('monthly_reports')
          .select('*')
          .order('submitted_at', { ascending: false });

        if (!reportErr && reportData && reportData.length > 0) {
          return reportData.map(parseSubFromDB);
        }

        // 2. Fallback to project_submissions table if monthly_reports returned no rows or had error
        const { data: subData, error: subErr } = await supabase
          .from('project_submissions')
          .select('*')
          .order('submitted_at', { ascending: false });

        if (!subErr && subData && subData.length > 0) {
          return subData.map(parseSubFromDB);
        }

        if (!reportErr && reportData) {
          return [];
        }
      } catch (err) {
        console.error('Supabase fetch submissions error:', err);
      }
    }
    return mockStore.getSubmissions();
  },

  insertSubmission: async (newReport) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const totalProjs = Object.values(newReport.sections || {}).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0);

        // 1. Prepare clean payload for monthly_reports
        const reportPayload = {
          month: newReport.month,
          club_name: newReport.clubName,
          club_email: newReport.clubEmail,
          submitted_by: newReport.submittedBy,
          status: newReport.status || 'reported',
          flag_comment: newReport.flagComment || null,
          flag_reason: newReport.flagReason || null,
          flagged_by: newReport.flaggedBy || null,
          flagged_at: newReport.flaggedAt || null,
          section_flags: newReport.sectionFlags ? (typeof newReport.sectionFlags === 'string' ? newReport.sectionFlags : JSON.stringify(newReport.sectionFlags)) : null,
          sections_json: newReport.sections
        };

        // Check if an entry already exists for this club & month in monthly_reports
        let existingMrId = null;
        if (newReport.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newReport.id)) {
          existingMrId = newReport.id;
        } else {
          try {
            const { data: found } = await supabase
              .from('monthly_reports')
              .select('id')
              .eq('club_email', newReport.clubEmail)
              .eq('month', newReport.month)
              .limit(1);
            if (found && found.length > 0) {
              existingMrId = found[0].id;
            }
          } catch (e) {}
        }

        if (existingMrId) {
          const { error: updateErr } = await supabase
            .from('monthly_reports')
            .update(reportPayload)
            .eq('id', existingMrId);

          if (!updateErr) {
            console.log('Updated existing monthly report in Supabase!');
            return await dbService.fetchSubmissions();
          }
        } else {
          const { error: insertErr } = await supabase
            .from('monthly_reports')
            .insert([reportPayload]);

          if (!insertErr) {
            console.log('Inserted new monthly report to Supabase monthly_reports!');
            return await dbService.fetchSubmissions();
          }
        }

        // 2. Fallback insert/update to project_submissions table
        const subPayload = {
          club_name: newReport.clubName,
          club_email: newReport.clubEmail,
          submitted_by: newReport.submittedBy,
          title: `${newReport.month} Monthly Report (${totalProjs} Projects)`,
          category: `Monthly Report (${newReport.month})`,
          description: JSON.stringify({ 
            month: newReport.month, 
            sections: newReport.sections,
            status: newReport.status || 'reported',
            flagComment: newReport.flagComment || null,
            flagReason: newReport.flagReason || null,
            flaggedBy: newReport.flaggedBy || null,
            flaggedAt: newReport.flaggedAt || null,
            sectionFlags: newReport.sectionFlags || null
          }),
          budget: `${totalProjs} Projects Logged`,
          beneficiaries: `${totalProjs} Avenues Completed`,
          proof_url: 'https://rotary.org/service-project-center',
          status: newReport.status || 'reported'
        };

        const { error: subErr } = await supabase
          .from('project_submissions')
          .insert([subPayload]);

        if (!subErr) {
          console.log('Saved report to Supabase project_submissions fallback table!');
          return await dbService.fetchSubmissions();
        }
      } catch (err) {
        console.error('Supabase insert submission error:', err);
      }
    }
    return mockStore.addSubmission(newReport);
  },

  flagSubmission: async (id, flagPayload) => {
    const comment = typeof flagPayload === 'string' ? flagPayload : flagPayload?.comment || '';
    const reason = typeof flagPayload === 'object' ? flagPayload?.reason || 'Audit Feedback' : 'Audit Feedback';
    const flaggedBy = typeof flagPayload === 'object' ? flagPayload?.flaggedBy || 'District Secretariat' : 'District Secretariat';
    const sectionFlags = typeof flagPayload === 'object' ? flagPayload?.sectionFlags || {} : {};
    const flaggedAt = new Date().toISOString().split('T')[0];

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload = { 
          status: 'flagged', 
          flag_comment: comment,
          flag_reason: reason,
          flagged_by: flaggedBy,
          flagged_at: flaggedAt,
          section_flags: JSON.stringify(sectionFlags)
        };

        let query = supabase.from('monthly_reports').update(updatePayload).eq('id', id);
        const { error: mrErr } = await query;

        if (!mrErr) {
          return await dbService.fetchSubmissions();
        }

        // Fallback update project_submissions
        const { error: subErr } = await supabase
          .from('project_submissions')
          .update({ status: 'flagged', flag_comment: comment })
          .eq('id', id);

        if (!subErr) {
          return await dbService.fetchSubmissions();
        }
      } catch (err) {
        console.warn('Supabase flag notice:', err);
      }
    }
    return mockStore.flagSubmission(id, { comment, reason, flaggedBy, sectionFlags, flaggedAt });
  },

  deleteSubmission: async (id) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: mrErr } = await supabase
          .from('monthly_reports')
          .delete()
          .eq('id', id);

        const { error: subErr } = await supabase
          .from('project_submissions')
          .delete()
          .eq('id', id);

        if (!mrErr && !subErr) {
          console.log(`Successfully deleted report ${id} from Supabase!`);
          return await dbService.fetchSubmissions();
        }
      } catch (err) {
        console.error('Supabase delete error:', err);
      }
    }
    return mockStore.deleteSubmission(id);
  },

  fetchAnnouncements: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          return data.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category || 'District Event',
            targetAudience: a.target_audience || 'all',
            author: a.author_name || 'District Secretariat',
            date: a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'August 2026',
            content: a.content,
            sentViaEmail: Boolean(a.sent_via_email)
          }));
        }
      } catch (err) {
        console.warn('Supabase announcements fetch notice:', err);
      }
    }
    return mockStore.getAnnouncements();
  },

  insertAnnouncement: async (announcement) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('announcements')
          .insert([{
            title: announcement.title,
            category: announcement.category || 'District Event',
            target_audience: announcement.targetAudience || 'all',
            content: announcement.content,
            author_name: announcement.author || 'District Secretariat',
            sent_via_email: Boolean(announcement.sentViaEmail)
          }]);

        if (!error) {
          return await dbService.fetchAnnouncements();
        } else {
          console.warn('Supabase announcement insert error:', error);
        }
      } catch (err) {
        console.warn('Supabase announcement insert notice:', err);
      }
    }
    return mockStore.addAnnouncement(announcement);
  },

  deleteAnnouncement: async (id) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('announcements')
          .delete()
          .eq('id', id);

        if (!error) {
          return await dbService.fetchAnnouncements();
        } else {
          console.warn('Supabase delete announcement error:', error);
        }
      } catch (err) {
        console.warn('Supabase delete announcement notice:', err);
      }
    }
    return mockStore.deleteAnnouncement(id);
  },

  // Save TOTP secret securely to Supabase user_profiles via RPC
  saveUserTotpSecret: async (userId, secret) => {
    if (isSupabaseConfigured && supabase && userId && secret) {
      try {
        const { error } = await supabase.rpc('set_user_totp_secret', {
          p_user_id: userId,
          p_secret: secret
        });
        if (error) {
          console.warn('saveUserTotpSecret RPC notice:', error.message || error);
          return false;
        }
        return true;
      } catch (err) {
        console.warn('saveUserTotpSecret exception:', err);
        return false;
      }
    }
    return false;
  },

  // Fetch audience emails securely via RPC (never queries user_profiles directly from client)
  fetchAudienceEmails: async (audience) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .rpc('get_audience_emails', { p_audience: audience });
        if (!error && data) {
          const emails = data.map(r => r.email).filter(Boolean);
          return { data: Array.from(new Set(emails)), error: null };
        }
        return { data: [], error };
      } catch (err) {
        return { data: [], error: err };
      }
    }
    return { data: [], error: new Error('Supabase not configured') };
  },

  // Request a password reset passcode via RPC
  requestPasswordReset: async (identity) => {
    const cleanId = (identity || '').trim();
    if (!cleanId) {
      return { success: false, error: 'Please enter your registered Rotary ID or Email.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('request_password_reset', {
          p_identity: cleanId
        });

        if (error) {
          console.warn('requestPasswordReset RPC error:', error);
          return { success: false, error: error.message || 'Failed to initiate password reset.' };
        }

        if (data && data.length > 0) {
          const res = data[0];
          if (!res.success) {
            return { success: false, error: res.error || 'No registered account found with that identity.' };
          }

          return {
            success: true,
            email: res.email,
            fullName: res.full_name,
            rotaryId: res.rotary_id,
            resetCode: res.reset_code
          };
        }
      } catch (err) {
        console.warn('requestPasswordReset error:', err);
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Database service is currently unreachable. Please try again later.' };
  },

  // Verify passcode and set new password in Supabase via RPC
  resetPassword: async (identity, resetCode, newPassword) => {
    const cleanId = (identity || '').trim();
    const cleanCode = (resetCode || '').trim();
    const cleanPass = (newPassword || '').trim();

    if (!cleanId || !cleanCode || !cleanPass) {
      return { success: false, error: 'Missing required reset fields.' };
    }

    if (cleanPass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('reset_user_password', {
          p_identity: cleanId,
          p_code: cleanCode,
          p_new_password: cleanPass
        });

        if (error) {
          console.warn('resetPassword RPC error:', error);
          return { success: false, error: error.message || 'Failed to update password.' };
        }

        if (data && data.length > 0) {
          const res = data[0];
          if (!res.success) {
            return { success: false, error: res.error || 'Invalid reset code or expired session.' };
          }
          return { success: true };
        }
      } catch (err) {
        console.warn('resetPassword error:', err);
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Database service is currently unreachable.' };
  }
};

export const mockStore = {
  getSubmissions: () => {
    try {
      const data = localStorage.getItem(MOCK_STORAGE_KEY);
      if (data) {
        const raw = JSON.parse(data);
        return raw.filter(Boolean).map(parseSubFromDB);
      }
      return [];
    } catch {
      return [];
    }
  },

  saveSubmissions: (submissions) => {
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(submissions));
    } catch (e) {
      console.error('Local storage save error', e);
    }
  },

  addSubmission: (newSub) => {
    const subs = mockStore.getSubmissions();
    const cleanId = newSub.id || `sub-${Date.now()}`;
    const cleanSub = { ...newSub, id: cleanId };
    const updated = [
      cleanSub,
      ...subs.filter(s => s.id !== cleanId && !(s.clubEmail && cleanSub.clubEmail && s.clubEmail === cleanSub.clubEmail && s.month === cleanSub.month))
    ];
    mockStore.saveSubmissions(updated);
    return updated;
  },

  flagSubmission: (id, flagInfo) => {
    const subs = mockStore.getSubmissions();
    const isObj = typeof flagInfo === 'object';
    const comment = isObj ? flagInfo.comment : flagInfo;
    const reason = isObj ? flagInfo.reason : null;
    const flaggedBy = isObj ? flagInfo.flaggedBy : null;
    const sectionFlags = isObj ? flagInfo.sectionFlags : {};
    const flaggedAt = isObj ? flagInfo.flaggedAt : new Date().toISOString().split('T')[0];

    const updated = subs.map(s => s.id === id ? { 
      ...s, 
      status: 'flagged', 
      flagComment: comment,
      flagReason: reason,
      flaggedBy: flaggedBy,
      sectionFlags: sectionFlags,
      flaggedAt: flaggedAt
    } : s);
    mockStore.saveSubmissions(updated);
    return updated;
  },

  deleteSubmission: (id) => {
    const subs = mockStore.getSubmissions();
    const updated = subs.filter(s => s.id !== id);
    mockStore.saveSubmissions(updated);
    return updated;
  },

  getAnnouncements: () => {
    try {
      const data = localStorage.getItem(MOCK_ANNOUNCEMENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addAnnouncement: (newAnno) => {
    const annos = mockStore.getAnnouncements();
    const updated = [newAnno, ...annos];
    try {
      localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Local storage save error', e);
    }
    return updated;
  },

  deleteAnnouncement: (id) => {
    const annos = mockStore.getAnnouncements();
    const updated = annos.filter(a => a.id !== id);
    try {
      localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Local storage save error', e);
    }
    return updated;
  }
};
