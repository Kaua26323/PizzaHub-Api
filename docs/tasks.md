# PizzaHub Implementation Tasks

## Purpose

This document converts the approved PizzaHub requirements, domain model, and architecture into small, dependency-ordered implementation tasks.

The task list covers the initial backend scope only. It intentionally excludes:

- Password-change workflow.
- User-account activation and deactivation.
- Administrator-initiated revocation of another user's sessions.
- System-wide administrator logout.
- Structured product ingredients, additions, removals, and price-changing customizations.
- Production cloud/object storage.

## Task notation

- `[ ]` — not started.
- `[x]` — completed.
- `[P]` — may be implemented in parallel after its dependencies are complete.
- `Depends on` — direct prerequisite tasks.
- `Covers` — requirements or architecture decisions primarily addressed.
- `Verify` — observable completion criteria.
- `ADR-xxx` — the Architecture Decision Record that defines a decision in detail.

Architecture topics and ADR identifiers are preferred over fragile numeric
section references so the task plan remains valid when the main architecture
document is reorganized.

A task should be marked complete only when its implementation, tests, and
directly affected documentation are finished.

## Global Definition of Done

Every completed implementation task must satisfy the following rules when applicable:

1. TypeScript typechecking passes.
2. ESLint and formatting checks pass.
3. Relevant unit, integration, or HTTP tests pass.
4. New dynamic SQL values use parameters.
5. No password, hash, access token, refresh token, or sensitive upload data is logged.
6. Domain and Application layers do not import Presentation or Infrastructure.
7. Controllers remain thin and do not access PostgreSQL or the file system directly.
8. Application use cases do not know HTTP status codes.
9. JSON success and error responses follow the standard discriminated HTTP
   envelope, except for `204 No Content` and successful binary image delivery.
10. Current-scope documentation and directly related ADRs remain consistent
    with the implementation.

## Recommended implementation order

Complete phases in order. Tasks marked `[P]` can run in parallel only after their listed dependencies are complete.

## Requirements traceability

| Requirement group                         | Primary phases                                      |
| ----------------------------------------- | --------------------------------------------------- |
| FR01–FR15 — Authentication and users      | 4, 7, 8, 10, 13                                     |
| FR16–FR19 — Categories                    | 5, 7, 11, 13                                        |
| FR20–FR26 — Products                      | 5, 7, 8, 11, 13                                     |
| FR27–FR42 — Orders and order items        | 6, 7, 12, 13                                        |
| BR01–BR37 — Business rules                | 2–13 according to module                            |
| NFR01–NFR13 — Non-functional requirements | 0, 1, 7–13                                          |
| Future considerations                     | Explicitly excluded from the initial implementation |

## Critical implementation notes

- **Money:** PostgreSQL persists canonical USD decimal strings, but Domain calculations must remain exact and must not rely on unsafe JavaScript floating-point arithmetic.
- **Refresh tokens:** only deterministic hashes are persisted. Rotation and
  reuse detection are atomic, lock only the matching authentication session,
  and allow different sessions to refresh concurrently.
- **Product images:** only JPEG, PNG, and WebP are initially accepted, with a
  maximum size of 5 MiB. The declared MIME type and file-content signature are
  validated. The file system and PostgreSQL do not share one transaction, so
  create and update workflows use compensating cleanup.
- **HTTP contract:** JSON responses use the discriminated success/error
  envelope. `204 No Content` and successful binary image delivery are the
  documented exceptions.
- **Order items:** every add-item request creates a distinct item. Do not add a
  unique constraint on `(order_id, product_id)`.
- **Order concurrency:** complete and cancel requests must not both succeed
  against the same order state. Item changes and submission lock the related
  order row.
- **Role changes:** an administrator cannot change their own role.
- **Authorization:** route middleware improves transport security, but
  protected use cases must also enforce critical permissions.

## Phase 0 — Planning checkpoint

Freeze the implementation baseline and resolve the few technology choices that must be known before their related phase.

- [x] **T001** — Place the approved requirements, domain model, architecture, and task plan under version control
  - **Depends on:** none
  - **Covers:** Planning baseline
  - **Likely files:** `docs/requirements.md`, `docs/domain-model.md`, `docs/architecture.md`, `docs/tasks.md`
  - **Verify:**
    - The repository contains one clearly named current version of each planning document.

- [x] **T002** — Record the initial-scope exclusions in the task plan and README
  - **Depends on:** T001
  - **Covers:** Requirements §8; Domain §12; Architecture — Deferred Authentication Features; Architecture — Open Decisions
  - **Likely files:** `docs/tasks.md`, `README.md`
  - **Verify:**
    - Password change, user deactivation, administrative session revocation, system-wide logout, structured ingredients and cloud storage.

- [x] **T003** — Select the JWT library and signing algorithm and document the decision
  - **Depends on:** T001
  - **Covers:** Architecture — Authentication; ADR-001
  - **Likely files:** `docs/decisions/ADR-001-jwt.md`, `package.json`
  - **Verify:**
    - `jose` remains behind `AccessTokenProvider`.
    - `HS256`, issuer, audience, and required claims are documented.
    - The selected secret policy is documented.

- [x] **T004** — Define access-token lifetime, refresh-token lifetime, refresh-token transport, and cookie policy
  - **Depends on:** T001
  - **Covers:** FR03–FR07; Architecture — Authentication and Authorization; ADR-002
  - **Likely files:** `docs/decisions/ADR-002-auth-session.md`, `.env.example`
  - **Verify:**
    - Access tokens expire after 15 minutes.
    - Refresh sessions have a 7-day absolute lifetime that rotation does not extend.
    - Browser and native-client storage policies are documented.
    - Browser refresh tokens are not stored in `localStorage` or `sessionStorage`.
    - Cookie flags, explicit CORS origin, CSRF header, logout, and reuse behavior are documented.

- [x] **T005** — Define the initial upload policy
  - **Depends on:** T001
  - **Covers:** NFR08; Architecture — Product Images; ADR-003
  - **Likely files:** `docs/decisions/ADR-003-product-image-upload.md`, `.env.example`
  - **Verify:**
    - JPEG, PNG, and WebP are the only initially accepted formats.
    - The maximum image size is 5 MiB (5,242,880 bytes).
    - Temporary and permanent directories are documented.
    - Declared MIME type and file-content signature validation are required.
    - Server-generated names and extensions are required.
    - Temporary cleanup and compensating cleanup behavior are documented.

- [x] **T006** — Define persistence concurrency rules for order transitions and refresh-token rotation
  - **Depends on:** T001
  - **Covers:** Architecture — Concurrency; ADR-004
  - **Likely files:** `docs/decisions/ADR-004-concurrency.md`
  - **Verify:**
    - Complete and cancel transitions use conditional updates.
    - Order item changes and submission lock the related order row.
    - Refresh rotation locks only the matching authentication-session row.
    - Different authentication sessions may refresh concurrently.
    - Simultaneous complete/cancel and simultaneous refresh requests against the
      same persisted state cannot both succeed incorrectly.
    - Refresh reuse revokes the affected token family.

