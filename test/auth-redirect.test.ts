import assert from 'node:assert/strict';
import test from 'node:test';
import { supabaseAuthRedirectUrl } from '../src/lib/auth-redirect';

test('keeps Supabase OAuth callback on the dedicated auth-check route', () => {
  assert.equal(
    supabaseAuthRedirectUrl('https://wear-log.vercel.app/best-match'),
    'https://wear-log.vercel.app/auth-check',
  );
});
