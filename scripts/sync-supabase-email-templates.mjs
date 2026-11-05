import { supabaseEmailConfig } from '../lib/email/templates.ts';

const projectRef = process.env.SUPABASE_PROJECT_REF || 'scodmyffdqwcgbkmcnid';
const rawAccessToken = process.env.SUPABASE_ACCESS_TOKEN;
const accessToken = rawAccessToken?.replace(/\s+/g, '');

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.local.');
  process.exit(1);
}

if (!/^[\x21-\x7e]+$/.test(accessToken)) {
  console.error('SUPABASE_ACCESS_TOKEN contains invalid characters. Copy the token again from Supabase.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const payload = supabaseEmailConfig();

const response = await fetch(endpoint, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const details = await response.text();
  console.error(`Supabase Auth config update failed (${response.status}): ${details}`);
  process.exit(1);
}

const verification = await fetch(endpoint, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

if (!verification.ok) {
  console.error(`Templates updated, but verification failed (${verification.status}).`);
  process.exit(1);
}

const remote = await verification.json();
const mismatches = Object.entries(payload)
  .filter(([key, value]) => remote[key] !== value)
  .map(([key]) => key);

if (mismatches.length) {
  console.error(`Verification mismatch for: ${mismatches.join(', ')}`);
  process.exit(1);
}

console.log(`Synced and verified ${Object.keys(payload).length / 2} Supabase email templates.`);