- [x] **T007** — Define the standard HTTP success and error envelopes
  - **Depends on:** T001
  - **Covers:** NFR06; Architecture — HTTP Design; ADR-005
  - **Likely files:** `docs/decisions/ADR-005-http-contract.md`
  - **Verify:**
    - Success uses `success: true`, `data`, optional `meta`, and `error: null`.
    - Errors use `success: false`, `data: null`, and a stable `ApiError`.
    - Validation, authentication, authorization, not-found, conflict, upload,
      and unexpected errors have stable codes and response shapes.
    - Clients rely on `error.code`, not exact message text.
    - HTTP status is not duplicated inside `ApiError`.
    - `204 No Content` and successful binary image delivery are documented exceptions.

- [x] **T008** — Create a requirements-to-phase traceability table
  - **Depends on:** T001
  - **Covers:** FR01–FR42; BR01–BR37; NFR01–NFR13
  - **Likely files:** `docs/tasks.md`
  - **Verify:**
    - Every current functional requirement maps to at least one implementation phase.
    - Future considerations are marked as excluded.

## Phase 1 — Project foundation

Prepare the TypeScript, testing, environment, Docker, and folder foundations.

- [x] **T009** — Initialize package metadata and development scripts
  - **Depends on:** T001
  - **Covers:** Architecture — Technology Stack
  - **Likely files:** `package.json`
  - **Verify:**
    - Scripts exist for development, build, start, typecheck, lint, format, test, test:unit, test:integration, test:http, and bootstrap:admin.

- [x] **T010** — Configure strict TypeScript compilation
  - **Depends on:** T009
  - **Covers:** Architecture — Technology Stack; Architecture — Project Structure
  - **Likely files:** `tsconfig.json`, `tsconfig.build.json`
  - **Verify:**
    - Strict mode is enabled.
    - Build output excludes tests and runtime uploads.

- [x] **T011** [P] — Configure ESLint and Prettier with separate responsibilities
  - **Depends on:** T009
  - **Covers:** Architecture — Technology Stack
  - **Likely files:** `eslint.config.js`, `.prettierrc`, `.prettierignore`
  - **Verify:**
    - Linting checks code quality.
    - Prettier owns formatting without duplicated formatting rules in ESLint.

- [x] **T012** — Configure Vitest for unit, integration, and HTTP test projects
  - **Depends on:** T009, T010
  - **Covers:** Architecture — Testing
  - **Likely files:** `vitest.config.ts`, `tests/setup/`
  - **Verify:**
    - Unit tests can run without PostgreSQL.
    - Integration and HTTP tests can use dedicated setup files.c

- [x] **T013** — Create the initial Clean Architecture folder structure
  - **Depends on:** T010
  - **Covers:** Architecture — Project Structure
  - **Likely files:** `src/domain/`, `src/application/`, `src/infrastructure/`, `src/presentation/`, `src/main/`, `database/migrations/`, `tests/`
  - **Verify:**
    - No layer imports an outer layer in the starter structure.

- [x] **T014** — Implement typed environment loading and startup validation
  - **Depends on:** T009, T010
  - **Covers:** Architecture — Validation and Configuration
  - **Likely files:** `src/infrastructure/config/environment.ts`, `.env.example`
  - **Verify:**
    - Environment variables are read once.
    - JWT issuer/audience, token TTLs, web origin, upload directories, and
      maximum upload size are validated.
    - Allowed image MIME types remain fixed application policy rather than
      environment-controlled values.
    - Invalid or missing required values fail startup with a clear message.

- [x] **T015** [P] — Configure repository ignore rules
  - **Depends on:** T013
  - **Covers:** Architecture — Project Structure; Architecture — Constraints
  - **Likely files:** `.gitignore`
  - **Verify:**
    - .env files, build output, coverage, PostgreSQL data, temporary uploads, and generated product images are ignored.
    - Empty runtime directories are retained only through placeholder files when needed.

- [x] **T016** — Create Dockerfile and Docker Compose development services
  - **Depends on:** T009, T014
  - **Covers:** Architecture — Technology Stack; Architecture — Product Images
  - **Likely files:** `Dockerfile`, `docker-compose.yml`
  - **Verify:**
    - API and PostgreSQL services start.
    - PostgreSQL and product images use separate persistent volumes.
    - The upload directory survives API container recreation.

- [x] **T017** — Create the initial SQL migration execution workflow
  - **Depends on:** T009, T014
  - **Covers:** Architecture — Persistence
  - **Likely files:** `scripts/migrate.ts`, `package.json`, `database/migrations/`
  - **Verify:**
    - Migrations execute in sequence.
    - A failed migration stops execution and returns a non-zero status.

- [x] **T018** — Create a minimal build and startup smoke test
  - **Depends on:** T010, T013, T014
  - **Likely files:** `src/main/server.ts`, `tests/smoke/build.test.ts`
  - **Verify:**
    - The project typechecks and builds before business implementation begins.

## Phase 2 — Domain model

Implement business concepts and invariants without HTTP, PostgreSQL, or external libraries.

- [x] **T019** [P] — Implement UserRole and OrderStatus enumerations
  - **Depends on:** T013
  - **Covers:** Domain §4
  - **Likely files:** `src/domain/enums/user-role.ts`, `src/domain/enums/order-status.ts`
  - **Verify:**
    - Only ADMIN/STAFF and DRAFT/IN_PREPARATION/COMPLETED/CANCELLED are representable.

- [x] **T020** [P] — Implement focused domain error types
  - **Depends on:** T013
  - **Covers:** Architecture — Domain; Architecture — HTTP Design; ADR-005
  - **Likely files:** `src/domain/errors/`
  - **Verify:**
    - Errors describe invalid business state without HTTP status codes.

- [x] **T021** — Implement the Email value object
  - **Depends on:** T020
  - **Covers:** Domain §3.1
  - **Likely files:** `src/domain/value-objects/email.ts`
  - **Verify:**
    - Email format is validated.
    - Comparison uses normalized values.
    - Invalid email construction fails.

- [x] **T022** — Implement the Money value object with exact USD arithmetic
  - **Depends on:** T020
  - **Covers:** BR15; BR15A; BR15B; Domain §3.2; Architecture — Money
  - **Likely files:** `src/domain/value-objects/money.ts`
  - **Verify:**
    - Canonical strings always contain two fractional digits.
    - Addition and multiplication do not use unsafe binary floating-point arithmetic.
    - Persistence input and output use values such as "45.90".

- [ ] **T023** — Implement the Quantity value object
  - **Depends on:** T020
  - **Covers:** BR14; Domain §3.3
  - **Likely files:** `src/domain/value-objects/quantity.ts`
  - **Verify:**
    - Only positive integers are accepted.

- [ ] **T024** — Implement the User entity
  - **Depends on:** T019, T020, T021
  - **Covers:** FR09–FR13; BR16; BR30; Domain §2.1
  - **Likely files:** `src/domain/entities/user.ts`
  - **Verify:**
    - The entity stores passwordHash rather than a plain-text password.
    - Only valid roles are accepted.
    - Self-role-change rules can be enforced by the application workflow.

- [ ] **T025** [P] — Implement the Category entity
  - **Depends on:** T020
  - **Covers:** FR16–FR19; BR02; BR17; Domain §2.2
  - **Likely files:** `src/domain/entities/category.ts`
  - **Verify:**
    - Empty names are rejected.
    - Rename behavior preserves entity validity.

- [ ] **T026** — Implement the Product entity
  - **Depends on:** T019, T020, T022
  - **Covers:** FR20–FR26; BR03; BR15; BR26–BR29; Domain §2.3
  - **Likely files:** `src/domain/entities/product.ts`
  - **Verify:**
    - Price is positive.
    - imageKey is storage-neutral.
    - Activation and deactivation are explicit behaviors.
    - Category and image metadata are required.

