export function supabaseAuthRedirectUrl(currentUrl: string): string {
  return new URL('/auth-check', currentUrl).toString();
}
