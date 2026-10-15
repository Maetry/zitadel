import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src/email/render';

describe('renderEmail', () => {
  it('renders subject, button and plain text', () => {
    const email = renderEmail({
      subject: 'Verify email',
      greeting: 'Hello Ada,',
      text: 'Use the button below.\n(Code ABC123)',
      url: 'https://auth.maetry.com/ui/v2/login/verify?code=ABC123',
      buttonText: 'Verify email',
      primaryColor: '#112233',
    });
    expect(email.subject).toBe('Verify email');
    expect(email.html).toContain('href="https://auth.maetry.com/ui/v2/login/verify?code=ABC123"');
    expect(email.html).toContain('background:#112233');
    expect(email.html).toContain('Use the button below.<br>(Code ABC123)');
    expect(email.text).toBe('Hello Ada,\n\nUse the button below.\n(Code ABC123)\n\nVerify email: https://auth.maetry.com/ui/v2/login/verify?code=ABC123');
  });
  it('escapes user-controlled values and keeps only line breaks', () => {
    const email = renderEmail({ greeting: 'Hello <img src=x onerror=alert(1)>,', text: 'Line 1<br />Line 2' });
    expect(email.html).toContain('Hello &lt;img src=x onerror=alert(1)&gt;,');
    expect(email.html).toContain('Line 1<br>Line 2');
    expect(email.text).toContain('Line 1\nLine 2');
  });
  it('drops unsafe branding values', () => {
    const email = renderEmail({
      url: 'javascript:alert(1)', buttonText: 'Go', logoUrl: 'data:image/png;base64,AAAA',
      primaryColor: 'red;background:url(x)', fontFamily: 'x;}</style>',
    });
    expect(email.html).not.toContain('javascript:');
    expect(email.html).not.toContain('data:image');
    expect(email.html).not.toContain('url(x)');
    expect(email.html).not.toContain('</style>');
    expect(email.subject).toBe('Maetry');
  });
  it('adds the footer only when Branding includes it', () => {
    expect(renderEmail({ footerText: 'Maetry LLC' }).html).not.toContain('Maetry LLC');
    expect(renderEmail({ includeFooter: true, footerText: 'Maetry LLC' }).html).toContain('Maetry LLC');
  });
});