- [ ] **T027** — Implement the OrderItem entity
  - **Depends on:** T020, T022, T023
  - **Covers:** FR29–FR33; BR18; BR31–BR37; Domain §2.5
  - **Likely files:** `src/domain/entities/order-item.ts`
  - **Verify:**
    - productName and unitPrice snapshots are preserved.
    - Notes are trimmed, empty notes become null, and length is limited to 500.
    - Quantity and subtotal rules are enforced.

- [ ] **T028** — Implement the Order aggregate
  - **Depends on:** T019, T020, T022, T027
  - **Covers:** FR27–FR42; BR06A–BR13; Domain §2.4; Domain §6.1; Domain §7
  - **Likely files:** `src/domain/entities/order.ts`
  - **Verify:**
    - New orders start in DRAFT.
    - tableNumber is required and customerName is optional.
    - Each add operation creates a distinct OrderItem.
    - Status transitions and terminal-state immutability are enforced.
    - Totals use historical item prices.

- [ ] **T029** — Write unit tests for Email, Money, and Quantity
  - **Depends on:** T021, T022, T023
  - **Covers:** NFR09; Architecture — Testing
  - **Likely files:** `tests/unit/domain/value-objects/`
  - **Verify:**
    - Valid, invalid, boundary, normalization, and exact-arithmetic cases are covered.

- [ ] **T030** — Write unit tests for User, Category, and Product
  - **Depends on:** T024, T025, T026
  - **Covers:** NFR09; Architecture — Testing
  - **Likely files:** `tests/unit/domain/entities/`
  - **Verify:**
    - passwordHash, role, category-name, price, image, and availability invariants are covered.

- [ ] **T031** — Write exhaustive unit tests for Order and OrderItem
  - **Depends on:** T027, T028
  - **Covers:** BR07–BR14; BR31–BR37; NFR09; Architecture — Testing
  - **Likely files:** `tests/unit/domain/entities/order.test.ts`, `tests/unit/domain/entities/order-item.test.ts`
  - **Verify:**
    - Repeated products remain distinct.
    - Notes rules are covered.
    - All valid and invalid transitions are covered.
    - Completed and cancelled orders are immutable.

## Phase 3 — Application boundaries

Define the contracts and test doubles required by the use cases.

- [ ] **T032** — Define application errors and the authenticated actor model
  - **Depends on:** T020, T024
  - **Covers:** Architecture — Application; Architecture — Authentication and Authorization
  - **Likely files:** `src/application/errors/`, `src/application/authenticated-actor.ts`
  - **Verify:**
    - Application errors remain independent of HTTP.
    - Use cases receive actor ID and role explicitly.

- [ ] **T033** — Define UsersRepository around identity use-case needs
  - **Depends on:** T024, T032
  - **Covers:** Architecture — Application
  - **Likely files:** `src/application/repositories/users-repository.ts`
  - **Verify:**
    - The contract supports lookup by ID/email, creation, listing, and role update without exposing PostgreSQL rows.

- [ ] **T034** — Define AuthSessionsRepository around rotation and revocation needs
  - **Depends on:** T032
  - **Covers:** FR04–FR07; FR13–FR14; Architecture — Authentication; ADR-002; ADR-004
  - **Likely files:** `src/application/repositories/auth-sessions-repository.ts`
  - **Verify:**
    - The contract supports session creation, lookup by token hash, atomic rotation, current-session revocation, user-session revocation, and family revocation.

- [ ] **T035** — Define CategoriesRepository around category use cases
  - **Depends on:** T025, T032
  - **Covers:** FR16–FR19
  - **Likely files:** `src/application/repositories/categories-repository.ts`
  - **Verify:**
    - The contract supports required create, find, list, rename, uniqueness, product-existence check, and delete operations.

- [ ] **T036** — Define ProductsRepository around catalog and order needs
  - **Depends on:** T026, T032
  - **Covers:** FR20–FR26; BR26–BR29
  - **Likely files:** `src/application/repositories/products-repository.ts`
  - **Verify:**
    - The contract supports lookup, filtered listing, persistence, status changes, order-history checks, and permanent deletion.

- [ ] **T037** — Define OrdersRepository around aggregate persistence and concurrency
  - **Depends on:** T028, T032
  - **Covers:** FR27–FR42; Architecture — Concurrency; ADR-004
  - **Likely files:** `src/application/repositories/orders-repository.ts`
  - **Verify:**
    - The contract supports create, aggregate load, filtered listing, save, and protected state transitions without exposing SQL details.

- [ ] **T038** — Define PasswordHasher
  - **Depends on:** T032
  - **Covers:** Architecture — Authentication and Authorization
  - **Likely files:** `src/application/services/password-hasher.ts`
  - **Verify:**
    - The contract exposes only hash and compare.

- [ ] **T039** — Define AccessTokenProvider
  - **Depends on:** T019, T032
  - **Covers:** Architecture — Authentication; ADR-001
  - **Likely files:** `src/application/services/access-token-provider.ts`
  - **Verify:**
    - Issue and verify operations use application-owned claim types.
    - No JWT-library type leaks into Application.

- [ ] **T040** — Define RefreshTokenGenerator and RefreshTokenHasher
  - **Depends on:** T032
  - **Covers:** BR20–BR23; Architecture — Authentication; ADR-002; ADR-004
  - **Likely files:** `src/application/services/refresh-token-generator.ts`, `src/application/services/refresh-token-hasher.ts`
  - **Verify:**
    - Random token generation and deterministic token hashing are separate capabilities.

- [ ] **T041** — Define ImageStorage and StoredImage contracts
  - **Depends on:** T032
  - **Covers:** Architecture — Product Images; ADR-003
  - **Likely files:** `src/application/services/image-storage.ts`
  - **Verify:**
    - The contract supports temporary upload finalization and deletion.
    - It returns key, MIME type, and size without local paths.

- [ ] **T042** — Define minimal Clock and IdGenerator contracts
  - **Depends on:** T032
  - **Covers:** Testability; Manual dependency injection
  - **Likely files:** `src/application/services/clock.ts`, `src/application/services/id-generator.ts`
  - **Verify:**
    - Use cases can be tested deterministically without importing Node-specific APIs.

- [ ] **T043** — Implement in-memory repositories and fake services for application tests
  - **Depends on:** T033, T034, T035, T036, T037, T038, T039, T040, T041, T042
  - **Likely files:** `tests/doubles/`
  - **Verify:**
    - Application tests run without PostgreSQL, HTTP, bcrypt, JWT libraries, or the file system.

## Phase 4 — Identity application

Implement registration, authentication, sessions, profile, role management, and administrator bootstrap workflows.

- [ ] **T044** — Implement RegisterUserUseCase
  - **Depends on:** T033, T038, T042, T024
  - **Covers:** FR01; FR09; FR10; BR16
  - **Likely files:** `src/application/use-cases/identity/register-user.ts`
  - **Verify:**
    - Duplicate emails are rejected.
    - Public registration always creates STAFF.
    - The password is hashed before persistence.

- [ ] **T045** — Implement AuthenticateUserUseCase
  - **Depends on:** T033, T034, T038, T039, T040, T042
  - **Covers:** FR02; FR03; BR19–BR21
  - **Likely files:** `src/application/use-cases/identity/authenticate-user.ts`
  - **Verify:**
    - Invalid credentials use a non-enumerating error.
    - A JWT and an opaque refresh token are issued.
    - Only the refresh-token hash is persisted.

