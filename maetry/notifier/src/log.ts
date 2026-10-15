// Logs never carry message texts or codes; recipients are masked.
export function maskRecipient(recipient: string): string {
  const at = recipient.lastIndexOf('@');
  if (at > 0) {
    const domain = recipient.slice(at + 1);
    return `${recipient[0]}***@${domain[0] ?? ''}***${domain.slice(domain.lastIndexOf('.'))}`;
  }
  return `${recipient.slice(0, 2)}***${recipient.slice(-4)}`;
}

export function log(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>): void {
  console[level === 'info' ? 'log' : level](JSON.stringify(fields));
}
