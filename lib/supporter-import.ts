export type ImportRow = { row: number; fullName: string; email: string; phone: string; address: Record<string, string>; tags: string[]; notes: string; historicalContributionCents: number; historicalContributionDate: string | null };
export type ImportError = { row: number; field: string; message: string };

export const supporterCsvTemplate = 'first_name,last_name,full_name,email,phone,address,city,state,zip,tags,notes,historical_contribution_amount,historical_contribution_date\r\nAvery,Reed,,avery@example.org,555-555-0100,123 Main St,Denver,CO,80202,"gala,returning",Met at the spring gala,1000.00,2026-04-15\r\n';

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim()));
}

export function validateSupporterCsv(text: string) {
  const parsed = parseCsv(text);
  if (!parsed.length) return { rows: [] as ImportRow[], errors: [{ row: 1, field: 'file', message: 'The CSV is empty.' }] as ImportError[] };
  const headers = parsed[0].map(value => value.trim().toLowerCase().replace(/[ /-]+/g, '_'));
  const supported = new Set(['first_name','last_name','full_name','email','phone','address','city','state','zip','zip_postal_code','tags','notes','historical_contribution_amount','historical_contribution_date']);
  const errors: ImportError[] = headers.flatMap((header, index) => header && !supported.has(header) ? [{ row: 1, field: header || `column_${index + 1}`, message: 'Unsupported column.' }] : []);
  if (!headers.includes('email')) errors.push({ row: 1, field: 'email', message: 'An email column is required.' });
  const value = (values: string[], name: string) => values[headers.indexOf(name)]?.trim() || '';
  const rows: ImportRow[] = [];
  parsed.slice(1).forEach((values, index) => {
    const number = index + 2;
    const email = value(values, 'email').toLowerCase();
    const first = value(values, 'first_name'), last = value(values, 'last_name');
    const fullName = value(values, 'full_name') || [first, last].filter(Boolean).join(' ');
    const amountText = value(values, 'historical_contribution_amount').replace(/[$,]/g, '');
    const amount = amountText ? Number(amountText) : 0;
    const dateText = value(values, 'historical_contribution_date');
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ row: number, field: 'email', message: 'Enter a valid email address.' });
    if (!fullName) errors.push({ row: number, field: 'name', message: 'Add a full name or first and last name.' });
    if (!Number.isFinite(amount) || amount < 0) errors.push({ row: number, field: 'historical_contribution_amount', message: 'Use a positive number.' });
    if (dateText && Number.isNaN(Date.parse(dateText))) errors.push({ row: number, field: 'historical_contribution_date', message: 'Use a valid date.' });
    rows.push({ row: number, fullName, email, phone: value(values, 'phone'), address: { address: value(values, 'address'), city: value(values, 'city'), state: value(values, 'state'), zip: value(values, 'zip') || value(values, 'zip_postal_code') }, tags: value(values, 'tags').split(/[;,]/).map(tag => tag.trim()).filter(Boolean), notes: value(values, 'notes'), historicalContributionCents: Number.isFinite(amount) ? Math.round(amount * 100) : 0, historicalContributionDate: dateText && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText).toISOString() : null });
  });
  return { rows, errors };
}