- [ ] **T046** — Implement RefreshAuthenticationUseCase with rotation and reuse detection
  - **Depends on:** T034, T039, T040, T042, T006
  - **Covers:** FR04; FR05; BR22; BR23
  - **Likely files:** `src/application/use-cases/identity/refresh-authentication.ts`
  - **Verify:**
    - Successful refresh invalidates the old token and creates a new session/token record atomically.
    - Reuse detection revokes the selected token family.

- [ ] **T047** — Implement LogoutCurrentSessionUseCase
  - **Depends on:** T034, T040
  - **Covers:** FR06; BR24
  - **Likely files:** `src/application/use-cases/identity/logout-current-session.ts`
  - **Verify:**
    - The current refresh session is revoked idempotently.

- [ ] **T048** — Implement LogoutAllOwnSessionsUseCase
  - **Depends on:** T034, T032
  - **Covers:** FR07
  - **Likely files:** `src/application/use-cases/identity/logout-all-own-sessions.ts`
  - **Verify:**
    - Only sessions owned by the authenticated user are revoked.

- [ ] **T049** — Implement GetOwnProfileUseCase
  - **Depends on:** T033, T032
  - **Covers:** FR08
  - **Likely files:** `src/application/use-cases/identity/get-own-profile.ts`
  - **Verify:**
    - The response never includes passwordHash.

- [ ] **T050** — Implement ListUsersUseCase
  - **Depends on:** T033, T032
  - **Covers:** FR11; BR01
  - **Likely files:** `src/application/use-cases/identity/list-users.ts`
  - **Verify:**
    - Only ADMIN can execute the use case.
    - Returned users never expose passwordHash.

- [ ] **T051** — Implement ChangeUserRoleUseCase
  - **Depends on:** T033, T034, T032, T019
  - **Covers:** FR12; FR13; BR25; BR30
  - **Likely files:** `src/application/use-cases/identity/change-user-role.ts`
  - **Verify:**
    - Only ADMIN can execute it.
    - Self-role changes are rejected.
    - Target sessions are revoked after a successful role change.

- [ ] **T052** — Implement BootstrapAdminUseCase
  - **Depends on:** T033, T038, T042
  - **Covers:** FR15; NFR12; Domain §10.5
  - **Likely files:** `src/application/use-cases/identity/bootstrap-admin.ts`
  - **Verify:**
    - It creates ADMIN explicitly.
    - Duplicate email is rejected.
    - No hard-coded credentials exist.

- [ ] **T053** — Write identity application unit tests
  - **Depends on:** T043, T044, T045, T046, T047, T048, T049, T050, T051, T052
  - **Covers:** FR01–FR15; NFR09; Architecture — Testing
  - **Likely files:** `tests/unit/application/identity/`
  - **Verify:**
    - Success, authorization, duplicates, invalid credentials, rotation, reuse, revocation, self-role change, and output-sanitization paths are covered.

## Phase 5 — Catalog application

Implement category and product workflows, including image compensation rules.

- [ ] **T054** — Implement ListCategoriesUseCase
  - **Depends on:** T035, T032
  - **Covers:** FR16
  - **Likely files:** `src/application/use-cases/catalog/list-categories.ts`
  - **Verify:**
    - Authenticated STAFF and ADMIN actors are accepted.

- [ ] **T055** — Implement CreateCategoryUseCase
  - **Depends on:** T035, T032, T025, T042
  - **Covers:** FR17; BR01
  - **Likely files:** `src/application/use-cases/catalog/create-category.ts`
  - **Verify:**
    - Only ADMIN can create.
    - Duplicate normalized names are rejected.

- [ ] **T056** — Implement UpdateCategoryUseCase
  - **Depends on:** T035, T032
  - **Covers:** FR18; BR01
  - **Likely files:** `src/application/use-cases/catalog/update-category.ts`
  - **Verify:**
    - Only ADMIN can rename.
    - Missing and duplicate categories are handled.

- [ ] **T057** — Implement DeleteCategoryUseCase
  - **Depends on:** T035, T032
  - **Covers:** FR19; BR17
  - **Likely files:** `src/application/use-cases/catalog/delete-category.ts`
  - **Verify:**
    - Only ADMIN can delete.
    - Deletion is rejected while products still reference the category.

- [ ] **T058** — Implement ListProductsUseCase with optional category filtering
  - **Depends on:** T036, T032
  - **Covers:** FR20; FR21
  - **Likely files:** `src/application/use-cases/catalog/list-products.ts`
  - **Verify:**
    - Authenticated actors can list.
    - categoryId filtering is optional and explicit.

- [ ] **T059** — Implement CreateProductUseCase with image compensation
  - **Depends on:** T035, T036, T041, T032, T026, T042
  - **Covers:** FR22; FR23; NFR08; Architecture — Product Images; ADR-003
  - **Likely files:** `src/application/use-cases/catalog/create-product.ts`
  - **Verify:**
    - Only ADMIN can create.
    - Category existence is checked.
    - The image is finalized before product persistence.
    - A stored image is deleted when product persistence fails.

- [ ] **T060** — Implement UpdateProductUseCase with optional image replacement
  - **Depends on:** T035, T036, T041, T032
  - **Covers:** FR24; Architecture — Product Images; ADR-003
  - **Likely files:** `src/application/use-cases/catalog/update-product.ts`
  - **Verify:**
    - Only ADMIN can update.
    - A new image is deleted if database update fails.
    - The old image is deleted only after the database confirms the replacement.

- [ ] **T061** — Implement ChangeProductStatusUseCase
  - **Depends on:** T036, T032
  - **Covers:** FR26; BR28; BR29
  - **Likely files:** `src/application/use-cases/catalog/change-product-status.ts`
  - **Verify:**
    - Only ADMIN can change isActive.
    - Historical records are not altered.
    - A product can be reactivated.

- [ ] **T062** — Implement DeleteProductUseCase
  - **Depends on:** T036, T041, T032
  - **Covers:** FR25; BR26; BR27
  - **Likely files:** `src/application/use-cases/catalog/delete-product.ts`
  - **Verify:**
    - Only ADMIN can delete.
    - Products with order history are rejected.
    - The stored image is removed only after successful permanent deletion.
    - Image cleanup failures are surfaced or recorded without restoring a deleted database row.

- [ ] **T063** — Write catalog application unit tests
  - **Depends on:** T043, T054, T055, T056, T057, T058, T059, T060, T061, T062
  - **Covers:** FR16–FR26; NFR09
  - **Likely files:** `tests/unit/application/catalog/`
  - **Verify:**
    - Authorization, duplicates, category checks, status changes, history checks, upload compensation, and image replacement cases are covered.

## Phase 6 — Orders application

Implement the complete order and order-item lifecycle.

- [ ] **T064** — Implement CreateOrderUseCase
  - **Depends on:** T037, T032, T028, T042
  - **Covers:** FR27; FR41; FR42; BR06A; BR06B
  - **Likely files:** `src/application/use-cases/orders/create-order.ts`
  - **Verify:**
    - STAFF and ADMIN can create.
    - tableNumber is required.
    - customerName is optional.
    - The authenticated user becomes the creator.

