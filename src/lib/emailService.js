/**
 * District 3011 Resend Email Service
 * 
 * Multi-layer dispatcher:
 * 1. Primary: Serverless API proxy (/api/send-email) for production deployments.
 * 2. Fallback: Direct Resend API dispatcher using VITE_RESEND_API_KEY for local development & fallback.
 * 
 * Dynamic credentials only — ZERO hardcoded keys or personal emails.
 */
import { dbService } from './supabaseClient';

const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'District 3011 Portal <portal@rotaract3011.org>';
const FALLBACK_FROM = 'District 3011 Portal <onboarding@resend.dev>';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Direct Resend Dispatcher (Used as fallback or in local development)
 */
async function directResendFallback(type, payload) {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EmailService] VITE_RESEND_API_KEY environment variable not configured.');
    return { success: false, error: 'Email service key not configured in environment.' };
  }

  let subject = '';
  let html = '';
  let text = '';
  let recipients = [];

  if (type === 'flagged') {
    const club = escapeHtml(payload.clubName);
    const month = escapeHtml(payload.month);
    const comment = escapeHtml(payload.flagComment);
    subject = `[Action Required] District 3011 Monthly Report Flagged — ${payload.month}`;
    html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.9;">District Secretariat Audit Cell</p>
        </div>
        <div style="padding:28px;color:#333;">
          <h2 style="color:#D81B60;font-size:18px;margin-top:0;">Monthly Report Action Required</h2>
          <p style="font-size:15px;line-height:1.6;">Dear Team <strong>${club}</strong>,</p>
          <p style="font-size:15px;line-height:1.6;">
            Your monthly project report submission for <strong>${month}</strong> has been reviewed and marked with audit feedback:
          </p>
          <div style="background:#FFF1F2;border-left:4px solid #E11D48;padding:16px;margin:20px 0;border-radius:6px;">
            <p style="margin:0;color:#9F1239;font-size:14px;line-height:1.6;font-weight:600;">"${comment}"</p>
          </div>
          <p style="font-size:14px;line-height:1.6;">
            Please log into the District Portal, navigate to <strong>My Monthly Reports</strong>, revise your submission, and resubmit.
          </p>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
          Rotaract District Organization 3011 • Official Secretariat Communication
        </div>
      </div>`;
    text = `Dear ${payload.clubName},\n\nYour monthly project report for ${payload.month} has been flagged:\n"${payload.flagComment}"\n\nPlease log into the District Portal to revise and resubmit.\n\n- District Secretariat 3011`;
    recipients = [payload.recipientEmail].filter(Boolean);

  } else if (type === 'reminder') {
    const club = escapeHtml(payload.clubName);
    const month = escapeHtml(payload.month);
    subject = `[Reminder] Monthly Project Report Pending for ${payload.month} — District 3011`;
    html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.9;">District Secretariat Compliance Cell</p>
        </div>
        <div style="padding:28px;color:#333;">
          <h2 style="color:#D81B60;font-size:18px;margin-top:0;">Reporting Reminder</h2>
          <p style="font-size:15px;line-height:1.6;">Dear Team <strong>${club}</strong>,</p>
          <p style="font-size:15px;line-height:1.6;">
            This is an official reminder that your club's Monthly Project Report for <strong>${month}</strong> is currently pending on the District Portal.
          </p>
          <p style="font-size:14px;line-height:1.6;">
            Please log into the District Portal and complete your report submission at your earliest convenience.
          </p>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
          Rotaract District Organization 3011 • District Secretariat
        </div>
      </div>`;
    text = `Dear ${payload.clubName},\n\nThis is a reminder that your Monthly Project Report for ${payload.month} is pending.\nPlease submit it via the District Portal.\n\n- District Secretariat 3011`;
    recipients = [payload.recipientEmail].filter(Boolean);

  } else if (type === 'announcement') {
    const title = escapeHtml(payload.title);
    const cat = escapeHtml(payload.category || 'District Update');
    const author = escapeHtml(payload.author || 'District Secretariat');
    const content = escapeHtml(payload.content);
    const audience = escapeHtml(payload.audienceLabel || 'All Members & Officers');
    subject = `[District Announcement] ${payload.title}`;
    html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.9;">Official District Announcement</p>
        </div>
        <div style="padding:28px;color:#333;">
          <div style="display:inline-block;background:#FFF0F5;color:#D81B60;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:12px;">
            ${cat} • Target: ${audience}
          </div>
          <h2 style="color:#111;font-size:20px;margin-top:0;margin-bottom:8px;">${title}</h2>
          <p style="font-size:13px;color:#666;margin-bottom:20px;">Issued by: <strong>${author}</strong></p>
          <div style="font-size:15px;line-height:1.7;color:#333;white-space:pre-wrap;background:#fafafa;padding:16px;border-radius:8px;border:1px solid #eee;">
            ${content}
          </div>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
          Rotaract District Organization 3011 • Official Communication
        </div>
      </div>`;
    text = `District Announcement: ${payload.title}\nCategory: ${payload.category}\nIssued by: ${payload.author}\nTarget: ${payload.audienceLabel}\n\n${payload.content}\n\n- Rotaract District Organization 3011`;
    recipients = Array.isArray(payload.recipients) ? payload.recipients.filter(Boolean) : [];

  } else if (type === 'password_reset') {
    const name = escapeHtml(payload.name || 'Officer');
    const rotaryId = escapeHtml(payload.rotaryId || '');
    const code = escapeHtml(payload.resetCode || '');
    subject = `[District 3011 Security] Password Reset Passcode`;
    html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
        <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.9;">District Portal Security Notice</p>
        </div>
        <div style="padding:28px;color:#333;">
          <h2 style="color:#D81B60;font-size:18px;margin-top:0;">Password Reset Request</h2>
          <p style="font-size:15px;line-height:1.6;">Hello ${name},</p>
          <p style="font-size:15px;line-height:1.6;">
            We received a request to reset the password for your District 3011 Portal account${rotaryId ? ` (Rotary ID: <strong>${rotaryId}</strong>)` : ''}.
          </p>
          <div style="background:#FFF5F7;border:1.5px solid #FECDD3;padding:20px;margin:20px 0;border-radius:12px;text-align:center;">
            <p style="margin:0 0 8px;color:#881337;font-size:13px;font-weight:700;text-transform:uppercase;">Your 6-Digit Password Reset Passcode:</p>
            <div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#D81B60;font-family:monospace;">${code}</div>
            <p style="margin:8px 0 0;font-size:12px;color:#9F1239;">Valid for 15 minutes • Do not share this code with anyone</p>
          </div>
          <p style="font-size:14px;line-height:1.6;">
            Return to the District Portal, enter this 6-digit code, and choose your new password.
          </p>
          <p style="font-size:13px;line-height:1.6;color:#6B7280;">
            If you did not request this password reset, you can safely ignore this email.
          </p>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
          Rotaract District Organization 3011 • Tech &amp; Security Cell
        </div>
      </div>`;
    text = `Rotaract District 3011 Password Reset\n\nYour 6-Digit Password Reset Passcode: ${payload.resetCode}\nValid for 15 minutes.\n\nEnter this passcode in the portal to choose your new password.`;
    recipients = [payload.recipientEmail].filter(Boolean);
  }

  if (recipients.length === 0) {
    return { success: false, error: 'No recipient email addresses provided.' };
  }

  // If single recipient, send standard email
  if (recipients.length === 1) {
    try {
      const res = await fetch(RESEND_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: recipients,
          subject,
          html,
          text
        })
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, count: 1, id: data.id };
      }
      return { success: false, error: data.message || 'Resend dispatch failed.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // If multi-recipient broadcast, use Resend official Batch API (/emails/batch) in chunks of 100 with NO limit
  const BATCH_ENDPOINT = 'https://api.resend.com/emails/batch';
  const chunkSize = 100;
  let totalSent = 0;
  let lastError = null;

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    const batchPayload = chunk.map(email => ({
      from: FROM_ADDRESS,
      to: [email],
      subject,
      html,
      text
    }));

    try {
      const res = await fetch(BATCH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(batchPayload)
      });

      const data = await res.json();
      if (res.ok && data.data) {
        totalSent += data.data.length;
      } else {
        console.warn('[EmailService] Batch dispatch response note:', data);
        lastError = data.message || 'Batch dispatch error';
      }
    } catch (err) {
      console.error('[EmailService] Batch network error:', err);
      lastError = err.message;
    }

    // Small delay between 100-email batch chunks to respect rate limits if list is very large
    if (i + chunkSize < recipients.length) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  if (totalSent > 0) {
    return {
      success: true,
      count: totalSent,
      notice: totalSent === recipients.length 
        ? `Successfully dispatched to all ${totalSent} recipients.`
        : `Dispatched to ${totalSent} of ${recipients.length} recipients.`
    };
  }

  return { success: false, error: lastError || 'Failed to dispatch email broadcast.' };
}

