# Week 31b: a signed-out admin on a second device can sign in again

Frozen 2026-10-28, before the change was written and before the test was
written.

## §0 What is wrong, measured

Found by the independent review of week 31, then measured on staging at
`9ed5749` with a disposable `w31-probe` admin
(`work/confession-app/probes/w31-loop.mjs`): sign in from two browsers, A
and B; sign out on A; open `/admin/login` on B. B gets
`net::ERR_TOO_MANY_REDIRECTS`, 19 hops of `307 /admin/login`, `307 /admin`.

Why: since week 9, signing out revokes every token of that admin
(`logged_out_before`). `requireAdminUserId` checks the signature, the row,
`disabled_at` and the revocation, and sends a failing request to
`/admin/login`. `/admin/login` checks the signature only (week 7 spec
§3.1) and sends a signed request to `/admin`. A revoked or disabled
admin's cookie passes the second check and fails the first, forever, until
the cookie expires (8 hours) or is cleared by hand. Every admin device but
the one that signed out is locked out of the sign-in page. It fails
closed: nothing is shown that should not be.

## §1 The change

1. `app/admin/_lib/auth.ts`: a new `adminUserIdFromCookie(db, raw)` holds the
   whole check `requireAdminUserId` makes today, in the same order, and
   returns the admin's id or `null` instead of redirecting.
   `requireAdminUserId` reads the cookie, calls it and redirects to
   `/admin/login` on `null`, so its behaviour is unchanged.
2. `app/admin/login/page.tsx`: redirects to `/admin` only when
   `adminUserIdFromCookie` returns an id. A revoked, disabled, unknown or
   forged cookie gets the sign-in form; signing in replaces the cookie.
3. `app/admin/layout.tsx`: the nav (week 31 §1.1) shows when
   `adminUserIdFromCookie` returns an id, so the sign-in page reached with a
   revoked cookie shows no nav either.

With no cookie, none of the three reads the database, as today.

## §2 Rejected

- **Clearing the cookie in the redirect.** A server component cannot set a
  cookie in Next 15; it would need a route handler in front of the sign-in
  page, a second path to the same form.
- **Keeping the sign-in page signature-only and making `/admin` not
  redirect there.** Every protected page would need a second "signed out"
  rendering.
- **Signature-only in the layout, the full check in the page.** The nav
  would show «تسجيل خروج» on the sign-in form for a revoked cookie, the
  defect week 31 §0.2 just removed.

## §3 Cost

`/admin/login` and the admin layout now read `admin_users` once each when a
cookie is presented. With the database down, the sign-in page answers 500
to a request carrying a cookie, where it used to render the form; a request
without one is unaffected.

## §4 Acceptance

Unit, against the test database, through `adminUserIdFromCookie`:

1. No cookie (`undefined`) returns `null`.
2. A value that is not a signed token, and a token signed with another
   secret, return `null`.
3. A valid token for a live administrator returns that administrator's id.
4. A valid token issued at or before that administrator's
   `logged_out_before` returns `null`; one issued after it returns the id.
5. A valid token for a disabled administrator returns `null`.
6. A valid token naming an id with no `admin_users` row returns `null`.
7. Source: `app/admin/login/page.tsx` and `app/admin/layout.tsx` each call
   `adminUserIdFromCookie`, and neither calls
   `verifyAdminSessionCookieValue` directly.

Live, on staging, by the build session (`probes/w31-loop.mjs`):

8. The §0 sequence: B's `/admin/login` answers 200 with the form and no
   nav; B's `/admin` answers one 307 to `/admin/login`; B can sign in again
   and reaches `/admin`.