- [ ] **T065** — Implement AddOrderItemUseCase
  - **Depends on:** T036, T037, T032, T027, T028, T042
  - **Covers:** FR28–FR31; BR07; BR18; BR29; BR31–BR37
  - **Likely files:** `src/application/use-cases/orders/add-order-item.ts`
  - **Verify:**
    - The product must exist and be active.
    - Name and price are snapshotted.
    - Every request creates a distinct item.
    - Notes and quantity rules are enforced.

- [ ] **T066** — Implement UpdateOrderItemUseCase
  - **Depends on:** T037, T032, T028
  - **Covers:** FR32; BR07; BR34–BR37
  - **Likely files:** `src/application/use-cases/orders/update-order-item.ts`
  - **Verify:**
    - Only DRAFT orders can change quantity or notes.
    - The target item must belong to the target order.

- [ ] **T067** — Implement RemoveOrderItemUseCase
  - **Depends on:** T037, T032, T028
  - **Covers:** FR33; BR07
  - **Likely files:** `src/application/use-cases/orders/remove-order-item.ts`
  - **Verify:**
    - Only DRAFT orders can remove items.
    - The target item must belong to the target order.

- [ ] **T068** — Implement GetOrderUseCase
  - **Depends on:** T037, T032
  - **Covers:** FR34
  - **Likely files:** `src/application/use-cases/orders/get-order.ts`
  - **Verify:**
    - Authenticated STAFF and ADMIN actors can retrieve complete order details including historical item data.

- [ ] **T069** — Implement ListOrdersUseCase with optional status filtering
  - **Depends on:** T037, T032, T019
  - **Covers:** FR35; FR36; FR38
  - **Likely files:** `src/application/use-cases/orders/list-orders.ts`
  - **Verify:**
    - All orders or a selected status can be returned.
    - IN_PREPARATION supports the preparation queue.

- [ ] **T070** — Implement SubmitOrderUseCase
  - **Depends on:** T037, T032, T028
  - **Covers:** FR37; BR08; BR09
  - **Likely files:** `src/application/use-cases/orders/submit-order.ts`
  - **Verify:**
    - Only a non-empty DRAFT order can be submitted.
    - submittedAt is recorded.
    - Concurrent invalid transitions are rejected by persistence.

- [ ] **T071** — Implement CompleteOrderUseCase
  - **Depends on:** T037, T032, T028
  - **Covers:** FR39; BR10; BR12
  - **Likely files:** `src/application/use-cases/orders/complete-order.ts`
  - **Verify:**
    - Only IN_PREPARATION can become COMPLETED.
    - completedAt is recorded.
    - Concurrent cancel/complete cannot both succeed.

- [ ] **T072** — Implement CancelOrderUseCase
  - **Depends on:** T037, T032, T028
  - **Covers:** FR40; BR11–BR13
  - **Likely files:** `src/application/use-cases/orders/cancel-order.ts`
  - **Verify:**
    - Only DRAFT or IN_PREPARATION can be cancelled.
    - cancelledAt is recorded.
    - Terminal orders remain immutable.

- [ ] **T073** — Write orders application unit tests
  - **Depends on:** T043, T064, T065, T066, T067, T068, T069, T070, T071, T072
  - **Covers:** FR27–FR42; NFR09; Architecture — Testing
  - **Likely files:** `tests/unit/application/orders/`
  - **Verify:**
    - Authorization, snapshots, repeated products, notes, ownership references, filtering, timestamps, and transition failures are covered.

## Phase 7 — PostgreSQL persistence

Create migrations, repositories, transactions, constraints, and integration tests.

- [ ] **T074** — Implement the PostgreSQL connection pool and transaction helper
  - **Depends on:** T014, T016
  - **Covers:** Architecture — Persistence
  - **Likely files:** `src/infrastructure/database/postgres/connection/pool.ts`, `src/infrastructure/database/postgres/connection/transaction.ts`
  - **Verify:**
    - One pool is reused.
    - Transactions always commit or roll back and release the client.

- [ ] **T075** — Create the users migration
  - **Depends on:** T017
  - **Covers:** FR01; FR11–FR15; Domain — User; Architecture — Persistence
  - **Likely files:** `database/migrations/001_create_users.sql`
  - **Verify:**
    - Email uniqueness, role validity, password_hash, timestamps, and required fields are constrained.

- [ ] **T076** — Create the auth_sessions migration
  - **Depends on:** T075
  - **Covers:** FR03–FR07; FR13–FR14; NFR10; Architecture — Authentication; ADR-002; ADR-004
  - **Likely files:** `database/migrations/002_create_auth_sessions.sql`
  - **Verify:**
    - Plain refresh tokens cannot be stored.
    - Token hash, family, absolute expiry, revocation, timestamps, IP metadata,
      and user agent are represented.
    - `refresh_token_hash` is unique.
    - At most one non-revoked successor session can exist per token family.
    - Lookup, family-revocation, and cleanup indexes exist.

- [ ] **T077** — Create the categories migration
  - **Depends on:** T017
  - **Covers:** FR16–FR19; BR17
  - **Likely files:** `database/migrations/003_create_categories.sql`
  - **Verify:**
    - Category names are required and unique according to the selected normalization strategy.

- [ ] **T078** — Create the products migration
  - **Depends on:** T077
  - **Covers:** FR20–FR26; BR15A; BR15B; Architecture — Product Images; Architecture — Money; ADR-003
  - **Likely files:** `database/migrations/004_create_products.sql`
  - **Verify:**
    - Price uses the chosen canonical string column and format check.
    - image_key, image_mime_type, image_size, is_active, and category FK are present.

- [ ] **T079** — Create the orders migration
  - **Depends on:** T075
  - **Covers:** FR27; FR34–FR42; Domain — Order; Architecture — Persistence
  - **Likely files:** `database/migrations/005_create_orders.sql`
  - **Verify:**
    - table_number and creator are required.
    - customer_name and lifecycle timestamps are nullable as appropriate.
    - Status values are constrained.

- [ ] **T080** — Create the order_items migration
  - **Depends on:** T078, T079
  - **Covers:** FR28–FR33; BR18; BR31–BR37; Domain — OrderItem; Architecture — Persistence
  - **Likely files:** `database/migrations/006_create_order_items.sql`
  - **Verify:**
    - Historical product name and unit price are stored.
    - Quantity is positive.
    - Notes are nullable and length constrained.
    - No unique constraint exists on (order_id, product_id).

- [ ] **T081** — Review and add required indexes and referential actions
  - **Depends on:** T076, T077, T078, T079, T080
  - **Covers:** NFR07; Architecture — Persistence
  - **Likely files:** `database/migrations/007_add_indexes.sql`
  - **Verify:**
    - Email, refresh hash, token family, category filter, order status, foreign keys, and queue queries have appropriate indexes.
    - Delete/restrict behavior preserves historical orders.

- [ ] **T082** — Create isolated integration-test database setup and cleanup
  - **Depends on:** T074, T081, T012
  - **Likely files:** `tests/setup/postgres.ts`, `docker-compose.test.yml`
  - **Verify:**
    - Tests use a non-production database.
    - Migrations run before integration tests.
    - Test data is isolated and repeatable.

- [ ] **T083** — Implement PostgresUsersRepository and row mapping
  - **Depends on:** T033, T074, T075
  - **Covers:** FR01; FR08; FR11–FR13
  - **Likely files:** `src/infrastructure/database/postgres/repositories/postgres-users-repository.ts`
  - **Verify:**
    - Queries are parameterized.
    - Rows map to domain/application types.
    - passwordHash is never returned by list/profile result models.