/**
 * Universal API Dispatcher (Tries /api/send-email with seamless direct fallback)
 */
async function callEmailApi(type, payload) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, payload })
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success) {
        return { success: true, data };
      }
    }

    console.warn('[EmailService] Serverless API unavailable or error, activating direct Resend fallback dispatcher...');
    return await directResendFallback(type, payload);
  } catch (err) {
    console.warn('[EmailService] API network notice, activating direct Resend fallback...', err);
    return await directResendFallback(type, payload);
  }
}

/**
 * 1. Dispatch Report Flagged Notification Email
 */
export async function sendReportFlaggedEmail({ clubName, month, recipientEmail, flagComment }) {
  return await callEmailApi('flagged', {
    clubName,
    month,
    recipientEmail,
    flagComment
  });
}

/**
 * 2. Dispatch District Announcement Email Broadcast
 */
export async function sendAnnouncementBroadcastEmail({ title, category, author, content, recipients, audienceLabel = 'All Members & Officers' }) {
  return await callEmailApi('announcement', {
    title,
    category,
    author,
    content,
    recipients,
    audienceLabel
  });
}

/**
 * 3. Dispatch Reporting Reminder Notice
 */
export async function sendReportingReminderEmail({ clubName, month, recipientEmail }) {
  return await callEmailApi('reminder', {
    clubName,
    month,
    recipientEmail
  });
}

