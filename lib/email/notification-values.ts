export function deliveryTemplateKey(templateId: string, dedupeKey: string) {
  return `${templateId}::${dedupeKey}`.slice(0, 500);
}

export function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function dateTime(value: number | string | Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Denver' }).format(new Date(value));
}