- [ ] **T084** — Implement PostgresAuthSessionsRepository with atomic rotation
  - **Depends on:** T034, T074, T076, T006
  - **Covers:** FR03–FR07; BR21–BR25
  - **Likely files:** `src/infrastructure/database/postgres/repositories/postgres-auth-sessions-repository.ts`
  - **Verify:**
    - Rotation uses one transaction and locks the matching session row with
      `SELECT ... FOR UPDATE`.
    - The old session is revoked and exactly one successor is created atomically.
    - Rotation preserves the original `expires_at`.
    - Different authentication sessions may rotate concurrently.
    - Reuse detection and family revocation are supported.
    - Only deterministic token hashes are persisted.

- [ ] **T085** — Implement PostgresCategoriesRepository
  - **Depends on:** T035, T074, T077
  - **Covers:** FR16–FR19; BR17
  - **Likely files:** `src/infrastructure/database/postgres/repositories/postgres-categories-repository.ts`
  - **Verify:**
    - All values are parameterized.
    - Product-existence checks support safe deletion.

- [ ] **T086** — Implement PostgresProductsRepository
  - **Depends on:** T036, T074, T078, T080
  - **Covers:** FR20–FR26; BR26–BR29
  - **Likely files:** `src/infrastructure/database/postgres/repositories/postgres-products-repository.ts`
  - **Verify:**
    - Category filtering, status changes, order-history checks, permanent deletion, and canonical monetary mapping work.

- [ ] **T087** — Implement PostgresOrdersRepository with aggregate mapping and protected transitions
  - **Depends on:** T037, T074, T079, T080, T006
  - **Covers:** FR27–FR42; Architecture — Persistence; Architecture — Concurrency; ADR-004
  - **Likely files:** `src/infrastructure/database/postgres/repositories/postgres-orders-repository.ts`
  - **Verify:**
    - Orders load with items.
    - Item changes and submission lock the related `orders` row before reading
      or modifying `order_items`.
    - Locks are acquired in the documented `orders` then `order_items` order.
    - Complete and cancel use conditional updates with the expected source
      status in the `WHERE` clause.
    - Concurrent complete/cancel operations cannot both succeed.
    - Repeated products remain distinct.

- [ ] **T088** — Write PostgreSQL repository and migration integration tests
  - **Depends on:** T082, T083, T084, T085, T086, T087
  - **Covers:** Architecture — Testing
  - **Likely files:** `tests/integration/postgres/`
  - **Verify:**
    - Constraints, mappings, queries, filters, transactions, rotation, concurrency, history checks, and repeated order items are covered.

## Phase 8 — Technical adapters

Implement cryptography, JWT, refresh-token, local-image, and CLI adapters.

- [ ] **T089** — Implement BcryptPasswordHasher
  - **Depends on:** T038, T014
  - **Covers:** Architecture — Authentication and Authorization
  - **Likely files:** `src/infrastructure/cryptography/bcrypt-password-hasher.ts`
  - **Verify:**
    - The work factor is configurable.
    - Passwords and hashes are never logged.

- [ ] **T090** — Implement JwtAccessTokenProvider
  - **Depends on:** T003, T004, T039, T014
  - **Covers:** FR03; Architecture — Authentication; ADR-001; ADR-002
  - **Likely files:** `src/infrastructure/authentication/jwt-access-token-provider.ts`
  - **Verify:**
    - Tokens are issued and verified with `jose` and `HS256`.
    - `sub`, `role`, `iss`, `aud`, `iat`, `exp`, and `jti` are handled.
    - Issuer, audience, expiry, algorithm, and signature are validated.
    - Access-token lifetime is 15 minutes.
    - Sensitive data is absent from payloads.

- [ ] **T091** — Implement cryptographic refresh-token generation and hashing
  - **Depends on:** T040
  - **Covers:** BR20; BR21; Architecture — Authentication; ADR-002
  - **Likely files:** `src/infrastructure/authentication/node-refresh-token-generator.ts`, `src/infrastructure/authentication/node-refresh-token-hasher.ts`
  - **Verify:**
    - Tokens contain sufficient cryptographic entropy.
    - SHA-256 or the selected deterministic cryptographic hash produces stable lookup values.

- [ ] **T092** — Implement LocalImageStorage with temporary and permanent files
  - **Depends on:** T005, T041, T014
  - **Covers:** NFR08; Architecture — Product Images; ADR-003
  - **Likely files:** `src/infrastructure/storage/local-image-storage.ts`
  - **Verify:**
    - Temporary files use `uploads/.tmp/products/`.
    - Permanent files use `uploads/products/`.
    - Server-generated keys and validated-type extensions are used.
    - Partial, temporary, and compensating files can be cleaned.
    - No client filename, extension, or path determines the stored path.
    - Stored results expose key, MIME type, and size only.

- [ ] **T093** — Write adapter integration tests
  - **Depends on:** T089, T090, T091, T092
  - **Covers:** Architecture — Testing
  - **Likely files:** `tests/integration/adapters/`
  - **Verify:**
    - Password hashing, JWT validation, token entropy/hash, file finalization, deletion, and cleanup are covered.

- [ ] **T094** — Implement the bootstrap-admin CLI adapter
  - **Depends on:** T052, T083, T089, T014
  - **Covers:** FR15; NFR12; Architecture — Authentication and Authorization
  - **Likely files:** `src/main/scripts/bootstrap-admin.ts`, `package.json`
  - **Verify:**
    - The command receives or securely prompts for name, email, and password.
    - It reuses BootstrapAdminUseCase.
    - Failures return a non-zero status.
    - Credentials are not echoed or hard-coded.

## Phase 9 — Native HTTP foundation

Build only the HTTP features required by PizzaHub.

- [ ] **T095** — Implement an injectable native HTTP server factory
  - **Depends on:** T013, T010
  - **Covers:** Architecture — HTTP Design
  - **Likely files:** `src/presentation/http/server/create-http-server.ts`
  - **Verify:**
    - Tests can create and close a server without binding the production port.

- [ ] **T096** — Implement method-and-pattern route registration and matching
  - **Depends on:** T095
  - **Covers:** Architecture — HTTP Design
  - **Likely files:** `src/presentation/http/routes/router.ts`
  - **Verify:**
    - Static and parameterized routes match deterministically.
    - Unsupported routes return the standard not-found response.

- [ ] **T097** — Implement the minimal middleware pipeline
  - **Depends on:** T095, T096
  - **Covers:** Architecture — HTTP Design
  - **Likely files:** `src/presentation/http/middlewares/compose-middlewares.ts`
  - **Verify:**
    - Middleware can continue, short-circuit, and forward errors without becoming a general-purpose framework.

- [ ] **T098** — Implement URL, route-parameter, and query-parameter extraction
  - **Depends on:** T096
  - **Covers:** Architecture — HTTP Design
  - **Likely files:** `src/presentation/http/request/request-context.ts`
  - **Verify:**
    - Encoded values and invalid URLs are handled predictably.

- [ ] **T099** — Implement the bounded JSON body parser
  - **Depends on:** T095, T007
  - **Covers:** NFR02; Architecture — HTTP Design; ADR-005
  - **Likely files:** `src/presentation/http/parsers/json-body-parser.ts`
  - **Verify:**
    - Malformed JSON, unsupported content type, oversized body, empty body, and aborted requests are handled.

