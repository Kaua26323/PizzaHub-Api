# ADR-002 — Authentication Session Policy

## Status

Accepted

## Context

PizzaHub uses short-lived JWT access tokens together with opaque rotating
refresh tokens persisted as hashed authentication sessions.

The authentication strategy must support browser and native clients while
avoiding persistent browser storage of refresh tokens.

## Decision

### Access token

- Lifetime: 15 minutes.
- Transport: JSON response.
- Client usage: Authorization Bearer header.
- Browser storage: application memory only.

### Refresh token

- Maximum session lifetime: 7 days.
- Rotation occurs on every successful refresh.
- Rotation does not extend the original absolute session expiration.
- PostgreSQL stores only the cryptographic token hash.

### Browser transport

The refresh token is stored in a cookie with:

- HttpOnly
- Secure in production
- SameSite=Strict
- Path=/
- No Domain attribute
- Max-Age matching the refresh-session expiration

Production cookie name:

\_\_Host-pizzahub_refresh

The refresh token must never be stored in browser localStorage or
sessionStorage.

### Native clients

Native clients must keep refresh credentials in platform-provided secure
storage or a securely managed cookie store.

### CSRF

Cookie-authenticated authentication requests use defense in depth:

- SameSite=Strict.
- Explicit CORS allowlist.
- Credentialed CORS requests never use Access-Control-Allow-Origin: \*.
- Browser requests to cookie-authenticated authentication endpoints must
  include the custom header:

  X-CSRF-Protection: 1

The server rejects cookie-authenticated browser requests that do not satisfy
the configured CSRF policy.

### Deployment

Web clients and the API should preferably be deployed under the same site,
for example:

app.pizzahub.com
api.pizzahub.com

If a future deployment requires truly cross-site cookies, the cookie and CSRF
policy must be reviewed before changing SameSite to None.
