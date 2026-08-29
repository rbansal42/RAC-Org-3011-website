/**
 * Vercel Serverless Function: /api/send-email
 * District 3011 Secure Email Proxy (Powered by Resend)
 *
 * Runs exclusively on the server — RESEND_API_KEY never reaches the browser.
 * Client calls POST /api/send-email with { type, payload }
 */

const FROM_ADDRESS = 'District 3011 Portal <portal@rotaract3011.org>';
const FALLBACK_FROM = 'District 3011 Portal <onboarding@resend.dev>';
const RESEND_API = 'https://api.resend.com/emails';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY environment variable not configured on server.' };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    return { success: false, error: 'No recipient email addresses provided.' };
  }

  // If single recipient, send standard email
  if (recipients.length === 1) {
    try {
      const res = await fetch(RESEND_API, {
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
        console.warn('[send-email] Batch dispatch response note:', data);
        lastError = data.message || 'Batch dispatch error';
      }
    } catch (err) {
      console.error('[send-email] Batch network error:', err);
      lastError = err.message;
    }

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

// ─── Sanitized Email HTML Builders ───────────────────────────────────────────

function buildFlaggedEmail({ clubName, month, flagComment }) {
  const safeClub = escapeHtml(clubName);
  const safeMonth = escapeHtml(month);
  const safeComment = escapeHtml(flagComment);

  const subject = `[Action Required] District 3011 Monthly Report Flagged — ${safeMonth}`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
      <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:.9;">Monthly Project Reporting Studio Alert</p>
      </div>
      <div style="padding:28px;color:#333;">
        <h2 style="color:#D81B60;font-size:18px;margin-top:0;">Action Required — ${safeClub}</h2>
        <p style="font-size:15px;line-height:1.6;">Dear Club Officers,</p>
        <p style="font-size:15px;line-height:1.6;">
          Your Monthly Project Report for <strong>${safeMonth}</strong> has been reviewed by the District Secretariat and marked as
          <strong>FLAGGED / REVISION REQUIRED</strong>.
        </p>
        <div style="background:#FFF5F7;border-left:4px solid #D81B60;padding:16px;margin:20px 0;border-radius:4px;">
          <h4 style="margin:0 0 6px;color:#D81B60;font-size:13px;text-transform:uppercase;">District Officer Feedback:</h4>
          <p style="margin:0;font-size:14px;color:#444;font-style:italic;">"${safeComment}"</p>
        </div>
        <p style="font-size:14px;line-height:1.6;">
          Please log into the <strong>District 3011 Portal</strong> at
          <a href="https://rotaract3011.org/portal" style="color:#D81B60;">rotaract3011.org/portal</a>,
          update your report, and re-submit.
        </p>
      </div>
      <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
        Rotaract District Organization 3011 • Tech &amp; Secretariat Cell
      </div>
    </div>`;
  const text = `Rotaract District 3011 Alert\n\nDear Officers of ${clubName},\nYour Monthly Project Report for ${month} has been flagged:\n"${flagComment}"\n\nPlease log into the District Portal to revise: https://rotaract3011.org/portal`;
  return { subject, html, text };
}

function buildAnnouncementEmail({ title, category, author, content, audienceLabel }) {
  const safeTitle = escapeHtml(title);
  const safeCat = escapeHtml(category);
  const safeAuthor = escapeHtml(author);
  const safeAudience = escapeHtml(audienceLabel || 'All Members & Officers');
  const safeContent = escapeHtml(content);

  const subject = `[District Announcement] ${safeTitle}`;
  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);border:1px solid #e5e7eb;">
        <tr>
          <td style="background:linear-gradient(135deg,#D81B60 0%,#AD1457 100%);padding:32px 28px;text-align:center;color:#fff;">
            <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#FCE4EC;margin-bottom:6px;">Rotary International District 3011</div>
            <h1 style="margin:0;font-size:22px;font-weight:900;">ROTARACT DISTRICT 3011</h1>
            <div style="margin-top:8px;display:inline-block;background:rgba(255,255,255,.18);padding:4px 14px;border-radius:100px;font-size:12px;font-weight:700;">
              Official Secretariat Broadcast • ${safeAudience}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;">
            <div style="margin-bottom:16px;">
              <span style="background:#FFE4EC;color:#D81B60;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:800;display:inline-block;">${safeCat}</span>
              <span style="background:#E0F2FE;color:#0284C7;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:800;display:inline-block;margin-left:6px;">Audience: ${safeAudience}</span>
            </div>
            <h2 style="color:#111827;font-size:22px;font-weight:800;margin:0 0 12px;line-height:1.3;">${safeTitle}</h2>
            <div style="font-size:13px;color:#6B7280;padding-bottom:16px;margin-bottom:20px;border-bottom:1px solid #F3F4F6;font-weight:600;">
              Issued by <strong style="color:#D81B60;">${safeAuthor}</strong> • District Secretariat 3011
            </div>
            <div style="font-size:15px;line-height:1.75;color:#374151;background:#FAFAFA;padding:22px;border-radius:12px;border-left:4px solid #D81B60;white-space:pre-wrap;margin-bottom:28px;">${safeContent}</div>
            <div style="text-align:center;margin:30px 0 10px;">
              <a href="https://rotaract3011.org/portal" target="_blank" style="background:#D81B60;color:#fff;padding:14px 28px;border-radius:100px;font-size:14px;font-weight:800;text-decoration:none;display:inline-block;box-shadow:0 4px 14px rgba(216,27,96,.35);">
                Access Rotaract District Portal &rarr;
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F9FAFB;padding:20px 28px;text-align:center;font-size:12px;color:#9CA3AF;border-top:1px solid #F3F4F6;">
            <p style="margin:0 0 6px;font-weight:700;color:#6B7280;">Rotaract District Organization 3011</p>
            <p style="margin:0;">This official email broadcast was dispatched via District 3011 Communications Portal.</p>
          </td>
        </tr>
      </table>
    </body></html>`;
  const text = `${title}\n\n${content}\n\nIssued by ${author} • District Secretariat 3011\nhttps://rotaract3011.org`;
  return { subject, html, text };
}

function buildReminderEmail({ clubName, month }) {
  const safeClub = escapeHtml(clubName);
  const safeMonth = escapeHtml(month);

  const subject = `[Reminder] Monthly Project Report Pending for ${safeMonth}`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
      <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:.9;">Secretariat Compliance Notice</p>
      </div>
      <div style="padding:28px;color:#333;">
        <h2 style="color:#D81B60;font-size:18px;margin-top:0;">Reporting Notice for ${safeClub}</h2>
        <p style="font-size:15px;line-height:1.6;">Dear President &amp; Secretary,</p>
        <p style="font-size:15px;line-height:1.6;">
          This is an official reminder that your club's Monthly Project Report for <strong>${safeMonth}</strong> is
          currently pending submission.
        </p>
        <p style="font-size:14px;line-height:1.6;">
          Please submit before the deadline at
          <a href="https://rotaract3011.org/portal" style="color:#D81B60;">rotaract3011.org/portal</a>.
        </p>
      </div>
      <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
        Rotaract District Organization 3011 Secretariat
      </div>
    </div>`;
  const text = `Reporting Reminder for ${clubName}\nYour Monthly Project Report for ${month} is pending. Please submit: https://rotaract3011.org/portal`;
  return { subject, html, text };
}

function buildPasswordResetEmail({ name, rotaryId, resetCode }) {
  const safeName = escapeHtml(name || 'Officer');
  const safeRotaryId = escapeHtml(rotaryId || '');
  const safeCode = escapeHtml(resetCode);

  const subject = `[District 3011 Security] Password Reset Passcode`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
      <div style="background:#D81B60;padding:24px;text-align:center;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:800;">ROTARACT DISTRICT 3011</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:.9;">District Portal Security Notice</p>
      </div>
      <div style="padding:28px;color:#333;">
        <h2 style="color:#D81B60;font-size:18px;margin-top:0;">Password Reset Request</h2>
        <p style="font-size:15px;line-height:1.6;">Hello ${safeName},</p>
        <p style="font-size:15px;line-height:1.6;">
          We received a request to reset the password for your District 3011 Portal account${safeRotaryId ? ` (Rotary ID: <strong>${safeRotaryId}</strong>)` : ''}.
        </p>
        <div style="background:#FFF5F7;border:1.5px solid #FECDD3;padding:20px;margin:20px 0;border-radius:12px;text-align:center;">
          <p style="margin:0 0 8px;color:#881337;font-size:13px;font-weight:700;text-transform:uppercase;">Your 6-Digit Password Reset Passcode:</p>
          <div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#D81B60;font-family:monospace;">${safeCode}</div>
          <p style="margin:8px 0 0;font-size:12px;color:#9F1239;">Valid for 15 minutes • Do not share this code with anyone</p>
        </div>
        <p style="font-size:14px;line-height:1.6;">
          Return to the District Portal, enter this 6-digit code, and choose your new password.
        </p>
        <p style="font-size:13px;line-height:1.6;color:#6B7280;">
          If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </div>
      <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
        Rotaract District Organization 3011 • Tech &amp; Security Cell
      </div>
    </div>`;
  const text = `Rotaract District 3011 Password Reset\n\nYour 6-Digit Password Reset Passcode: ${resetCode}\nValid for 15 minutes.\n\nEnter this passcode in the portal to choose your new password.`;
  return { subject, html, text };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { type, payload } = req.body || {};

  if (!type || !payload) {
    return res.status(400).json({ success: false, error: 'Missing type or payload.' });
  }

  let emailContent;
  let recipients;

  try {
    switch (type) {
      case 'flagged': {
        const { clubName, month, recipientEmail, flagComment } = payload;
        if (!clubName || !month || !flagComment) {
          return res.status(400).json({ success: false, error: 'Missing required fields for flagged email.' });
        }
        emailContent = buildFlaggedEmail({ clubName, month, flagComment });
        recipients = [recipientEmail];
        break;
      }

      case 'announcement': {
        const { title, category, author, content, recipients: r, audienceLabel } = payload;
        if (!title || !content) {
          return res.status(400).json({ success: false, error: 'Missing required fields for announcement email.' });
        }
        emailContent = buildAnnouncementEmail({ title, category, author, content, audienceLabel });
        recipients = r && r.length > 0 ? r : [];
        break;
      }

      case 'reminder': {
        const { clubName, month, recipientEmail } = payload;
        if (!clubName || !month || !recipientEmail) {
          return res.status(400).json({ success: false, error: 'Missing required fields for reminder email.' });
        }
        emailContent = buildReminderEmail({ clubName, month });
        recipients = [recipientEmail];
        break;
      }

      case 'request_password_reset': {
        const identity = (payload?.identity || '').trim();
        if (!identity) {
          return res.status(400).json({ success: false, error: 'Rotary ID or Email is required.' });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          return res.status(500).json({ success: false, error: 'Database environment variables not configured on server.' });
        }

        // Call Supabase RPC initiate_server_password_reset directly on server
        const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/initiate_server_password_reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ p_identity: identity })
        });

        const rpcData = await rpcRes.json();
        if (!rpcRes.ok || !rpcData || rpcData.length === 0) {
          return res.status(400).json({ success: false, error: 'No registered officer found with that Rotary ID or Email.' });
        }

        const userRecord = rpcData[0];
        if (!userRecord.success) {
          return res.status(400).json({ success: false, error: userRecord.error || 'No registered account found.' });
        }

        // Build email server-side
        const resetCode = userRecord.reset_code;
        const recipientEmail = userRecord.email;
        const name = userRecord.full_name || 'Officer';
        const rotaryId = userRecord.rotary_id || '';

        emailContent = buildPasswordResetEmail({ name, rotaryId, resetCode });
        recipients = [recipientEmail];

        const sendResult = await sendViaResend({
          to: recipients,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });

        if (!sendResult.success) {
          return res.status(500).json({ success: false, error: sendResult.error || 'Failed to dispatch email.' });
        }

        // Mask email for privacy (e.g. j***@gmail.com)
        const maskedEmail = recipientEmail.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(b.length, 3))}${c}`);

        // Return ONLY success & masked email — ZERO passcode exposure to browser
        return res.status(200).json({
          success: true,
          maskedEmail
        });
      }

      case 'password_reset': {
        const { name, rotaryId, recipientEmail, resetCode } = payload;
        if (!recipientEmail || !resetCode) {
          return res.status(400).json({ success: false, error: 'Missing recipientEmail or resetCode for password reset.' });
        }
        emailContent = buildPasswordResetEmail({ name, rotaryId, resetCode });
        recipients = [recipientEmail];
        break;
      }

      default:
        return res.status(400).json({ success: false, error: `Unsupported email action: ${type}` });
    }

    const result = await sendViaResend({
      to: recipients,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });

    return res.status(result.success ? 200 : 500).json(result);

  } catch (err) {
    console.error('[send-email] Top-level handler exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
