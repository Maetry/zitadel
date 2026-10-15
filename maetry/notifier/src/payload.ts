// Body of ZITADEL's HTTP email/SMS provider call (internal/notification/types/user_email.go,
// user_phone.go). Texts in templateData are already translated to the user's language and
// contain the code; args carry the raw values.
export interface TemplateData {
  title?: string;
  preHeader?: string;
  subject?: string;
  greeting?: string;
  text?: string;
  url?: string;
  buttonText?: string;
  primaryColor?: string;
  backgroundColor?: string;
  fontColor?: string;
  logoUrl?: string;
  fontFamily?: string;
  includeFooter?: boolean;
  footerText?: string;
}

export interface Notification {
  eventType: string;
  providerId: string;
  recipient: string;
  templateData: TemplateData;
}

export type Channel = 'email' | 'sms';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RECIPIENT_FIELD: Record<Channel, string> = {
  email: 'recipientEmailAddress',
  sms: 'recipientPhoneNumber',
};

export function parseNotification(body: string, channel: Channel): Notification | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isObject(json) || !isObject(json.contextInfo)) return null;
  const { contextInfo } = json;
  const recipient = contextInfo[RECIPIENT_FIELD[channel]];
  if (typeof recipient !== 'string' || recipient.trim() === '') return null;
  const templateData = isObject(json.templateData) ? json.templateData as TemplateData : {};
  const provider = isObject(contextInfo.provider) ? contextInfo.provider : {};
  return {
    eventType: typeof contextInfo.eventType === 'string' ? contextInfo.eventType : 'unknown',
    providerId: typeof provider.id === 'string' ? provider.id : 'unknown',
    recipient: recipient.trim(),
    templateData,
  };
}
