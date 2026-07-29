# PizzaHub Architecture

## 1. Purpose

PizzaHub is a backend API for managing users, authentication sessions, product
catalogs, product images, and the complete pizzeria order workflow.

This document describes the current system organization, technical boundaries,
and high-level decisions. Detailed motivation and alternatives are recorded in
`docs/decisions/`.

Related documents:

- `docs/requirements.md` — functional and non-functional requirements.
- `docs/domain-model.md` — entities, invariants, and business policies.
- `docs/tasks.md` — implementation phases and traceability.
- `docs/decisions/` — Architecture Decision Records.

---

## 2. Goals

The architecture must:

- keep business rules independent from HTTP, PostgreSQL, and external libraries;
- make Domain and Application code testable without a running server;
- isolate raw SQL, authentication libraries, and file-system details;
- use explicit dependency injection;
- preserve valid order states and historical order information;
- expose stable authentication, upload, and HTTP contracts;
- avoid abstractions without a concrete need;
- allow technical adapters to be replaced without changing business rules.

---

## 3. Architectural Style

PizzaHub uses Clean Architecture:

```text
Presentation ─────→ Application ─────→ Domain
                         ↑
Infrastructure ─────────┘
```

The dependency direction always points toward the business rules.

Rules:

- Domain does not depend on Application, Infrastructure, or Presentation.
- Application may depend on Domain.
- Infrastructure implements contracts defined by Application.
- Presentation calls Application use cases.
- Controllers do not access PostgreSQL directly.
- Use cases do not know HTTP status codes.
- Raw SQL remains in Infrastructure.
- Domain does not import external frameworks or libraries.

SOLID principles guide focused responsibilities, small contracts,
substitutability, and dependency inversion. They must not justify abstractions
without a real boundary or requirement.

---

## 4. Layers

### 4.1 Domain

Contains the stable business model.

Main concepts:

```text
User, Category, Product, Order, OrderItem
Email, Money, Quantity, UserRole, OrderStatus
```

Responsibilities:

- define entities and value objects;
- protect invariants;
- control order transitions;
- preserve historical prices and notes;
- calculate item subtotals and order totals;
- define domain errors.

Examples of protected rules:

- orders start as `DRAFT`;
- only draft orders can change items;
- orders require at least one item before submission;
- only `IN_PREPARATION` orders can be completed;
- `DRAFT` and `IN_PREPARATION` orders can be cancelled;
- completed and cancelled orders are immutable;
- inactive products cannot be added to new orders;
- product changes do not alter historical order items.

Domain must not know about HTTP, PostgreSQL, SQL, routes, controllers,
environment variables, or storage paths.

### 4.2 Application

Contains use cases and contracts.

Responsibilities:

- coordinate Domain entities;
- enforce application-level authorization;
- define repository and service contracts;
- orchestrate workflows and persistence operations;
- return application results and errors.

Example use cases:

```text
RegisterUser, AuthenticateUser, RefreshAuthentication
ChangeUserRole, CreateCategory, CreateProduct
CreateOrder, AddOrderItem, SubmitOrder
CompleteOrder, CancelOrder
```

Repository contracts:

```text
UsersRepository
AuthSessionsRepository
CategoriesRepository
ProductsRepository
OrdersRepository
```

Service contracts:

```text
PasswordHasher
AccessTokenProvider
RefreshTokenGenerator
ImageStorage
```

Current implementations:

| Contract                 | Adapter           |
| ------------------------ | ----------------- |
| `PasswordHasher`         | bcrypt            |
| `AccessTokenProvider`    | `jose` + HS256    |
| `RefreshTokenGenerator`  | `node:crypto`     |
| `AuthSessionsRepository` | PostgreSQL        |
| `ImageStorage`           | Local file system |

Contracts are based on use-case needs rather than generic CRUD interfaces.

Application must not know HTTP objects, route paths, SQL strings, PostgreSQL
table names, `pg` clients, Busboy, or absolute storage paths.