- [ ] **T100** — Implement the bounded Busboy multipart parser
  - **Depends on:** T005, T095, T007
  - **Covers:** FR22; FR24; NFR02; NFR08; Architecture — HTTP Design; Architecture — Product Images; ADR-003; ADR-005
  - **Likely files:** `src/presentation/http/parsers/busboy-multipart-parser.ts`
  - **Verify:**
    - Exactly one file in the `image` field is accepted.
    - Only JPEG, PNG, and WebP are accepted.
    - The maximum image size is 5 MiB.
    - Declared MIME type and file-content signature are validated.
    - File, field, part, and total limits are enforced.
    - Client-provided file names never become storage paths.
    - Temporary or partial files are cleaned on failure or request abort.
    - Upload errors use the standard HTTP error contract.
    - The parser does not call use cases or PostgreSQL.

- [ ] **T101** — Implement response helpers and centralized HTTP error mapping
  - **Depends on:** T007, T095, T020, T032
  - **Covers:** NFR06; Architecture — HTTP Design; ADR-005
  - **Likely files:** `src/presentation/http/responses/`, `src/presentation/http/errors/error-handler.ts`
  - **Verify:**
    - Success and error responses form the documented TypeScript discriminated union.
    - Success uses `success: true`; errors use `success: false`.
    - `error.code` is stable and machine-readable.
    - HTTP status is not duplicated inside `ApiError`.
    - Validation, authentication, authorization, not-found, conflict, upload,
      and unexpected errors map to stable status codes and envelopes.
    - `204 No Content` has no body.
    - Successful image delivery remains binary.
    - Unexpected details and secrets are not exposed.

- [ ] **T102** — Implement JWT authentication middleware
  - **Depends on:** T039, T090, T097, T101
  - **Covers:** NFR03; Architecture — Authentication; ADR-001
  - **Likely files:** `src/presentation/http/middlewares/authenticate.ts`
  - **Verify:**
    - Bearer tokens are parsed and verified.
    - Authenticated actor ID and role are attached to request context.
    - Missing and invalid tokens return 401.

- [ ] **T103** — Implement role authorization middleware
  - **Depends on:** T097, T102
  - **Covers:** BR01; Architecture — Authentication and Authorization
  - **Likely files:** `src/presentation/http/middlewares/authorize-role.ts`
  - **Verify:**
    - ADMIN-only routes reject STAFF with 403.
    - Use cases still perform critical authorization.

- [ ] **T104** — Implement controlled product-image delivery
  - **Depends on:** T092, T096, T101
  - **Covers:** Architecture — HTTP Design; Architecture — Product Images; ADR-003; ADR-005
  - **Likely files:** `src/presentation/http/controllers/catalog/get-product-image-controller.ts`, `src/presentation/http/routes/image-routes.ts`
  - **Verify:**
    - Only safe image keys are accepted.
    - Path traversal and absolute paths are rejected.
    - Correct content type and not-found handling are returned.

- [ ] **T105** — Write native HTTP foundation tests
  - **Depends on:** T095, T096, T097, T098, T099, T100, T101, T102, T103, T104
  - **Covers:** Architecture — Testing
  - **Likely files:** `tests/http/foundation/`
  - **Verify:**
    - Routing, parameters, parsers, limits, middleware, authentication, authorization, errors, and image delivery are covered with Supertest.

## Phase 10 — Identity HTTP API

Expose authentication and user-management use cases through HTTP.

- [ ] **T106** — Create Zod schemas for identity routes and authentication transport
  - **Depends on:** T004, T099, T100
  - **Covers:** FR01–FR15; NFR05
  - **Likely files:** `src/presentation/http/validation/identity/`
  - **Verify:**
    - Register, login, refresh, logout, profile, user ID, and role inputs are validated.
    - Refresh-token transport follows the documented browser/mobile decision.

- [ ] **T107** — Implement thin identity controllers
  - **Depends on:** T044, T045, T046, T047, T048, T049, T050, T051, T101, T106
  - **Covers:** Architecture — HTTP Design
  - **Likely files:** `src/presentation/http/controllers/identity/`
  - **Verify:**
    - Each controller validates transport input, calls one use case, and maps the result without business logic.
    - passwordHash is never serialized.

- [ ] **T108** — Register authentication and user routes
  - **Depends on:** T096, T102, T103, T107
  - **Covers:** Requirements §5 Authentication; Requirements §5 Users
  - **Likely files:** `src/presentation/http/routes/identity-routes.ts`
  - **Verify:**
    - Public and private route boundaries match the requirements.
    - Role-change cannot target the authenticated administrator.

- [ ] **T109** — Write identity HTTP API tests
  - **Depends on:** T105, T108, T053
  - **Covers:** FR01–FR15; Architecture — Testing
  - **Likely files:** `tests/http/identity/`
  - **Verify:**
    - Registration, login, refresh rotation, logout, logout-all, profile,
      user listing, role change, authorization, validation, and sanitized
      responses are covered.
    - Browser cookie flags, explicit CORS origin, required CSRF header, and
      access-token JSON response are covered.

## Phase 11 — Catalog HTTP API

Expose categories, products, uploads, image delivery, product status, and deletion.

- [ ] **T110** — Implement category schemas, controllers, and routes
  - **Depends on:** T054, T055, T056, T057, T096, T102, T103, T101
  - **Covers:** FR16–FR19; Requirements §5 Categories
  - **Likely files:** `src/presentation/http/validation/catalog/category-schemas.ts`, `src/presentation/http/controllers/catalog/categories/`, `src/presentation/http/routes/category-routes.ts`
  - **Verify:**
    - Listing is authenticated.
    - Mutations are ADMIN-only.
    - Duplicate, missing, and non-empty-category errors use the standard envelope.

- [ ] **T111** — Write category HTTP API tests
  - **Depends on:** T110, T063, T105
  - **Covers:** FR16–FR19
  - **Likely files:** `tests/http/catalog/categories.test.ts`
  - **Verify:**
    - All routes, validation, roles, conflicts, and deletion restrictions are covered.

- [ ] **T112** — Implement product multipart schemas, controllers, and routes
  - **Depends on:** T058, T059, T060, T100, T102, T103, T101
  - **Covers:** FR20–FR24; NFR02; NFR08
  - **Likely files:** `src/presentation/http/validation/catalog/product-schemas.ts`, `src/presentation/http/controllers/catalog/products/`, `src/presentation/http/routes/product-routes.ts`
  - **Verify:**
    - Create accepts product fields and one image in one request.
    - Update supports optional field changes and optional image replacement.
    - Listing supports categoryId.

- [ ] **T113** — Implement product presentation mapping from imageKey to imageUrl
  - **Depends on:** T104, T112
  - **Covers:** Domain §10.6; Architecture — Product Images; ADR-003
  - **Likely files:** `src/presentation/http/presenters/product-presenter.ts`
  - **Verify:**
    - Domain/application outputs retain imageKey.
    - HTTP responses expose a stable imageUrl generated from configured API information.

- [ ] **T114** — Expose product status and permanent-deletion operations
  - **Depends on:** T061, T062, T096, T102, T103, T101
  - **Covers:** FR25; FR26; Requirements §5 Products
  - **Likely files:** `src/presentation/http/controllers/catalog/products/change-product-status-controller.ts`, `src/presentation/http/controllers/catalog/products/delete-product-controller.ts`, `src/presentation/http/routes/product-routes.ts`
  - **Verify:**
    - Status change and deletion are distinct routes.
    - Deletion with history returns conflict.
    - STAFF cannot mutate products.

