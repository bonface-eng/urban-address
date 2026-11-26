import { createHmac } from 'node:crypto';
import { escapeEmailHtml } from '@/lib/resend';

const BRAND = {
  name: 'Urban Auto Express',
  orange: '#FF6A00',
  ink: '#202124',
  muted: '#6B7280',
  line: '#E5E7EB',
  background: '#F5F6F8',
  website: 'https://urbanautoexpress.com',
  logo: 'https://urbanautoexpress.com/assets/logo.png',
  phone: '+254785860753',
  phoneDisplay: '0785 860 753',
  address: 'Nakuru, Kenya',
};

type EmailTemplate = { subject: string; html: string; text: string };
type TemplateInput = { name?: string; email: string };

function escape(value: unknown) {
  return escapeEmailHtml(String(value ?? ''));
}

function signedEmailToken(email: string) {
  const secret = process.env.RESEND_API_KEY;
  if (!secret) throw new Error('RESEND_API_KEY is not configured.');
  const payload = Buffer.from(email.trim().toLowerCase()).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function unsubscribeUrl(email: string) {
  const url = new URL('/api/email/unsubscribe', BRAND.website);
  url.searchParams.set('token', signedEmailToken(email));
  return url.toString();
}

function socialLinks() {
  const entries = [
    ['Facebook', process.env.EMAIL_SOCIAL_FACEBOOK_URL],
    ['Instagram', process.env.EMAIL_SOCIAL_INSTAGRAM_URL],
    ['TikTok', process.env.EMAIL_SOCIAL_TIKTOK_URL],
    ['YouTube', process.env.EMAIL_SOCIAL_YOUTUBE_URL],
    ['Google Business Profile', 'https://share.google/ZdWo21gYJtZTMMqSz'],
  ] as const;
  return entries
    .filter(([, url]) => !!url && /^https:\/\//i.test(url))
    .map(([label, url]) => `<a href="${escape(url)}" style="color:${BRAND.orange};text-decoration:none;font-weight:600;margin:0 8px">${label}</a>`)
    .join('');
}

function layout(content: string, email: string, allowUnsubscribe = false, logoUrl = BRAND.logo) {
  const socials = socialLinks();
  const preferences = allowUnsubscribe ? unsubscribeUrl(email) : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:24px 12px;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:10px;overflow:hidden">
<tr><td style="height:5px;background:${BRAND.orange};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 28px 16px"><a href="${BRAND.website}" style="text-decoration:none"><img src="${escape(logoUrl)}" width="154" alt="Urban Auto Express" style="display:block;width:154px;max-width:70%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:8px 32px 30px">${content}</td></tr>
<tr><td style="padding:24px 24px;background:#FAFAFA;border-top:1px solid ${BRAND.line};text-align:center">
<p style="margin:0 0 10px;font-size:13px;color:${BRAND.ink};font-weight:700">Urban Auto Express</p>
<p style="margin:0 0 12px;font-size:12px;line-height:1.8;color:${BRAND.muted}"><a href="tel:${BRAND.phone}" style="color:${BRAND.orange};text-decoration:none">${BRAND.phoneDisplay}</a><br><a href="mailto:mail@urbanautoexpress.com" style="color:${BRAND.orange};text-decoration:none">mail@urbanautoexpress.com</a><br>${BRAND.address}<br><a href="${BRAND.website}" style="color:${BRAND.orange};text-decoration:none">urbanautoexpress.com</a></p>
${socials ? `<p style="margin:0 0 14px;font-size:12px">${socials}</p>` : ''}
<p style="margin:0 0 8px;font-size:11px;line-height:1.6;color:${BRAND.muted}">Care for the journey. Comfort for the pause.</p>
<p style="margin:0 0 8px;font-size:11px;line-height:1.7"><a href="https://urbanautoexpress.com/terms" style="color:${BRAND.orange};text-decoration:none">Terms &amp; Conditions</a> &nbsp;|&nbsp; <a href="https://urbanautoexpress.com/privacy" style="color:${BRAND.orange};text-decoration:none">Privacy Policy</a></p>
${allowUnsubscribe ? `<p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted}">To stop promotional emails, <a href="${preferences}" style="color:${BRAND.orange};text-decoration:underline">unsubscribe here</a>.</p>` : ''}
</td></tr></table>
<p style="margin:16px 0 0;text-align:center;font-size:10px;color:#9CA3AF">© ${new Date().getFullYear()} Urban Auto Express. All rights reserved.</p>
</td></tr></table></body></html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:${BRAND.orange};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:6px;font-size:14px;font-weight:700">${escape(label)}</a></p>`;
}

export function verificationEmail(input: TemplateInput & { verificationUrl: string }): EmailTemplate {
  const name = escape(input.name || 'there');
  const html = layout(`<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:${BRAND.ink}">Verify your email address</h1><p style="font-size:15px;line-height:1.7">Hello ${name},</p><p style="font-size:15px;line-height:1.7">Confirm your email address to finish setting up your Urban Auto Express account.</p>${button(input.verificationUrl, 'Verify email address')}<p style="font-size:12px;line-height:1.6;color:${BRAND.muted}">If the button does not work, copy this link into your browser:<br><a href="${escape(input.verificationUrl)}" style="color:${BRAND.orange};word-break:break-all">${escape(input.verificationUrl)}</a></p><p style="font-size:12px;color:${BRAND.muted}">If you did not create this account, you can ignore this message.</p>`, input.email);
  return { subject: 'Verify your Urban Auto Express account', html, text: `Hello ${input.name || 'there'}, verify your email address: ${input.verificationUrl}. If you did not create this account, ignore this email.` };
}

export function passwordResetEmail(input: TemplateInput & { resetUrl: string }): EmailTemplate {
  const html = layout(`<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:${BRAND.ink}">Reset your password</h1><p style="font-size:15px;line-height:1.7">We received a request to reset the password for <strong>${escape(input.email)}</strong>.</p>${button(input.resetUrl, 'Choose a new password')}<p style="font-size:12px;line-height:1.6;color:${BRAND.muted}">If the button does not work, copy this link into your browser:<br><a href="${escape(input.resetUrl)}" style="color:${BRAND.orange};word-break:break-all">${escape(input.resetUrl)}</a></p><p style="font-size:12px;color:${BRAND.muted}">If you did not request a password reset, you can safely ignore this message. Your password will not change.</p>`, input.email);
  return { subject: 'Reset your Urban Auto Express password', html, text: `A password reset was requested for ${input.email}. Choose a new password here: ${input.resetUrl}. If you did not request this, ignore this email.` };
}

export type PaymentReceiptInput = TemplateInput & {
  currency: string; amount: string | number; receiptNumber: string;
  transactionReference: string; paymentMethod: string; paymentDate: string;
  description?: string;
};

export function paymentReceiptEmail(input: PaymentReceiptInput): EmailTemplate {
  const row = (label: string, value: unknown) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-size:13px;color:${BRAND.muted}">${label}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-size:13px;color:${BRAND.ink};font-weight:600">${escape(value)}</td></tr>`;
  const html = layout(`<h1 style="margin:0 0 12px;font-size:24px;color:${BRAND.ink}">Payment receipt</h1><p style="font-size:15px;line-height:1.7">Hello ${escape(input.name || 'there')}, we have received your payment. Thank you for choosing Urban Auto Express.</p><div style="margin:22px 0;padding:18px;background:#FFF7F0;border:1px solid #FFE0CC;border-radius:8px"><p style="margin:0 0 5px;font-size:12px;color:${BRAND.muted}">Amount paid</p><p style="margin:0;font-size:26px;font-weight:700;color:${BRAND.ink}">${escape(input.currency)} ${escape(input.amount)}</p></div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${row('Receipt number', input.receiptNumber)}${row('Transaction reference', input.transactionReference)}${row('Payment method', input.paymentMethod)}${row('Payment date', input.paymentDate)}${input.description ? row('Description', input.description) : ''}</table><p style="font-size:13px;line-height:1.7;color:${BRAND.muted};margin-top:22px">Please keep this email for your records. Contact us if you need assistance with this payment.</p>`, input.email);
  return { subject: `Your Urban Auto Express payment receipt ${input.receiptNumber}`, html, text: `Payment received: ${input.currency} ${input.amount}. Receipt: ${input.receiptNumber}. Reference: ${input.transactionReference}. Method: ${input.paymentMethod}. Date: ${input.paymentDate}.` };
}

export function customerNotificationEmail(input: TemplateInput & {
  subject: string; heading: string; message: string; actionUrl?: string; actionLabel?: string; marketing?: boolean;
}): EmailTemplate {
  const action = input.actionUrl && input.actionLabel ? button(input.actionUrl, input.actionLabel) : '';
  const html = layout(`<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:${BRAND.ink}">${escape(input.heading)}</h1><p style="font-size:15px;line-height:1.8">Hello ${escape(input.name || 'there')},</p><div style="font-size:15px;line-height:1.8;white-space:pre-line">${escape(input.message)}</div>${action}<p style="font-size:12px;color:${BRAND.muted}">If you need help, call us on ${BRAND.phoneDisplay}.</p>`, input.email, input.marketing === true);
  return { subject: input.subject, html, text: `Hello ${input.name || 'there'},\n\n${input.message}${input.actionUrl ? `\n\n${input.actionLabel || 'View details'}: ${input.actionUrl}` : ''}` };
}

export type AdminEmailKind =
  | 'DISMISSAL'
  | 'PURCHASE_ORDER'
  | 'WARNING_LETTER'
  | 'OFFICIAL_COMMUNICATION'
  | 'MARKETING'
  | 'GENERAL';

export function adminCommunicationEmail(input: TemplateInput & {
  kind: AdminEmailKind;
  subject: string;
  heading: string;
  message: string;
  reference?: string;
  actionUrl?: string;
  actionLabel?: string;
  logoUrl?: string;
  imageUrl?: string;
}): EmailTemplate {
  const labels: Record<AdminEmailKind, string> = {
    DISMISSAL: 'Private & Confidential · Employment Communication',
    PURCHASE_ORDER: 'Official Purchase Order',
    WARNING_LETTER: 'Private & Confidential · Formal Notice',
    OFFICIAL_COMMUNICATION: 'Official Business Communication',
    MARKETING: 'Urban Auto Express · News & Offers',
    GENERAL: 'Urban Auto Express',
  };
  const action = input.actionUrl && input.actionLabel ? button(input.actionUrl, input.actionLabel) : '';
  const image = input.imageUrl && /^https:\/\//i.test(input.imageUrl) ? `<p style=\"margin:20px 0\"><img src=\"${escape(input.imageUrl)}\" alt=\"\" style=\"display:block;max-width:100%;height:auto;border:0;border-radius:8px\"></p>` : '';
  const reference = input.reference
    ? `<p style="font-size:12px;color:${BRAND.muted};margin:0 0 18px">Reference: <strong>${escape(input.reference)}</strong></p>`
    : '';
  const html = layout(
    `<p style="margin:0 0 10px;color:${BRAND.orange};font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${labels[input.kind]}</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:${BRAND.ink}">${escape(input.heading)}</h1>
<p style="font-size:15px;line-height:1.8">Hello ${escape(input.name || 'there')},</p>
${reference}
${image}
<div style="font-size:14px;line-height:1.85;white-space:pre-line">${escape(input.message)}</div>
${action}
<p style="font-size:13px;line-height:1.7;color:${BRAND.muted};margin-top:24px">For clarification, contact our office on <a href="tel:${BRAND.phone}" style="color:${BRAND.orange};text-decoration:none">${BRAND.phoneDisplay}</a>.</p>`,
    input.email,
    input.kind === 'MARKETING',
    input.logoUrl && /^https:\/\//i.test(input.logoUrl) ? input.logoUrl : BRAND.logo,
  );
  return {
    subject: input.subject,
    html,
    text: `${labels[input.kind]}\n\nHello ${input.name || 'there'},\n\n${input.heading}\n${input.reference ? `Reference: ${input.reference}\n\n` : ''}${input.message}${input.actionUrl ? `\n\n${input.actionLabel || 'View details'}: ${input.actionUrl}` : ''}\n\nUrban Auto Express · ${BRAND.phoneDisplay}\nTerms: https://urbanautoexpress.com/terms\nPrivacy: https://urbanautoexpress.com/privacy`,
  };
}
