import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route guard based on the lr_role cookie set at login.
 * This is a first layer of defense; DashboardLayout does the authoritative check.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get('lr_role')?.value;

  // Let auth pages, static assets, and API routes through
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // No role cookie yet → let client-side auth handle it
  if (!role) return NextResponse.next();

  // ── Staff: only /inventory, /inventory/*, /issues, /issues/*, /profile ──
  if (role === 'staff') {
    const allowed =
      pathname === '/inventory' ||
      pathname.startsWith('/inventory/') ||
      pathname === '/issues' ||
      pathname.startsWith('/issues/') ||
      pathname === '/profile';
    if (!allowed) {
      return NextResponse.redirect(new URL('/inventory', request.url));
    }
  }

  // ── Client: only /client/*, /inventory/{id}, /rentals/{id}, /profile ──
  if (role === 'client') {
    const allowed =
      pathname.startsWith('/client') ||
      pathname.startsWith('/inventory/') ||
      pathname.startsWith('/rentals/') ||
      pathname === '/profile';
    if (!allowed) {
      return NextResponse.redirect(new URL('/client/rentals', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