- [ ] **T115** — Write product and upload HTTP API tests
  - **Depends on:** T111, T112, T113, T114, T063, T093
  - **Covers:** FR20–FR26; NFR08
  - **Likely files:** `tests/http/catalog/products.test.ts`, `tests/http/catalog/product-images.test.ts`
  - **Verify:**
    - Multipart success, missing image, multiple images, unsupported declared
      type, signature mismatch, oversized file, malformed fields, aborted
      request, replacement, compensation, category filtering, status changes,
      deletion restrictions, and image URLs are covered.
    - Upload failures use the standard error envelope and leave no partial files.

## Phase 12 — Orders HTTP API

Expose order and order-item workflows and verify concurrent state changes.

- [ ] **T116** — Create Zod schemas for orders, order items, filters, and notes
  - **Depends on:** T099
  - **Covers:** FR27–FR42; NFR05
  - **Likely files:** `src/presentation/http/validation/orders/`
  - **Verify:**
    - tableNumber, optional customerName, IDs, statuses, quantity, and notes are validated.
    - Empty notes normalize to null and notes longer than 500 are rejected.

- [ ] **T117** — Implement order and order-item controllers and routes
  - **Depends on:** T064, T065, T066, T067, T068, T069, T070, T071, T072, T096, T102, T101, T116
  - **Covers:** Requirements §5 Orders; Requirements §5 Order Items
  - **Likely files:** `src/presentation/http/controllers/orders/`, `src/presentation/http/routes/order-routes.ts`
  - **Verify:**
    - All required endpoints call one use case each.
    - Authenticated STAFF and ADMIN access matches requirements.
    - Status filtering and preparation queue are exposed.

- [ ] **T118** — Write order and order-item HTTP API tests
  - **Depends on:** T117, T073, T105
  - **Covers:** FR27–FR42
  - **Likely files:** `tests/http/orders/`
  - **Verify:**
    - Creation, repeated products, notes, item updates/removal, detail, listing/filtering, submit, complete, cancel, invalid transitions, and terminal immutability are covered.

- [ ] **T119** — Write concurrent order-transition and refresh-rotation integration tests
  - **Depends on:** T084, T087, T109, T118
  - **Covers:** Architecture — Concurrency; ADR-004
  - **Likely files:** `tests/integration/concurrency/`
  - **Verify:**
    - Two simultaneous refreshes using the same session do not both produce
      valid successor sessions.
    - Refreshes using different authentication sessions can proceed independently.
    - Refresh-token reuse revokes the affected family.
    - Complete versus cancel cannot both succeed for the same order state.
    - Final database state is valid and deterministic.

## Phase 13 — Assembly and release readiness

Connect concrete dependencies, run acceptance checks, document the project, and verify scope.

- [ ] **T120** — Assemble concrete dependencies in the main composition root
  - **Depends on:** T083, T084, T085, T086, T087, T089, T090, T091, T092, T108, T110, T112, T114, T117
  - **Covers:** Architecture — Dependency Assembly
  - **Likely files:** `src/main/dependencies/`
  - **Verify:**
    - Only the composition root knows concrete adapters.
    - Controllers and use cases receive dependencies explicitly.

- [ ] **T121** — Implement production startup and graceful shutdown
  - **Depends on:** T120, T014, T095
  - **Covers:** Architecture — Technology Stack; Architecture — Persistence
  - **Likely files:** `src/main/server.ts`
  - **Verify:**
    - The server starts after configuration and database readiness.
    - SIGINT/SIGTERM close HTTP server and PostgreSQL pool.
    - Startup failure returns a non-zero process status.

- [ ] **T122** — Run a Docker Compose persistence smoke test
  - **Depends on:** T016, T121, T115
  - **Covers:** Architecture — Technology Stack; Architecture — Product Images
  - **Likely files:** `docs/testing/docker-smoke.md`
  - **Verify:**
    - Database data and product images survive API container recreation.

- [ ] **T123** — Run a bootstrap-admin smoke test
  - **Depends on:** T094, T121
  - **Covers:** FR15; NFR12
  - **Likely files:** `docs/testing/bootstrap-smoke.md`
  - **Verify:**
    - A first ADMIN can be created.
    - Duplicate execution is handled safely.
    - No secret appears in output or logs.

- [ ] **T124** — Create and execute an API acceptance matrix for every current route
  - **Depends on:** T109, T111, T115, T118, T121
  - **Covers:** FR01–FR42
  - **Likely files:** `docs/testing/api-acceptance.md`
  - **Verify:**
    - Every route has at least one success case and its important validation, authentication, authorization, not-found, and conflict cases.

- [ ] **T125** — Measure the initial performance baseline
  - **Depends on:** T121, T124
  - **Covers:** NFR07
  - **Likely files:** `tests/performance/`, `docs/testing/performance-baseline.md`
  - **Verify:**
    - Representative normal-condition requests are measured.
    - The result documents whether 95% complete under two seconds and identifies any exceptions.

- [ ] **T126** — Perform a security review of authentication, uploads, SQL, logging, and path handling
  - **Depends on:** T119, T124
  - **Covers:** NFR03–NFR06; NFR08; NFR11; Architecture constraints
  - **Likely files:** `docs/reviews/security-review.md`
  - **Verify:**
    - All SQL values are parameterized.
    - Secrets are absent from logs.
    - Refresh rotation/revocation and per-session locking work.
    - Upload allowlist, 5 MiB limit, content-signature validation, and cleanup work.
    - Path traversal is rejected.
    - Role checks exist in middleware and protected use cases.

- [ ] **T127** — Review automated-test coverage against core business rules
  - **Depends on:** T029, T030, T031, T053, T063, T073, T088, T093, T105, T109, T111, T115, T118, T119
  - **Covers:** NFR09
  - **Likely files:** `vitest.config.ts`, `docs/testing/coverage-review.md`
  - **Verify:**
    - Every order invariant and lifecycle transition has automated coverage.
    - Coverage gaps are documented and fixed before completion.

- [ ] **T128** — Write the project README and local-development guide
  - **Depends on:** T121, T123, T124
  - **Covers:** NFR01; Architecture — Technology Stack
  - **Likely files:** `README.md`, `docs/development.md`
  - **Verify:**
    - Setup, environment variables, Docker, migrations, bootstrap, scripts, uploads, authentication flow, and testing commands are documented.

- [ ] **T129** — Perform a final scope and architecture-boundary audit
  - **Depends on:** T126, T127, T128
  - **Covers:** Requirements §8; Domain §12; Architecture — Constraints; Architecture — Open Decisions
  - **Likely files:** `docs/reviews/final-scope-audit.md`
  - **Verify:**
    - No deferred feature was implemented accidentally.
    - No Domain/Application dependency points outward.
    - No controller accesses PostgreSQL or the file system directly.
    - No raw SQL exists outside Infrastructure.

- [ ] **T130** — Create the initial release-readiness checkpoint
  - **Depends on:** T122, T123, T124, T125, T126, T127, T128, T129
  - **Covers:** Initial backend release
  - **Likely files:** `CHANGELOG.md`
  - **Verify:**
    - All required tasks are complete.
    - Known limitations and deferred work are recorded.
    - The repository is ready for an initial tagged release or deployment decision.