### 4.3 Infrastructure

Contains technical implementations.

Responsibilities:

- configure the PostgreSQL pool;
- execute parameterized raw SQL;
- implement repositories;
- manage transactions and migrations;
- map rows to Domain/Application structures;
- hash passwords;
- generate and verify access tokens;
- generate opaque refresh tokens;
- persist authentication sessions;
- store and remove product images;
- validate environment configuration;
- run the administrator bootstrap command.

Initial components:

```text
PostgresUsersRepository
PostgresAuthSessionsRepository
PostgresCategoriesRepository
PostgresProductsRepository
PostgresOrdersRepository
BcryptPasswordHasher
JwtAccessTokenProvider
NodeRefreshTokenGenerator
LocalImageStorage
PostgreSQL pool
SQL migrations
Environment loader
Admin bootstrap command
```

PostgreSQL row types and absolute paths must not leave Infrastructure.

### 4.4 Presentation

Exposes the API through native `node:http`.

Responsibilities:

- start the server and match routes;
- parse route/query parameters and JSON bodies;
- parse multipart requests with Busboy;
- enforce request and upload limits;
- validate boundary input with Zod;
- authenticate and authorize requests;
- call use cases;
- serialize responses;
- map errors;
- serve product images through controlled routes.

Main components:

```text
Router, controllers, middleware pipeline
JSON parser, multipart parser, Zod schemas
Authentication and authorization middleware
Response helpers, central error handler
Image delivery route
```

Controllers remain thin. They do not execute SQL, instantiate repositories,
implement business rules, generate tokens, hash passwords, or persist files
directly.

---

## 5. Modules

### Identity

Responsible for registration, authentication, refresh sessions, profile,
user listing, role changes, and initial administrator bootstrap.

### Catalog

Responsible for categories, products, availability, image references, and
category filtering.

### Orders

Responsible for order creation, item management, preparation notes, repeated
products as distinct items, submission, completion, cancellation, filtering,
and history.

---

## 6. Request Flow

Example:

```text
PATCH /orders/:orderId/cancel
→ Router
→ Authentication middleware
→ CancelOrderController
→ CancelOrderUseCase
→ OrdersRepository
→ PostgresOrdersRepository
→ PostgreSQL
```

Responsibilities:

| Component              | Responsibility                      |
| ---------------------- | ----------------------------------- |
| Router                 | Select middleware and controller    |
| Middleware             | Shared transport concerns           |
| Controller             | Translate HTTP input/output         |
| Use case               | Coordinate the application workflow |
| Domain                 | Protect business rules              |
| Repository contract    | Describe persistence needs          |
| Infrastructure adapter | Execute SQL or technical work       |

---

## 7. Technology Stack

| Area               | Technology            |
| ------------------ | --------------------- |
| Runtime            | Node.js               |
| Language           | TypeScript            |
| HTTP               | Native `node:http`    |
| Database           | PostgreSQL            |
| Driver             | `pg`                  |
| Query approach     | Raw parameterized SQL |
| Validation         | Zod                   |
| Password hashing   | bcrypt                |
| Access tokens      | `jose` with HS256     |
| Refresh generation | `node:crypto`         |
| Multipart parsing  | Busboy                |
| Image storage      | Local file system     |
| Tests              | Vitest and Supertest  |
| Configuration      | dotenv + Zod          |
| Development        | Docker Compose        |
| Quality            | ESLint and Prettier   |

Boundaries:

- `pg` is imported only by Infrastructure.
- Busboy belongs to Presentation.
- bcrypt and `jose` remain behind Application contracts.
- Domain does not import Zod.
- Application receives typed configuration instead of reading `process.env`.
- Dynamic SQL values always use PostgreSQL parameters.

---

## 8. Persistence

### 8.1 PostgreSQL Model

Main relationships:

```text
User 1 ─── N Order
User 1 ─── N AuthSession
Category 1 ─── N Product
Order 1 ─── N OrderItem
Product 1 ─── N OrderItem
```

