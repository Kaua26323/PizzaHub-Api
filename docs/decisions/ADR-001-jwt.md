# ADR-001 — JWT Access Tokens

## Decision

- Library: jose
- Algorithm: HS256
- Issuer: pizzahub-api
- Audience: pizzahub-clients

## Reason

The application has a single backend responsible for signing
and validating access tokens.

## Consequences

The jose dependency remains isolated behind AccessTokenProvider.
