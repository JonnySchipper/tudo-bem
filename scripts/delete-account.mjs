#!/usr/bin/env node
/**
 * Delete a player's account by email, for a request that comes in by email (team@playtudobem.com).
 *
 *   TB_ADMIN_PASSWORD=… node scripts/delete-account.mjs player@example.com
 *   TB_URL=http://localhost:8787 TB_ADMIN_PASSWORD=… node scripts/delete-account.mjs player@example.com
 *
 * It calls the running server (`POST /api/account/admin-delete`) instead of editing the database: the live
 * world holds profiles in memory and would write a deleted row straight back. Same cascade as the in-game
 * "Apagar conta" (account, sessions, profile, photos, owned academies and padarias, friend links, feedback,
 * moderation log). Five wrong admin passwords lock the endpoint for 15 minutes.
 */
const email = process.argv[2];
const base = (process.env.TB_URL || 'https://playtudobem.com').replace(/\/+$/, '');
const password = process.env.TB_ADMIN_PASSWORD;

if (!email || !email.includes('@')) {
  console.error('usage: TB_ADMIN_PASSWORD=… [TB_URL=…] node scripts/delete-account.mjs <email>');
  process.exit(2);
}
if (!password) {
  console.error('TB_ADMIN_PASSWORD is not set.');
  process.exit(2);
}

const res = await fetch(`${base}/api/account/admin-delete`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${password}` },
  body: JSON.stringify({ email }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || body.ok !== true) {
  console.error(`${res.status} ${body.en ?? body.code ?? 'failed'}`);
  process.exit(1);
}
console.log(`deleted ${email} on ${base}:`, JSON.stringify(body.deleted));
