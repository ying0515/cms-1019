/** `returnUrl` after login: only same-app paths, since `//host` or `https://…` would leave the CMS. */
export function safeReturnUrl(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login')
    ? url
    : '/';
}