PostgreSQL provides keys, constraints, transactions, indexes, joins, and row
locking.

### 8.2 Raw SQL

No ORM is used. SQL remains inside Infrastructure repositories.

```sql
SELECT id, name, email
FROM users
WHERE email = $1;
```

Unsafe string concatenation is prohibited.

### 8.3 Connection Pool

The pool is created once during startup and reused. A new connection is not
created for every request.

### 8.4 Transactions

A transaction uses the same client from `BEGIN` to `COMMIT` or `ROLLBACK`, then
releases it.

A formal Unit of Work abstraction is not part of the initial implementation.

### 8.5 Migrations

Schema changes use versioned SQL files under `database/migrations/`.

Each migration must be reproducible, ordered, and version controlled.

### 8.6 Database Constraints

PostgreSQL reinforces rules where appropriate:

```text
Unique user email
Unique category name
Positive prices and quantities
Valid foreign keys and required fields
Valid enum values
Unique refresh-token hashes
```

Constraints complement Domain validation.

### 8.7 Historical Orders

Each `OrderItem` preserves:

```text
productId, productName, unitPrice, quantity, notes
```

Product changes do not alter previous orders.

The database must not enforce uniqueness on `(order_id, product_id)` because
the same product may appear in distinct items.

---

## 9. Concurrency

Detailed decision: `docs/decisions/ADR-004-concurrency.md`.

The initial isolation level is PostgreSQL `READ COMMITTED`.

### Order Transitions

Complete and cancel operations use atomic conditional updates:

```text
Complete: IN_PREPARATION → COMPLETED
Cancel: DRAFT | IN_PREPARATION → CANCELLED
```

The expected source status is part of the `WHERE` clause.

A zero-row update means the order was not found or its current state no longer
allows the transition.

Simultaneous complete and cancel operations against the same order cannot both
succeed.

### Order Aggregate Changes

Adding, updating, or removing items and submitting an order run inside a
transaction.

The workflow locks the order row:

```sql
SELECT ...
FROM orders
WHERE id = $1
FOR UPDATE;
```

Locks are acquired in this order:

```text
1. orders
2. order_items
```

### Refresh Rotation

The matching `auth_sessions` row is locked with `FOR UPDATE` inside one
transaction.

Only one rotation may succeed for the same session. Different sessions may
refresh concurrently.

The successor preserves the same `token_family_id` and original absolute
`expires_at`.

Reuse of a rotated token rejects the request and revokes the family.

Not used initially:

```text
Global locks, table locks, Redis locks
Advisory locks, version columns, SERIALIZABLE
```

---

## 10. Authentication and Authorization

Detailed decisions:

```text
docs/decisions/ADR-001-jwt.md
docs/decisions/ADR-002-auth-session.md
```

### 10.1 Strategy

```text
Short-lived JWT access token
+
Opaque rotating refresh token
+
PostgreSQL authentication session
```

### 10.2 Access Token

```text
Library: jose
Algorithm: HS256
Lifetime: 15 minutes
Transport: JSON response
Usage: Authorization: Bearer <token>
Browser storage: application memory
```

Required claims:

```text
sub, role, iss, aud, iat, exp, jti
iss = pizzahub-api
aud = pizzahub-clients
```

JWTs must not contain passwords, hashes, refresh tokens, or unnecessary
sensitive data.

### 10.3 Refresh Session

```text
Lifetime: 7 days maximum
Expiration: absolute
Rotation: every successful refresh
Persistence: SHA-256 token hash
Browser storage: HttpOnly cookie
Native clients: secure platform storage
```

Rotation does not extend the original expiration.

### 10.4 Browser Cookie and CSRF

Production cookie:

```text
Name: __Host-pizzahub_refresh
HttpOnly: true
Secure: true
SameSite: Strict
Path: /
Domain: omitted
Max-Age: remaining session lifetime
```