/**
 * 4. Dispatch Password Reset Passcode Email (Secure Multi-Environment Flow)
 */
export async function requestSecurePasswordReset(identity) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'request_password_reset',
        payload: { identity }
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success) {
        return { success: true, maskedEmail: data.maskedEmail };
      }
      return { success: false, error: data.error || 'Failed to request reset passcode.' };
    }

    // Direct fallback for local dev or if serverless endpoint is unavailable
    console.warn('[EmailService] Falling back to direct database + email dispatcher for password reset...');
    const dbRes = await dbService.requestPasswordReset(identity);

    if (!dbRes.success) {
      return { success: false, error: dbRes.error || 'No registered officer found with that Rotary ID or Email.' };
    }

    const directEmailRes = await directResendFallback('password_reset', {
      name: dbRes.fullName,
      rotaryId: dbRes.rotaryId,
      recipientEmail: dbRes.email,
      resetCode: dbRes.resetCode
    });

    if (!directEmailRes.success) {
      return { success: false, error: directEmailRes.error || 'Failed to dispatch email.' };
    }

    const maskedEmail = (dbRes.email || '').replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(b.length, 3))}${c}`);
    return { success: true, maskedEmail };

  } catch (err) {
    console.warn('[EmailService] requestSecurePasswordReset error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 5. Direct Dispatch Password Reset Passcode Email
 */
export async function sendPasswordResetEmail({ name, rotaryId, recipientEmail, resetCode }) {
  return await callEmailApi('password_reset', {
    name,
    rotaryId,
    recipientEmail,
    resetCode
  });
}
