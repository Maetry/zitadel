import type { TemplateData } from '../payload';

// Defaults match ZITADEL's (internal/notification/templates); Branding in the console overrides them.
const DEFAULTS = {
  primaryColor: '#5282c1',
  backgroundColor: '#fafafa',
  fontColor: '#000000',
  fontFamily: 'Lato, Helvetica, Arial, sans-serif',
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Texts interpolate user-controlled values (display name), so everything is escaped;
// only line breaks survive, written either as newlines or as <br> in message texts.
const BR = /<br\s*\/?>/gi;
const toHtml = (value: string) => escapeHtml(value.replace(BR, '\n')).replace(/\r?\n/g, '<br>');
const toText = (value: string) => value.replace(BR, '\n');

const color = (value: string | undefined, fallback: string) =>
  value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
const font = (value: string | undefined) =>
  value && /^[\w\s,'"-]+$/.test(value) ? value : DEFAULTS.fontFamily;
const httpUrl = (value: string | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};

export function renderEmail(data: TemplateData): RenderedEmail {
  const subject = (data.subject || data.title || 'Maetry').replace(/\s+/g, ' ').trim();
  const primary = color(data.primaryColor, DEFAULTS.primaryColor);
  const background = color(data.backgroundColor, DEFAULTS.backgroundColor);
  const fontColor = color(data.fontColor, DEFAULTS.fontColor);
  const fontFamily = escapeHtml(font(data.fontFamily));
  const url = httpUrl(data.url);
  const logoUrl = httpUrl(data.logoUrl);
  const footer = data.includeFooter && data.footerText ? data.footerText : '';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${background};">
${data.preHeader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(data.preHeader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${background};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${fontFamily};color:${fontColor};">
${logoUrl ? `<tr><td align="center" style="padding-bottom:24px;"><img src="${escapeHtml(logoUrl)}" alt="" width="120" style="display:block;border:0;height:auto;max-width:120px;"></td></tr>` : ''}
${data.greeting ? `<tr><td align="center" style="font-size:22px;font-weight:500;line-height:1.3;padding-bottom:16px;">${toHtml(data.greeting)}</td></tr>` : ''}
${data.text ? `<tr><td align="center" style="font-size:16px;line-height:1.5;padding-bottom:24px;">${toHtml(data.text)}</td></tr>` : ''}
${url && data.buttonText ? `<tr><td align="center" style="padding-bottom:24px;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${primary};color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:12px 28px;border-radius:8px;">${escapeHtml(data.buttonText)}</a></td></tr>` : ''}
${footer ? `<tr><td align="center" style="font-size:13px;line-height:1.4;opacity:0.7;">${toHtml(footer)}</td></tr>` : ''}
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    data.greeting && toText(data.greeting),
    data.text && toText(data.text),
    url && (data.buttonText ? `${data.buttonText}: ${url}` : url),
    footer && toText(footer),
  ].filter(Boolean).join('\n\n');

  return { subject, html, text };
}