Cookie-authenticated browser operations require:

```text
SameSite=Strict
Explicit CORS allowlist
X-CSRF-Protection: 1
```

Credentialed CORS must never use `Access-Control-Allow-Origin: *`.

The allowed origin comes from `WEB_ORIGIN`.

### 10.5 Authorization

Roles:

```text
ADMIN
STAFF
```

`STAFF` manages the operational order workflow and views the catalog.

`ADMIN` includes STAFF permissions and also manages users, categories, and
products.

Protected use cases verify authorization internally. Route middleware alone is
not sufficient.

An administrator cannot change their own role.

### 10.6 Initial Administrator

The first administrator is created with:

```text
npm run bootstrap:admin
```

The command is not an HTTP endpoint. It validates input, hashes the password,
rejects duplicate email, avoids hard-coded credentials, and returns a non-zero
status on failure.

### 10.7 Deferred Features

Outside the initial scope:

```text
Password change
User activation/deactivation
Administrator revocation of another user's sessions
System-wide administrator logout
```

When password changes or deactivation are introduced, affected refresh sessions
must be revoked.

---

## 11. HTTP Design

### 11.1 Native Server

The API uses `node:http` without Express or Fastify.

Only the required features are implemented:

```text
Router and parameters
JSON parser
Multipart integration
Middleware pipeline
Central error handling
Authentication and authorization
Response helpers
```

PizzaHub does not attempt to build a general-purpose framework.

### 11.2 Controllers

Controllers read validated input, read authentication context, call one use
case, and serialize the result.

They do not execute SQL, create repositories, contain reusable business logic,
generate tokens, or hash passwords.

### 11.3 Response Contract

Detailed decision: `docs/decisions/ADR-005-http-contract.md`.

Success:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Success with metadata:

```json
{
  "success": true,
  "data": [],
  "meta": {},
  "error": null
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Human-readable explanation."
  }
}
```

Conceptual TypeScript contract:

```ts
export type ApiResponse<TData, TMeta = never> =
  | {
      success: true;
      data: TData;
      meta?: TMeta;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: ApiError;
    };

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}
```

Clients use `error.code` for programmatic decisions.

The HTTP status is authoritative and is not duplicated in `ApiError`.

### 11.4 Status Mapping

| Status | Use                                                  |
| ------ | ---------------------------------------------------- |
| 200    | Read, update, login, refresh, workflow action        |
| 201    | Resource creation                                    |
| 204    | Success without body                                 |
| 400    | Validation or malformed input                        |
| 401    | Missing or invalid authentication                    |
| 403    | Insufficient permission                              |
| 404    | Route or resource not found                          |
| 409    | Uniqueness, state, deletion, or concurrency conflict |
| 413    | Request or file too large                            |
| 415    | Unsupported content or image type                    |
| 500    | Unexpected internal error                            |

A `204` response has no JSON body.

Successful image delivery returns binary content. Image errors use the normal
JSON error contract.

Public errors never expose stack traces, SQL, database internals, absolute
paths, environment variables, credentials, tokens, or session metadata.

---

## 12. Product Images

Detailed decision: `docs/decisions/ADR-003-product-image-upload.md`.

### 12.1 Upload Policy

```text
Multipart field: image
Maximum files: 1
Allowed: image/jpeg, image/png, image/webp
Maximum: 5 MiB (5,242,880 bytes)
Temporary: uploads/tmp/products/
Permanent: uploads/products/
```

Other formats are outside the initial allowlist.

### 12.2 Validation

The upload boundary validates:

- declared MIME type;
- file-content signature;
- file size;
- expected field and file count;
- server-generated file name;
- extension derived from validated content.

Client-provided names, extensions, paths, and MIME values are not trusted.

Image resizing and normalization are future considerations.

### 12.3 Responsibilities

```text
Busboy → parses multipart HTTP streams
ImageStorage → stores and removes files
```

