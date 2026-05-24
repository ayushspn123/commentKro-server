const YEAR = new Date().getFullYear();

const wrap = (content) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="padding:40px 16px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
      ${content}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:20px 0 0;">This email was sent because you have an account at Comment Kro.</p>
  </div>
</body></html>`;

const header = (subtitle) => `
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%);padding:48px 40px 40px;text-align:center;">
    <div style="margin-bottom:14px;">
      <div style="display:inline-block;width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;vertical-align:middle;margin-right:10px;"></div>
      <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;vertical-align:middle;">Comment Kro</span>
    </div>
    <p style="color:#a5b4fc;margin:0;font-size:14px;letter-spacing:0.3px;">${subtitle}</p>
  </div>`;

const footer = () => `
  <div style="background:#f8fafc;padding:28px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <div style="margin-bottom:12px;">
      <a href="#" style="color:#94a3b8;font-size:12px;text-decoration:none;margin:0 10px;">Unsubscribe</a>
      <span style="color:#cbd5e1;font-size:12px;">·</span>
      <a href="#" style="color:#94a3b8;font-size:12px;text-decoration:none;margin:0 10px;">Privacy Policy</a>
      <span style="color:#cbd5e1;font-size:12px;">·</span>
      <a href="#" style="color:#94a3b8;font-size:12px;text-decoration:none;margin:0 10px;">Terms</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin:0;">© ${YEAR} Comment Kro · Instagram DM Automation<br/>Made with ♥ for creators worldwide</p>
  </div>`;

const btn = (href, label, color = 'linear-gradient(135deg,#6366f1,#8b5cf6)') => `
  <a href="${href}" style="display:block;text-align:center;background:${color};color:#fff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:800;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 15px rgba(99,102,241,0.35);">
    ${label}
  </a>`;

const notice = (icon, text, bg = '#fef3c7', border = '#fde68a', color = '#92400e') => `
  <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:14px 18px;">
    <p style="color:${color};font-size:13px;margin:0;line-height:1.6;">${icon} ${text}</p>
  </div>`;

const verificationTemplate = (email, verifyLink) => wrap(`
  ${header('Please verify your email')}
  <div style="padding:40px 40px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:72px;height:72px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;margin:0 auto 20px;line-height:72px;text-align:center;font-size:32px;box-shadow:0 8px 24px rgba(99,102,241,0.3);">✉️</div>
      <h1 style="color:#0f172a;font-size:26px;font-weight:900;margin:0 0 10px;letter-spacing:-0.5px;">Confirm your email</h1>
      <p style="color:#64748b;font-size:15px;line-height:1.6;max-width:420px;margin:0 auto;">One click and you're all set. Verify your address to unlock full access to Comment Kro.</p>
    </div>

    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:16px;padding:20px 24px;margin-bottom:28px;text-align:center;">
      <p style="color:#4338ca;font-size:12px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Verifying email for</p>
      <p style="color:#1e293b;font-size:16px;font-weight:800;margin:0;">${email}</p>
    </div>

    <div style="margin-bottom:24px;">
      ${btn(verifyLink, '✅  Verify My Email Address')}
    </div>

    ${notice('⏱', 'This link expires in <strong>24 hours</strong>. If you didn\'t create an account, you can safely ignore this email.')}

    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center;line-height:1.7;">
      Button not working? Copy and paste this link into your browser:<br/>
      <a href="${verifyLink}" style="color:#6366f1;word-break:break-all;">${verifyLink}</a>
    </p>
  </div>
  ${footer()}`);

const welcomeTemplate = (name, dashboardUrl) => wrap(`
  ${header('Instagram Comment Automation')}
  <div style="padding:40px 40px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:20px;margin:0 auto 16px;line-height:64px;text-align:center;font-size:30px;box-shadow:0 6px 20px rgba(99,102,241,0.3);">🚀</div>
      <h1 style="color:#0f172a;font-size:26px;font-weight:900;margin:0 0 8px;letter-spacing:-0.5px;">Hey ${name}, you're in! 🎉</h1>
      <p style="color:#64748b;font-size:15px;margin:0;line-height:1.6;">Welcome to the fastest-growing Instagram automation platform. Your journey to effortless engagement starts now.</p>
    </div>

    <div style="background:linear-gradient(135deg,#f0f4ff,#faf5ff);border:1px solid #e0e7ff;border-radius:16px;padding:28px;margin-bottom:28px;">
      <p style="color:#4338ca;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 20px;">Get started in 3 steps</p>
      <div style="margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:40px;vertical-align:top;padding-right:14px;">
            <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;color:#fff;font-size:13px;font-weight:900;line-height:32px;text-align:center;">1</div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;font-weight:700;color:#1e293b;font-size:14px;">Connect your Instagram</p>
            <p style="margin:0;color:#64748b;font-size:13px;">Link your Professional account via Meta OAuth in one click.</p>
          </td>
        </tr></table>
      </div>
      <div style="margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:40px;vertical-align:top;padding-right:14px;">
            <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;color:#fff;font-size:13px;font-weight:900;line-height:32px;text-align:center;">2</div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;font-weight:700;color:#1e293b;font-size:14px;">Create your first automation</p>
            <p style="margin:0;color:#64748b;font-size:13px;">Set keyword triggers and instant DM replies for your posts.</p>
          </td>
        </tr></table>
      </div>
      <div>
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:40px;vertical-align:top;padding-right:14px;">
            <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;color:#fff;font-size:13px;font-weight:900;line-height:32px;text-align:center;">3</div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;font-weight:700;color:#1e293b;font-size:14px;">Watch your engagement soar</p>
            <p style="margin:0;color:#64748b;font-size:13px;">Track replies, new followers and DM conversions live.</p>
          </td>
        </tr></table>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <td style="padding-right:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
            <p style="font-size:22px;margin:0 0 4px;">⚡</p>
            <p style="color:#0f172a;font-weight:800;font-size:13px;margin:0 0 2px;">Instant DMs</p>
            <p style="color:#94a3b8;font-size:11px;margin:0;">Reply in milliseconds</p>
          </div>
        </td>
        <td style="padding:0 4px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
            <p style="font-size:22px;margin:0 0 4px;">🎯</p>
            <p style="color:#0f172a;font-weight:800;font-size:13px;margin:0 0 2px;">Keyword Match</p>
            <p style="color:#94a3b8;font-size:11px;margin:0;">Smart triggers</p>
          </div>
        </td>
        <td style="padding-left:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
            <p style="font-size:22px;margin:0 0 4px;">📊</p>
            <p style="color:#0f172a;font-weight:800;font-size:13px;margin:0 0 2px;">Analytics</p>
            <p style="color:#94a3b8;font-size:11px;margin:0;">Real-time insights</p>
          </div>
        </td>
      </tr>
    </table>

    ${btn(dashboardUrl, 'Go to Dashboard →')}
  </div>
  ${footer()}`);

const passwordResetTemplate = (resetLink) => wrap(`
  ${header('Password Reset Request')}
  <div style="padding:40px 40px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:72px;height:72px;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:50%;margin:0 auto 20px;line-height:72px;text-align:center;font-size:32px;box-shadow:0 8px 24px rgba(239,68,68,0.25);">🔐</div>
      <h1 style="color:#0f172a;font-size:26px;font-weight:900;margin:0 0 10px;letter-spacing:-0.5px;">Reset your password</h1>
      <p style="color:#64748b;font-size:15px;margin:0;line-height:1.6;">We received a request to reset your Comment Kro password. Click below to choose a new one.</p>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:20px 24px;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="width:32px;vertical-align:top;font-size:20px;padding-top:2px;">🛡️</td>
        <td style="padding-left:12px;vertical-align:top;">
          <p style="color:#991b1b;font-size:13px;font-weight:700;margin:0 0 2px;">Security Notice</p>
          <p style="color:#b91c1c;font-size:12px;margin:0;line-height:1.5;">If you didn't request this, your account is safe — simply ignore this email. No changes will be made.</p>
        </td>
      </tr></table>
    </div>

    <div style="margin-bottom:24px;">
      ${btn(resetLink, '🔑  Reset My Password', 'linear-gradient(135deg,#f59e0b,#ef4444)')}
    </div>

    ${notice('⏱', 'This link expires in <strong>1 hour</strong> for your security.')}

    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center;line-height:1.7;">
      Button not working? Copy and paste this link into your browser:<br/>
      <a href="${resetLink}" style="color:#6366f1;word-break:break-all;">${resetLink}</a>
    </p>
  </div>
  ${footer()}`);

const contactTemplate = (data) => wrap(`
  ${header('New Contact Form Submission')}
  <div style="padding:40px 40px 32px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
      <td style="width:52px;vertical-align:middle;padding-right:16px;">
        <div style="width:52px;height:52px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;line-height:52px;text-align:center;font-size:22px;box-shadow:0 4px 12px rgba(99,102,241,0.3);">📬</div>
      </td>
      <td style="vertical-align:middle;">
        <h1 style="color:#0f172a;font-size:20px;font-weight:900;margin:0 0 2px;">New message from website</h1>
        <p style="color:#64748b;font-size:13px;margin:0;">Someone submitted the contact form</p>
      </td>
    </tr></table>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:14px 20px;width:80px;"><span style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Name</span></td>
          <td style="padding:14px 20px;"><span style="color:#0f172a;font-size:14px;font-weight:700;">${data.name}</span></td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:14px 20px;"><span style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Email</span></td>
          <td style="padding:14px 20px;"><a href="mailto:${data.email}" style="color:#6366f1;font-size:14px;font-weight:600;text-decoration:none;">${data.email}</a></td>
        </tr>
        <tr>
          <td style="padding:14px 20px;"><span style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Subject</span></td>
          <td style="padding:14px 20px;"><span style="color:#0f172a;font-size:14px;font-weight:700;">${data.subject}</span></td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:28px;">
      <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">Message</p>
      <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:14px;padding:20px 24px;">
        <p style="color:#1e293b;font-size:15px;line-height:1.8;margin:0;white-space:pre-wrap;">${data.message}</p>
      </div>
    </div>

    ${btn(`mailto:${data.email}`, `↩  Reply to ${data.name}`)}
  </div>
  ${footer()}`);

module.exports = { verificationTemplate, welcomeTemplate, passwordResetTemplate, contactTemplate };
