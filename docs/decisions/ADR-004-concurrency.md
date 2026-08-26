# ADR-004 — Persistence Concurrency

## Status

Accepted

## Decision

PizzaHub uses PostgreSQL READ COMMITTED isolation together with
workflow-specific row concurrency control.

### Order status transitions

Terminal order transitions use atomic conditional updates.

A transition succeeds only when the persisted current status matches
the expected source status.

Completion requires:

IN_PREPARATION → COMPLETED

Cancellation requires:

DRAFT | IN_PREPARATION → CANCELLED

A zero-row update means the transition did not occur.

### Order aggregate modifications

Operations that add, update, or remove order items and operations that
submit an order must run inside a transaction.

They must lock the order row with SELECT ... FOR UPDATE before reading
or modifying its order items.

All workflows acquire locks in this order:

1. orders
2. order_items

### Refresh-token rotation

Refresh-token rotation runs inside one database transaction.

The presented auth_sessions row is selected with FOR UPDATE.

The transaction:

1. validates the current session;
2. revokes the current token;
3. creates one successor session;
4. preserves token_family_id;
5. preserves the original absolute expires_at;
6. commits both changes atomically.

Only one non-revoked session may exist per token family.

### Reuse detection

Presentation of an already rotated refresh token is considered token reuse.

The request is rejected and every session in that token family is revoked.

### Isolation

The initial implementation uses PostgreSQL READ COMMITTED.

Serializable isolation, advisory locks, Redis locks, and aggregate version
columns are not part of the initial implementation.