Busboy belongs to Presentation. `LocalImageStorage` belongs to Infrastructure.

The storage contract returns:

```text
key, mimeType, size
```

### 12.4 Database Representation

PostgreSQL stores:

```text
image_key
image_mime_type
image_size
```

It does not store the binary, absolute path, or permanent public URL.

Presentation converts `imageKey` into a delivery URL.

### 12.5 Cleanup

Partial and temporary files are removed when parsing, validation, transport,
use-case, or database operations fail.

Create product:

```text
Store image
→ persist product
→ delete new image if persistence fails
```

Replace image:

```text
Store new image
→ update PostgreSQL
→ delete old image after success
```

The old image is not removed before the database update succeeds.

### 12.6 Delivery

Images are served through:

```text
GET /images/products/:imageKey
```

The route rejects traversal and arbitrary paths.

A persistent Docker volume keeps files across container recreation.

Object storage may later replace `LocalImageStorage` without changing
Application or Domain.

---

## 13. Validation and Configuration

### Presentation Validation

Zod validates JSON bodies, route/query parameters, multipart fields, upload
metadata, and environment variables.

Raw Zod errors are mapped to the stable HTTP error contract.

### Domain Validation

Domain entities and value objects independently protect business invariants.

A transport-valid value may still be rejected by Domain.

### Environment Configuration

Environment variables are loaded once and validated at startup.

Application receives typed configuration objects.

Relevant variables:

```text
PORT
DATABASE_URL
JWT_ACCESS_SECRET
JWT_ISSUER
JWT_AUDIENCE
ACCESS_TOKEN_TTL_SECONDS
REFRESH_TOKEN_TTL_SECONDS
WEB_ORIGIN
UPLOAD_TEMP_DIRECTORY
UPLOAD_DIRECTORY
MAX_UPLOAD_SIZE
```

---

## 14. Money

The currency is United States Dollar (`USD`).

PostgreSQL persists amounts as canonical decimal strings with exactly two
fractional digits:

```text
Valid: "5.00", "45.90", "120.00"
Invalid: "45.9", "$45.90", "45,90", negative values
```

Domain and Application must not rely on unsafe JavaScript floating-point
arithmetic.

Infrastructure converts between persistence strings and Domain `Money`.

---

## 15. Testing

### Domain Unit Tests

Vitest tests entities and value objects without HTTP or PostgreSQL.

Important cases include order lifecycle, repeated products, notes,
immutability, and historical prices.

### Application Unit Tests

Vitest tests use cases using in-memory repositories and service adapters.

### Infrastructure Integration Tests

Vitest tests PostgreSQL repositories, SQL, constraints, transactions,
concurrency, token rotation, cryptography adapters, local storage, and
migrations.

### HTTP Tests

Supertest tests routing, parsing, validation, authentication, authorization,
status codes, envelopes, uploads, image delivery, and error mapping.

Domain and Application tests must run without PostgreSQL.

---

## 16. Project Structure

```text
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── enums/
│   └── errors/
├── application/
│   ├── use-cases/
│   ├── repositories/
│   ├── services/
│   └── errors/
├── infrastructure/
│   ├── database/postgres/
│   ├── authentication/
│   ├── cryptography/
│   ├── storage/
│   └── config/
├── presentation/http/
│   ├── controllers/
│   ├── routes/
│   ├── middlewares/
│   ├── parsers/
│   ├── validation/
│   ├── responses/
│   └── errors/
└── main/
    ├── dependencies/
    ├── config/
    ├── scripts/
    └── server.ts

database/
└── migrations/

uploads/
├── tmp/products/
└── products/

tests/
├── unit/
├── integration/
└── http/
```

Folders may evolve, but layer boundaries must remain stable.

Runtime uploads are not committed to Git.

---

## 17. Dependency Assembly

Concrete dependencies are assembled only in `main`.

```text
PostgreSQL pool
→ PostgresOrdersRepository
→ CancelOrderUseCase
→ CancelOrderController
→ HTTP route
```

Controllers and use cases receive dependencies explicitly.

No dependency injection framework is required initially.

---

## 18. Current Decisions

| Area                 | Decision                                                   |
| -------------------- | ---------------------------------------------------------- |
| Architecture         | Clean Architecture                                         |
| HTTP                 | Native `node:http`                                         |
| Persistence          | PostgreSQL, `pg`, raw SQL                                  |
| Validation           | Zod at boundaries                                          |
| Password hashing     | bcrypt                                                     |
| Access token         | `jose`, HS256, 15 minutes                                  |
| Refresh session      | Rotating opaque token, PostgreSQL, 7-day absolute lifetime |
| Browser storage      | Access token in memory, refresh token in HttpOnly cookie   |
| CSRF                 | Strict cookie, explicit CORS origin, custom header         |
| Upload parser        | Busboy                                                     |
| Image storage        | Persistent local storage behind `ImageStorage`             |
| Image policy         | JPEG/PNG/WebP, one file, maximum 5 MiB                     |
| Concurrency          | READ COMMITTED, conditional updates, row locks             |
| HTTP contract        | Discriminated success/error envelope                       |
| Currency             | USD canonical decimal strings                              |
| Administrator        | Controlled bootstrap command                               |
| Order items          | Repeated products remain distinct                          |
| Notes                | Optional, trimmed, maximum 500 characters                  |
| Testing              | Vitest and Supertest                                       |
| Dependency injection | Manual                                                     |
| ORM                  | None                                                       |
| Redis                | Not used initially                                         |

---

## 19. Architecture Decision Records

| ADR                                                  | Decision                      |
| ---------------------------------------------------- | ----------------------------- |
| [ADR-001](decisions/ADR-001-jwt.md)                  | JWT library and algorithm     |
| [ADR-002](decisions/ADR-002-auth-session.md)         | Authentication session policy |
| [ADR-003](decisions/ADR-003-product-image-upload.md) | Product image upload policy   |
| [ADR-004](decisions/ADR-004-concurrency.md)          | Persistence concurrency       |
| [ADR-005](decisions/ADR-005-http-contract.md)        | HTTP response contract        |

ADRs contain detailed motivation, alternatives, and consequences. This
document contains only the current high-level architecture.

---

## 20. Constraints

- Controllers do not access PostgreSQL directly.
- Routes and controllers do not contain business rules.
- Use cases do not know HTTP status codes.
- Domain does not import Infrastructure or Presentation.
- Raw SQL remains inside Infrastructure.
- PostgreSQL rows are mapped before leaving Infrastructure.
- Dynamic SQL values use parameters.
- Contracts remain focused on use-case needs.
- Protected use cases verify authorization internally.
- An administrator cannot change their own role.
- Passwords, hashes, and tokens are never logged.
- Refresh tokens are never persisted in plain text.
- Browser refresh tokens do not use `localStorage` or `sessionStorage`.
- JWTs verify algorithm, issuer, and audience.
- Refresh rotation preserves absolute expiration.
- Credentialed CORS uses an explicit allowlist.
- Different sessions can refresh concurrently.
- Complete and cancel cannot both succeed for the same order.
- Uploaded names, extensions, MIME values, and paths are not trusted.
- Images match allowed signatures and do not exceed 5 MiB.
- Partial and compensating cleanup is mandatory.
- PostgreSQL stores image references, not binaries.
- Images survive container recreation through a volume.
- Completed and cancelled orders are immutable.
- `(order_id, product_id)` is not unique.
- Order-item notes are validated and preserved.
- Domain and Application tests run without PostgreSQL.
- New dependencies preserve the dependency direction.

---

## 21. Open Decisions

The following may be decided later:

```text
API documentation tooling
Structured logging
Rate limiting
Image resizing or normalization
Production object storage
CI/CD
Hosting and reverse proxy
Monitoring and observability
```

Future decisions must preserve current boundaries and contracts.
