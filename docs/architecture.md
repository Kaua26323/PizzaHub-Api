# PizzaHub Architecture

## 1. Architecture Overview

PizzaHub is a backend API for managing a pizzeria's product catalog and order workflow.

The application will follow **Clean Architecture**, separating business rules from delivery mechanisms, database access, and external services.

The architecture is divided into four main layers:

```text
Presentation
    ↓
Application
    ↓
Domain

Infrastructure
    ↓
Application contracts
```

The dependency direction always points toward the business rules.

The Domain layer must not depend on the Application, Infrastructure, or Presentation layers.

---

## 2. Architectural Goals

The architecture must support the following goals:

- Keep business rules independent of frameworks and databases.
- Make use cases testable without starting an HTTP server or connecting to PostgreSQL.
- Allow infrastructure implementations to be replaced without changing business rules.
- Keep HTTP-specific code isolated from the application core.
- Keep SQL and PostgreSQL-specific details isolated in the Infrastructure layer.
- Make dependencies explicit through constructor injection.
- Prevent invalid order states and transitions.
- Preserve historical order information.
- Support gradual evolution without introducing unnecessary abstractions.

---

## 3. Architectural Style

PizzaHub will use **Clean Architecture** with the following layers:

```text
Domain
Application
Infrastructure
Presentation
```

### Dependency Rule

Outer layers may depend on inner layers.

Inner layers must not depend on outer layers.

```text
Presentation ─────→ Application ─────→ Domain
                         ↑
Infrastructure ─────────┘
```

Examples:

- Presentation may import Application use cases.
- Application may import Domain entities and value objects.
- Infrastructure may implement contracts defined by Application.
- Domain must not import PostgreSQL, `pg`, Node HTTP types, controllers, or routes.
- Application must not import SQL queries or PostgreSQL clients.
- Infrastructure must not contain business decisions that belong to Domain.
- Presentation must not access the database directly.

---

## 4. Adopted Patterns and Principles

PizzaHub will initially use the following patterns and principles.

### 4.1 Use Cases

Each application operation will be represented by a specific use case.

Examples:

```text
RegisterUser
AuthenticateUser
CreateCategory
CreateProduct
CreateOrder
AddOrderItem
UpdateOrderItem
SubmitOrder
CompleteOrder
CancelOrder
```

A use case coordinates an application operation.

It may:

- Load entities through repository contracts.
- Call domain behaviors.
- Persist the resulting state.
- Return an application result.

A use case must not:

- Parse HTTP requests.
- Return HTTP responses.
- Execute raw SQL directly.
- Depend on Node's HTTP server.
- Contain database-specific types.

### 4.2 Repository Pattern

Repository contracts describe the persistence operations required by the Application layer.

Examples:

```text
UsersRepository
CategoriesRepository
ProductsRepository
OrdersRepository
```

The contracts do not define how data is stored.

The Application layer depends on repository contracts, while Infrastructure provides PostgreSQL implementations.

```text
Application contract
OrdersRepository
        ↑
Infrastructure implementation
PostgresOrdersRepository
```

Repository contracts must use Domain entities or Application-specific data structures instead of PostgreSQL row types.

### 4.3 Adapter Pattern

Adapters connect the application core to external technologies and delivery mechanisms.

Initial adapters include:

```text
PostgreSQL repositories
Native Node.js HTTP server
JWT access token provider
Refresh token generator
bcrypt password hasher
Local image storage
Busboy multipart parser
```

The Application layer defines the contracts required by use cases.

Infrastructure and Presentation provide the concrete adapters:

```text
Application contract
        ↓
Infrastructure or Presentation adapter
        ↓
External technology
```

Examples:

```text
PasswordHasher
        ↑
BcryptPasswordHasher

AccessTokenProvider
        ↑
JwtAccessTokenProvider

ImageStorage
        ↑
LocalImageStorage
```

Busboy is a Presentation adapter because it converts an HTTP
`multipart/form-data` request into application-friendly upload input.

The local file system implementation is an Infrastructure adapter because it
persists the file outside the application core.

### 4.4 Dependency Inversion

High-level business rules must not depend directly on low-level technical implementations.

For example, a use case depends on:

```text
OrdersRepository
```

It does not depend on:

```text
PostgresOrdersRepository
pg.Pool
SQL statements
```

Infrastructure implements the contract required by the application.

### 4.5 Dependency Injection

Dependencies will be passed explicitly to classes and functions, preferably through constructors.

Example:

```text
CancelOrderUseCase
    receives
OrdersRepository
```

The use case must not instantiate its own database repository.

Dependency assembly will happen at the application entry point.

No dependency injection framework is required initially. Dependencies will be connected manually.

---

### 4.6 SOLID Principles

SOLID will guide the design of the application, but the principles must not be used to create unnecessary abstractions.

#### Single Responsibility Principle — SRP

Each module, class, or function should have one primary reason to change.

Examples:

```text
CancelOrderController
→ Handles the HTTP details of cancelling an order.

CancelOrderUseCase
→ Coordinates the cancellation operation.

Order
→ Protects order state and cancellation rules.

PostgresOrdersRepository
→ Persists and retrieves orders with PostgreSQL.
```

A controller must not execute SQL, and a repository must not decide whether an order can be cancelled.

#### Open/Closed Principle — OCP

Application behavior should be extensible through new implementations without requiring changes to stable business rules.

Examples:

```text
PasswordHasher
├── BcryptPasswordHasher
└── Argon2PasswordHasher

ImageStorage
├── LocalImageStorage
└── CloudImageStorage
```

The Application layer depends on contracts, allowing Infrastructure implementations to be added or replaced.

This principle must not be used to create interfaces when only one simple implementation exists and no boundary is required.

#### Liskov Substitution Principle — LSP

Any implementation of an Application contract must respect the behavior promised by that contract.

For example, every `OrdersRepository` implementation must be usable by an order use case without changing the use case's expected behavior.

```text
OrdersRepository
├── InMemoryOrdersRepository
└── PostgresOrdersRepository
```

Both implementations must follow the same expectations regarding returned entities, missing records, and persistence behavior.

#### Interface Segregation Principle — ISP

Contracts should expose only the operations required by their consumers.

Avoid broad contracts such as:

```text
GenericRepository
- create
- findAll
- findById
- update
- delete
- count
- paginate
- search
```

Prefer contracts focused on actual use-case needs:

```text
OrdersRepository
- findById
- findManyByStatus
- create
- save
```

A use case should not depend on methods it does not use.

#### Dependency Inversion Principle — DIP

High-level business rules must depend on abstractions rather than concrete technical implementations.

Example:

```text
CancelOrderUseCase
        ↓
OrdersRepository
        ↑
PostgresOrdersRepository
```

The use case depends on `OrdersRepository`, not on `pg`, PostgreSQL, or raw SQL.

This principle is implemented together with Repository contracts, Adapter implementations, and Dependency Injection.

---

## 5. Application Layers

### 5.1 Domain Layer

The Domain layer represents the pizzeria business and contains the most stable rules of the system.

#### Responsibilities

- Define entities.
- Define value objects.
- Define domain enumerations.
- Protect invariants.
- Control order status transitions.
- Perform domain calculations.
- Define domain-specific errors.
- Preserve valid domain state.

#### Main Domain Concepts

```text
User
Category
Product
Order
OrderItem
Email
Money
Quantity
UserRole
OrderStatus
```

#### Examples of Domain Rules

- A new order starts with the `DRAFT` status.
- Only draft orders can have items added, updated, or removed.
- A draft order must contain at least one item before submission.
- Only an order in preparation can be completed.
- Orders in `DRAFT` or `IN_PREPARATION` can be cancelled.
- Completed and cancelled orders cannot be modified.
- An inactive product cannot be added to a new order.
- Historical item prices must not change when a product price changes.

#### The Domain Layer Must Not Know

```text
node:http
pg
PostgreSQL
SQL
HTTP status codes
Routes
Controllers
Environment variables
```

### 5.2 Application Layer

The Application layer contains the use cases that coordinate the system's behavior.

#### Responsibilities

- Implement application workflows.
- Coordinate Domain entities.
- Define repository contracts.
- Define contracts for external services.
- Enforce application-level authorization.
- Handle entity lookup and orchestration.
- Return application results.
- Define application-specific errors.

#### Repository Contracts

The Application layer will define contracts such as:

```text
UsersRepository
CategoriesRepository
ProductsRepository
OrdersRepository
```

Possible operations include:

```text
findById
findByEmail
findMany
create
save
exists
```

Contracts must be designed around use-case needs rather than generic database CRUD.

For example, `OrdersRepository` may need operations such as:

```text
findById
findManyByStatus
create
save
```

#### External Service Contracts

The Application layer will define contracts for external capabilities:

```text
PasswordHasher
AccessTokenProvider
RefreshTokenGenerator
AuthSessionsRepository
ImageStorage
```

Current implementations:

```text
PasswordHasher          → bcrypt
AccessTokenProvider      → JWT implementation
RefreshTokenGenerator   → node:crypto
AuthSessionsRepository  → PostgreSQL
ImageStorage             → Local file system
```

The concrete JWT library remains replaceable behind `AccessTokenProvider`.

The Application layer must not depend directly on bcrypt, a JWT library,
Busboy, the local file system, or PostgreSQL.

#### The Application Layer Must Not Know

```text
HTTP request and response objects
Route paths
SQL strings
PostgreSQL table names
pg clients or pools
File system implementation details
```

### 5.3 Infrastructure Layer

The Infrastructure layer contains technical implementations required by the Application layer.

#### Responsibilities

- Connect to PostgreSQL.
- Manage the PostgreSQL connection pool.
- Execute raw, parameterized SQL.
- Implement repository contracts.
- Persist refresh-token sessions.
- Manage database transactions.
- Execute database migrations.
- Convert database rows into Domain entities.
- Convert Domain state into persistence data.
- Hash and compare passwords with bcrypt.
- Generate and verify JWT access tokens.
- Generate secure refresh tokens with `node:crypto`.
- Store product images in the local file system.
- Load and validate environment configuration.
- Execute the controlled first-administrator bootstrap workflow.

#### Initial Infrastructure Components

```text
PostgreSQL connection pool
PostgresUsersRepository
PostgresCategoriesRepository
PostgresProductsRepository
PostgresOrdersRepository
PostgresAuthSessionsRepository
BcryptPasswordHasher
JwtAccessTokenProvider
NodeRefreshTokenGenerator
LocalImageStorage
dotenv configuration loader
Admin bootstrap command
SQL migrations
```

#### Infrastructure Boundaries

PostgreSQL row structures must not leave the Infrastructure layer.

For example:

```text
Database row
created_at
unit_price
created_by_user_id
        ↓
Infrastructure conversion
        ↓
Domain/Application representation
createdAt
unitPrice
createdByUserId
```

Local file-system paths must also remain inside Infrastructure.

The Domain and Application layers work with an image reference such as
`imageKey`, not with absolute operating-system paths.

Infrastructure may depend on Application contracts and Domain entities.

Domain and Application must not depend on Infrastructure implementations.

### 5.4 Presentation Layer

The Presentation layer exposes the application through HTTP.

The project will use Node.js's native `node:http` module instead of Express,
Fastify, or another HTTP framework.

#### Responsibilities

- Start the HTTP server.
- Match requests to routes.
- Extract route parameters.
- Parse query parameters.
- Parse JSON request bodies.
- Parse `multipart/form-data` uploads with Busboy.
- Enforce request and upload size limits.
- Validate transport-level input with Zod.
- Execute authentication and authorization middleware.
- Call Application use cases.
- Convert application results into JSON.
- Map errors to HTTP responses.
- Set HTTP status codes and headers.
- Serve locally stored product images through controlled HTTP routes.

#### Presentation Components

```text
HTTP server
Router
Controllers
Middlewares
JSON body parser
Busboy multipart parser
Zod request schemas
Authentication middleware
Authorization middleware
Response helpers
Error handler
Image delivery route
```

#### The Presentation Layer Must Not

- Execute SQL.
- Access PostgreSQL directly.
- Contain core order rules.
- Change entity state without a use case.
- Import `pg` repositories directly inside controllers.
- Save files directly from controllers without using `ImageStorage`.
- Trust file names, MIME types, or paths provided by clients.

---

## 6. Application Modules

The codebase will be organized around three main business areas.

### 6.1 Identity

Responsible for:

```text
User registration
Authentication
Authenticated user profile
User listing
Role management
Initial administrator bootstrap
```

Main concepts:

```text
User
UserRole
Email
```

### 6.2 Catalog

Responsible for:

```text
Category management
Product management
Product availability
Product image references
Product filtering by category
```

Main concepts:

```text
Category
Product
Money
```

### 6.3 Orders

Responsible for:

```text
Order creation
Order item management
Order-item preparation notes
Repeated products as distinct order items
Order submission
Order completion
Order cancellation
Order listing and filtering
Order history
```

Main concepts:

```text
Order
OrderItem
OrderStatus
Quantity
Money
```

---

## 7. Request Flow

A request must pass through the layers in a predictable order.

Example: cancelling an order.

```text
PATCH /orders/:orderId/cancel
            ↓
Native HTTP Router
            ↓
Authentication Middleware
            ↓
CancelOrderController
            ↓
CancelOrderUseCase
            ↓
OrdersRepository contract
            ↑
PostgresOrdersRepository
            ↓
PostgreSQL
```

The detailed behavior is:

1. The router matches the HTTP method and path.
2. Authentication middleware identifies the current user.
3. The controller extracts and validates HTTP input.
4. The controller calls `CancelOrderUseCase`.
5. The use case loads the order through `OrdersRepository`.
6. The Domain entity verifies whether cancellation is allowed.
7. The use case asks the repository to persist the updated order.
8. Infrastructure executes parameterized SQL.
9. The controller converts the result into an HTTP response.

### Responsibility Summary

```text
Router
→ Finds the correct controller.

Middleware
→ Handles shared HTTP concerns.

Controller
→ Translates HTTP input and output.

Use Case
→ Coordinates the application operation.

Domain
→ Decides whether the business operation is valid.

Repository Contract
→ Describes required persistence operations.

PostgreSQL Repository
→ Executes SQL and persists state.
```

---

## 8. Technology Stack

### 8.1 Runtime: Node.js

Node.js will be used as the application runtime.

#### Reasons

- The application will be written in TypeScript.
- Node.js provides the native HTTP APIs required for the learning goal.
- It supports asynchronous I/O suitable for HTTP servers, streams, and database access.
- It provides native modules for HTTP, URLs, streams, buffers, files, and cryptography.

### 8.2 Language: TypeScript

TypeScript will be used as the main programming language.

#### Reasons

- Provides static typing.
- Makes layer contracts explicit.
- Improves use-case and repository interfaces.
- Helps model entities, value objects, and enumerations.
- Reduces accidental mismatches between layers.
- Improves maintainability during refactoring.

#### Naming Convention

Application and Domain code will use `camelCase`.

Examples:

```text
createdAt
updatedAt
categoryId
unitPrice
createdByUserId
```

Database columns will use `snake_case`.

Examples:

```text
created_at
updated_at
category_id
unit_price
created_by_user_id
```

Infrastructure is responsible for converting between these conventions.

#### Monetary Representation

PizzaHub uses United States Dollar (`USD`).

PostgreSQL persists product prices and historical order-item unit prices as
canonical decimal strings with exactly two fractional digits.

Examples:

```text
"5.00"
"45.90"
"120.00"
```

The database representation must not include a currency symbol or locale-specific
separator.

Infrastructure converts persisted strings into the Domain `Money`
representation and converts `Money` back into a canonical string for
persistence.

Application and Domain calculations must not rely on unsafe JavaScript
floating-point arithmetic.

### 8.3 HTTP Server: Native `node:http`

The application will use Node.js's native `node:http` module.

No HTTP framework will be used initially.

#### Learning Goals

This decision is intended to provide practical experience with:

- HTTP request and response objects.
- Methods and status codes.
- Headers.
- URL parsing.
- Query parameters.
- Route parameters.
- JSON body parsing.
- Streams.
- Middleware execution.
- Centralized error handling.
- Authentication flow.
- Response serialization.

#### Scope Limitation

The project will not attempt to create a complete general-purpose web framework.

Only the features required by PizzaHub will be implemented:

```text
Router
Route parameters
Query parameters
JSON body parser
Multipart parser integration
Middleware pipeline
Error handler
Authentication middleware
Authorization middleware
Response helpers
```

### 8.4 Database: PostgreSQL

PostgreSQL will be used as the relational database.

#### Reasons

The PizzaHub domain has clear relational structures:

```text
User 1 ─── N Order
Category 1 ─── N Product
Order 1 ─── N OrderItem
Product 1 ─── N OrderItem
User 1 ─── N AuthSession
```

PostgreSQL provides support for:

- Primary and foreign keys.
- Unique constraints.
- Check constraints.
- Transactions.
- Indexes.
- Joins.
- Aggregations.
- Row locking.
- Consistent relational data.

### 8.5 Database Driver: `node-postgres` (`pg`)

The application will use the `pg` package to communicate with PostgreSQL.

`pg` is a database driver, not an ORM.

#### Responsibilities

- Create database connections.
- Manage a connection pool.
- Send SQL statements.
- Bind query parameters.
- Return database rows.
- Provide transaction clients.

The `pg` package must only be imported by Infrastructure code.

### 8.6 Query Approach: Raw SQL

No ORM will be used.

All database operations will be implemented using raw SQL inside Infrastructure repository implementations.

#### Reasons

- Deepen SQL knowledge.
- Practice joins and relational modeling.
- Understand database constraints.
- Learn query parameterization.
- Learn transactions directly.
- Learn indexing and query plans.
- Avoid hiding database behavior behind an ORM.
- Make the persistence implementation explicit.

#### Required SQL Practices

All user-provided values must use parameterized queries.

Correct:

```sql
SELECT
    id,
    name,
    email
FROM users
WHERE email = $1;
```

Incorrect:

```text
SELECT * FROM users WHERE email = '${email}';
```

SQL queries must not be built through unsafe string concatenation.

### 8.7 Validation: Zod

Zod will validate data at application boundaries.

It will be used for:

```text
JSON request bodies
Route parameters
Query parameters
Environment variables
Upload metadata
```

Zod schemas belong to Presentation or configuration boundaries.

Domain entities must still protect business invariants independently of Zod.

### 8.8 Password Hashing: bcrypt

The `bcrypt` package will hash and compare user passwords.

It will be hidden behind the Application contract:

```text
PasswordHasher
        ↑
BcryptPasswordHasher
```

Password hashes are stored in PostgreSQL.

Plain-text passwords must never be logged or persisted.

`bcrypt` is a Node package with native implementation details; it is not part
of the Node.js standard library.

### 8.9 Authentication: JWT Access Tokens and Refresh Tokens

The authentication strategy will use:

```text
Short-lived JWT access token
+
Opaque rotating refresh token
+
PostgreSQL-backed authentication session
```

The access token is validated without a session lookup during normal requests.

The refresh token is used only to renew authentication and is represented in
PostgreSQL by a cryptographic hash.

Main components:

```text
AccessTokenProvider
RefreshTokenGenerator
AuthSessionsRepository
```

Refresh tokens are generated with `node:crypto`.

The exact JWT library and signing algorithm remain replaceable behind
`AccessTokenProvider`.

### 8.10 Multipart Upload Parsing: Busboy

Busboy will parse `multipart/form-data` requests.

Busboy is responsible for:

- Separating text fields from file parts.
- Exposing uploaded files as streams.
- Enforcing part, field, and file-size limits.
- Integrating directly with the native Node.js request stream.

Busboy does not decide where files are permanently stored.

### 8.11 Image Storage: Local File System

Product images will initially be stored in the local file system.

The implementation will be hidden behind:

```text
ImageStorage
        ↑
LocalImageStorage
```

Files will be stored under an application-controlled directory such as:

```text
uploads/products/
```

A persistent Docker volume must be mounted so images survive container
recreation.

PostgreSQL stores only the image reference and metadata, not the binary file.

Preferred persisted fields:

```text
image_key
image_mime_type
image_size
```

### 8.12 Testing: Vitest, Supertest, and Playwright

#### Vitest

Vitest will be the main test runner for:

- Domain unit tests.
- Application use-case tests.
- Infrastructure integration tests.
- Test doubles and in-memory repositories.

#### Supertest

Supertest will test the HTTP API against the native Node.js server.

It will cover:

- Routes.
- Request parsing.
- Controllers.
- Authentication middleware.
- Status codes.
- Response bodies.
- Upload endpoints.

#### Playwright

Playwright will cover complete user flows when a browser-based client is
available.

It is intended for full-system end-to-end tests rather than isolated
Application or Domain tests.

### 8.13 Environment Variables: dotenv

`dotenv` will load local environment variables into `process.env`.

Environment values must be validated once during application startup with Zod.

Examples:

```text
PORT
DATABASE_URL
JWT_ACCESS_SECRET
ACCESS_TOKEN_TTL
REFRESH_TOKEN_TTL
UPLOAD_DIRECTORY
MAX_UPLOAD_SIZE
```

Application code must receive configuration through typed configuration
objects rather than reading `process.env` throughout the codebase.

### 8.14 Development Environment: Docker Compose

Docker Compose will orchestrate the development environment.

Initial services and resources:

```text
PizzaHub API
PostgreSQL
Persistent PostgreSQL volume
Persistent product-image volume
```

Redis is not required for the initial authentication implementation.

Refresh sessions will initially be persisted in PostgreSQL.

### 8.15 Linting and Formatting

ESLint will enforce code-quality and consistency rules.

Prettier will handle deterministic source formatting.

The tools must have separate responsibilities:

```text
ESLint  → code-quality rules
Prettier → formatting
```

Formatting rules should not be duplicated unnecessarily in ESLint.

## 9. Native HTTP Design

### 9.1 Router

The router must match requests using:

```text
HTTP method
Path pattern
```

Example:

```text
PATCH /orders/:orderId/cancel
```

The router must extract:

```text
orderId
```

The router is responsible only for selecting the correct middleware and controller.

It must not contain business rules.

### 9.2 JSON Body Parser

The JSON body parser must:

- Read the request stream.
- Enforce a maximum body size.
- Reject malformed JSON.
- Return a parsed object.
- Handle empty bodies when allowed.
- Reject unsupported content types when appropriate.

### 9.3 Middleware Pipeline

The HTTP layer will support a small middleware pipeline.

Initial middleware responsibilities may include:

```text
Authentication
Role authorization
Request logging
CORS
Body parsing
Error handling
```

Middleware must remain focused on transport-level concerns.

Business authorization that is critical to a use case must also be protected inside the Application layer.

### 9.4 Controllers

Controllers must remain thin.

A controller may:

- Read route parameters.
- Read query parameters.
- Read validated request data.
- Read authenticated user information.
- Call one use case.
- Return an HTTP response.

A controller must not:

- Execute SQL.
- Create database connections.
- Implement order status rules.
- Hash passwords directly.
- Generate tokens directly.
- Contain reusable business logic.

### 9.5 HTTP Error Handling

Domain and Application errors must be mapped to HTTP responses in the Presentation layer.

Examples:

```text
Validation error          → 400 Bad Request
Invalid credentials       → 401 Unauthorized
Missing authentication    → 401 Unauthorized
Insufficient permission   → 403 Forbidden
Entity not found          → 404 Not Found
Duplicate email/category  → 409 Conflict
Payload too large         → 413 Payload Too Large
Unsupported media type    → 415 Unsupported Media Type
Unexpected error          → 500 Internal Server Error
```

Domain and Application errors must not store HTTP status codes.

The HTTP error handler performs the mapping.

### 9.6 Multipart Upload Parser

Busboy will be created only for routes that accept `multipart/form-data`.

The parser must:

- Accept only the expected file field.
- Limit the request to one product image.
- Enforce maximum file and field sizes.
- Stop processing when a configured limit is exceeded.
- Expose the file as a stream.
- Convert parsed fields into a transport input.
- Clean up partial files when the request fails.

The parser must not store business data or call PostgreSQL.

### 9.7 Local Image Delivery

The HTTP layer may expose a controlled route for product images.

Example:

```text
GET /images/products/:imageKey
```

The route must validate the image key and must not accept arbitrary file-system
paths.

Path traversal sequences and user-provided absolute paths must be rejected.

A reverse proxy or object storage service may replace this delivery mechanism
in production without changing the Application layer.

---

## 10. Persistence Strategy

### 10.1 Connection Pool

The application will use a PostgreSQL connection pool.

A new connection must not be created manually for every HTTP request.

The pool will be created once during application startup and reused by repository implementations.

### 10.2 Repository Implementations

Infrastructure repositories will contain raw SQL.

Example responsibilities:

```text
PostgresUsersRepository
- Insert users.
- Find users by ID or email.
- List users.
- Update roles.

PostgresProductsRepository
- Insert products.
- Find products.
- Filter by category.
- Update product state.

PostgresOrdersRepository
- Insert orders.
- Load orders and items.
- Filter orders by status.
- Persist order status changes.
```

Repositories must return Domain entities or Application result structures rather than raw database rows.

### 10.3 Transactions

A transaction must use the same PostgreSQL client from beginning to end.

Conceptual flow:

```text
Acquire client
    ↓
BEGIN
    ↓
Execute all related statements
    ↓
COMMIT
    ↓
Release client
```

On failure:

```text
ROLLBACK
    ↓
Release client
```

Transactions will be used when an operation performs multiple database changes that must succeed or fail together.

Possible examples:

- Creating an order and its initial items.
- Persisting changes involving an order and multiple order items.
- Updating multiple records that must remain consistent.

A formal Unit of Work abstraction is not part of the initial architecture. It may be introduced later if repeated transaction coordination creates a concrete need.

### 10.4 Database Migrations

Database changes will be versioned through SQL migration files.

Proposed structure:

```text
database/
└── migrations/
    ├── 001_create_users.sql
    ├── 002_create_categories.sql
    ├── 003_create_products.sql
    ├── 004_create_orders.sql
    └── 005_create_order_items.sql
```

Each migration must:

- Have a unique sequence number.
- Represent one controlled schema change.
- Be stored in version control.
- Be reproducible in a new environment.
- Avoid undocumented manual database changes.

A migration runner may be created later, or migrations may initially be executed with PostgreSQL tooling.

### 10.5 Database Constraints

Important domain rules should also be reinforced by database constraints when appropriate.

Examples:

```text
Unique user email
Unique category name
Positive product price
Positive order item quantity
Valid foreign keys
Non-null required fields
```

Database constraints complement Domain validation.

They do not replace Domain rules.

### 10.6 Historical Order Data

When a product is added to an order, the order item must preserve the relevant product information.

At minimum:

```text
productId
productName
unitPrice
quantity
notes
```

Future product changes must not alter previous orders.

Products referenced by order history should be deactivated rather than removed from historical records.

The `order_items` table must not define a unique constraint on
`(order_id, product_id)`, because the same product may appear in multiple
distinct order items with different preparation notes.

Each order item is uniquely identified by its own `id`.

### 10.7 Concurrency

Order state changes may be requested by different staff members at nearly the same time.

Examples:

```text
One request attempts to complete an order.
Another request attempts to cancel the same order.
```

Persistence logic must prevent invalid final states.

Possible PostgreSQL mechanisms include:

```text
Conditional UPDATE statements
Transactions
Row-level locking
Version checking
```

The exact concurrency strategy will be defined during implementation.

---

## 11. Authentication and Authorization

The application has two roles:

```text
ADMIN
STAFF
```

### 11.1 Authentication Strategy

PizzaHub will use a hybrid token strategy:

```text
JWT access token
+
Opaque rotating refresh token
+
Server-side refresh session
```

#### Access Token

The access token:

- Uses the JWT format.
- Has a short lifetime.
- Is sent in `Authorization: Bearer <token>`.
- Is not stored in PostgreSQL.
- Is verified through `AccessTokenProvider`.
- Contains only the claims required by the API.

Expected claims:

```text
sub
role
iss
aud
iat
exp
jti
```

Sensitive personal data, password hashes, and session details must not be
placed in the JWT payload.

#### Refresh Token

The refresh token:

- Is an opaque, cryptographically random value.
- Has a longer lifetime than the access token.
- Is generated with `node:crypto`.
- Is rotated whenever it is successfully used.
- Is never stored in plain text in PostgreSQL.
- Is used only by the refresh endpoint.

The server stores a deterministic cryptographic hash of the refresh token.

bcrypt is not required for refresh-token hashing because refresh tokens are
already high-entropy random secrets. A fast cryptographic hash from
`node:crypto`, such as SHA-256, is appropriate for lookup.

### 11.2 Authentication Sessions

Refresh-token state will be stored in PostgreSQL.

Conceptual table:

```text
auth_sessions
- id
- user_id
- refresh_token_hash
- token_family_id
- created_at
- last_used_at
- expires_at
- revoked_at
- created_ip
- last_ip
- user_agent
```

The IP address and User-Agent may be stored as security metadata.

A change of IP must not be the only reason to accept or reject a token.

### 11.3 Refresh Token Rotation

Every successful refresh operation must:

1. Validate the current refresh token.
2. Revoke or replace the current token.
3. Generate a new access token.
4. Generate a new refresh token.
5. Persist the hash of the new refresh token.

Reusing a previously rotated refresh token may indicate token theft.

When reuse is detected, the entire token family may be revoked.

### 11.4 Logout and Revocation

The current implementation supports:

- Revoking the current refresh session through logout.
- Revoking all refresh sessions owned by the authenticated user.
- Revoking a target user's refresh sessions when an administrator changes that user's role.
- Revoking a token family when refresh-token reuse is detected.

An already-issued access token may remain valid until its short expiration
time.

The current implementation does not include password changes, user-account
deactivation, administrator-initiated revocation of another user's sessions,
or a system-wide administrator logout.

### 11.5 Client Storage

For browser clients:

```text
Access token  → application memory
Refresh token → HttpOnly, Secure, SameSite cookie
```

For mobile or desktop clients:

```text
Access token  → memory
Refresh token → platform-provided secure storage
```

Refresh tokens must not be stored in plain-text files or browser
`localStorage`.

### 11.6 Authorization

Authorization determines what the authenticated user is allowed to do.

`STAFF` can:

- Create and manage draft orders.
- Submit orders.
- Complete orders.
- Cancel orders in draft or preparation.
- View products and categories.

`ADMIN` can perform all `STAFF` operations and also:

- Manage users and roles.
- Create, update, and delete categories.
- Create, update, and delete products.

Authorization must not exist only as route middleware.

Administrative use cases must also verify the current user's permissions.

The role-change use case must reject the operation when the authenticated
administrator and the target user have the same identifier.

```text
currentUserId == targetUserId
→ reject role change
```

### 11.7 First Administrator Bootstrap

The first `ADMIN` user will be created through a controlled command:

```text
npm run bootstrap:admin
```

The bootstrap command is not an HTTP endpoint.

It must reuse the same Application contracts and security adapters used by the
regular application flow:

```text
Bootstrap command
        ↓
BootstrapAdminUseCase
        ↓
UsersRepository
PasswordHasher
```

The command must:

- receive or securely prompt for name, email, and password;
- validate its input;
- hash the password with `PasswordHasher`;
- reject duplicate email addresses;
- create the user with the `ADMIN` role;
- avoid hard-coded credentials;
- return a non-zero process status on failure.

### 11.8 Future Authentication Capabilities

The following capabilities are intentionally outside the initial architecture
scope:

```text
Password change
User-account activation and deactivation
Administrator revocation of another user's sessions
System-wide administrator logout
```

They may be introduced later through new use cases and routes.

When implemented, password changes and user deactivation must revoke all
refresh sessions belonging to the affected user.

Administrator-initiated session revocation must be protected by application-level
authorization and must not rely only on route middleware.

These capabilities must not be included in the initial implementation tasks.

---

## 12. Validation

Validation will happen at different boundaries.

### 12.1 Presentation Validation with Zod

Zod will validate transport-level input:

```text
Required fields
String formats
Route parameter formats
Query parameter formats
JSON structure
Multipart text fields
Order-item notes
Upload metadata
Environment variables
```

Zod validation failures are converted into Presentation errors.

### 12.2 Domain Validation

Domain objects remain responsible for business invariants:

```text
Positive product price
Positive item quantity
Valid order-item notes
Repeated products as distinct order items
Valid order status transitions
Non-empty order before submission
Immutability of completed and cancelled orders
```

A value accepted by Zod may still be rejected by the Domain.

The Domain layer must not import or depend on Zod.

### 12.3 File Validation

File validation must not trust only the original extension or client-provided
MIME type.

The upload boundary must enforce:

- One image per request.
- Configured maximum size.
- Allowed media types.
- Generated server-side file names.
- Rejection of unsafe paths and file names.
- Cleanup of incomplete uploads.

Content-level image inspection or normalization may be added later.

---

## 13. Password Security

Passwords must never be stored as plain text.

The Application layer depends on:

```text
PasswordHasher
- hash
- compare
```

Infrastructure provides:

```text
BcryptPasswordHasher
```

The bcrypt work factor must be configurable and selected according to the
deployment environment.

Authentication error messages must not reveal whether an email exists.

Passwords and hashes must never be logged.

Password changes must revoke all active refresh sessions for the user.

---

## 14. Product Image Upload and Storage

Product image handling is divided into two independent responsibilities:

```text
Busboy
→ Parses the incoming multipart HTTP request.

ImageStorage
→ Persists or removes the image.
```

Busboy must not be treated as the permanent storage mechanism.

### 14.1 Upload Flow

```text
Client
   ↓ multipart/form-data
Native Node.js HTTP route
   ↓
Busboy multipart parser
   ↓ file stream + validated fields
Controller
   ↓
Application use case
   ↓
ImageStorage contract
   ↑
LocalImageStorage
   ↓
Persistent uploads directory
```

### 14.2 Application Contract

The Application layer defines an abstraction such as:

```text
ImageStorage
- upload
- delete
```

A stored image result should provide a stable reference:

```text
StoredImage
- key
- mimeType
- size
```

### 14.3 Local Storage Implementation

The initial implementation will store product images locally:

```text
uploads/
└── products/
    └── generated-file-name
```

The final file name must be generated by the application and must not use the
client's original file name as a path.

The upload directory must be configured through an environment variable.

### 14.4 Docker Persistence

The upload directory must use a persistent Docker volume.

Without a volume, product images may disappear when the API container is
recreated.

Conceptual Docker Compose resources:

```text
postgres_data
product_images
```

### 14.5 Database Representation

PostgreSQL must not store the image binary.

The product stores an image reference and metadata:

```text
image_key
image_mime_type
image_size
```

`image_key` is preferred over an absolute local path or permanent public URL.

The Presentation layer may convert the key into a delivery URL.

The Domain model should be aligned to use `imageKey` or a storage-neutral image
reference instead of coupling the product to a local path.

### 14.6 Replacement in Production

The Application contract allows another adapter to replace local storage:

```text
ImageStorage
├── LocalImageStorage
├── S3CompatibleImageStorage
└── CloudImageStorage
```

The first version will use only `LocalImageStorage`.

Image optimization with a library such as Sharp and object storage are future
options, not initial requirements.

---

## 15. Testing Strategy

The project will use Vitest, Supertest, and Playwright.

### 15.1 Domain Unit Tests — Vitest

Test entities and value objects without HTTP or PostgreSQL.

Examples:

```text
Order starts as DRAFT
Draft order accepts items
The same product can be added as multiple distinct items
Order-item notes are preserved
Empty notes become null
Notes longer than 500 characters are rejected
Order without items cannot be submitted
IN_PREPARATION order can be completed
DRAFT order can be cancelled
IN_PREPARATION order can be cancelled
Completed order cannot be cancelled
Cancelled order cannot be modified
```

### 15.2 Application Unit Tests — Vitest

Test use cases using in-memory repository and service adapters.

Examples:

```text
RegisterUser
AuthenticateUser
RefreshAuthentication
CreateProduct
CreateOrder
AddOrderItem
SubmitOrder
CompleteOrder
CancelOrder
```

These tests must not require a running PostgreSQL instance or HTTP server.

### 15.3 Infrastructure Integration Tests — Vitest

Test:

```text
PostgreSQL repository implementations
Raw SQL queries
Database constraints
Transactions
Refresh-token rotation persistence
bcrypt adapter
Local image storage
Database migrations
```

Infrastructure tests may use temporary directories for image storage.

### 15.4 HTTP API Tests — Supertest

Supertest will exercise the native Node.js HTTP server.

It will test:

```text
Routing
JSON parsing
Zod validation
Authentication
Authorization
Error mapping
Multipart uploads
Image delivery
Status codes
Response bodies
```

### 15.5 Full-System End-to-End Tests — Playwright

Playwright will test user-visible workflows when a browser client exists.

Examples:

```text
Administrator logs in
Administrator creates a category
Administrator creates a product with an image
Staff creates and submits an order
Staff completes or cancels an order
```

Playwright is not required for isolated backend use-case tests.

---

## 16. Proposed Project Structure

```text
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── enums/
│   └── errors/
│
├── application/
│   ├── use-cases/
│   │   ├── identity/
│   │   ├── catalog/
│   │   └── orders/
│   ├── repositories/
│   │   ├── users-repository.ts
│   │   ├── auth-sessions-repository.ts
│   │   ├── categories-repository.ts
│   │   ├── products-repository.ts
│   │   └── orders-repository.ts
│   ├── services/
│   │   ├── password-hasher.ts
│   │   ├── access-token-provider.ts
│   │   ├── refresh-token-generator.ts
│   │   └── image-storage.ts
│   └── errors/
│
├── infrastructure/
│   ├── database/
│   │   └── postgres/
│   │       ├── connection/
│   │       ├── repositories/
│   │       ├── queries/
│   │       └── migrations/
│   ├── authentication/
│   │   ├── jwt-access-token-provider.ts
│   │   └── node-refresh-token-generator.ts
│   ├── cryptography/
│   │   └── bcrypt-password-hasher.ts
│   ├── storage/
│   │   └── local-image-storage.ts
│   └── config/
│       └── environment.ts
│
├── presentation/
│   └── http/
│       ├── controllers/
│       │   ├── identity/
│       │   ├── catalog/
│       │   └── orders/
│       ├── routes/
│       ├── middlewares/
│       ├── parsers/
│       │   ├── json-body-parser.ts
│       │   └── busboy-multipart-parser.ts
│       ├── validation/
│       ├── responses/
│       └── errors/
│
└── main/
    ├── dependencies/
    ├── config/
    ├── scripts/
    │   └── bootstrap-admin.ts
    └── server.ts

database/
└── migrations/

uploads/
└── products/

tests/
├── unit/
├── integration/
├── http/
└── e2e/
```

The physical structure may evolve as implementation reveals concrete needs.

The layer boundaries and dependency rules must remain stable even if folders
change.

The runtime uploads directory must not be committed with user-generated image
files.

---

## 17. Dependency Assembly

Dependencies will be assembled in the `main` area.

Example:

```text
PostgreSQL pool
       ↓
PostgresOrdersRepository
       ↓
CancelOrderUseCase
       ↓
CancelOrderController
       ↓
HTTP route
```

Only the application entry point should know the concrete dependency graph.

Controllers and use cases must receive their dependencies rather than instantiate them.

No Dependency Injection container will be used initially.

---

## 18. Architectural Decisions

### AD01 — Clean Architecture

The application will be separated into Domain, Application, Infrastructure, and Presentation layers.

### AD02 — Native Node.js HTTP Server

The HTTP interface will use `node:http` without Express, Fastify, or another framework.

### AD03 — Raw SQL

Database operations will use raw SQL rather than an ORM.

### AD04 — PostgreSQL

PostgreSQL will be the relational database.

### AD05 — `node-postgres`

The `pg` driver will connect Node.js to PostgreSQL.

### AD06 — Repository Contracts

The Application layer will define repository contracts based on use-case needs.

### AD07 — Infrastructure Repository Implementations

Infrastructure will implement repository contracts using PostgreSQL and raw SQL.

### AD08 — Domain Independence

Domain code will not depend on Node HTTP, PostgreSQL, `pg`, SQL, or external libraries.

### AD09 — Manual Dependency Injection

Dependencies will initially be connected manually at the application entry point.

### AD10 — Parameterized Queries

All dynamic query values must use PostgreSQL parameters.

### AD11 — SQL Migrations

Schema changes will be versioned as SQL migration files.

### AD12 — Naming Conventions

Domain and Application use `camelCase`; PostgreSQL uses `snake_case`.

### AD13 — No Premature Patterns

Additional patterns will only be introduced when a concrete problem justifies them.

Patterns such as Unit of Work, Domain Events, Strategy, or Specification are not part of the initial implementation.

### AD14 — SOLID Principles

SOLID principles will guide responsibility boundaries, contract design, substitutability, and dependency direction.

They must be applied pragmatically and must not justify abstractions without a concrete architectural or business need.

### AD15 — Zod Validation

Zod will validate transport input and environment configuration without entering the Domain layer.

### AD16 — bcrypt Password Hashing

bcrypt will implement the `PasswordHasher` application contract.

### AD17 — JWT and Refresh Tokens

Authentication will use short-lived JWT access tokens and rotating opaque refresh tokens.

### AD18 — PostgreSQL Refresh Sessions

Refresh-token hashes, expiration, rotation, and revocation state will be stored in PostgreSQL.

Redis is not part of the initial authentication architecture.

### AD19 — Busboy Multipart Parsing

Busboy will parse product-image uploads directly from the native Node.js request stream.

### AD20 — Local Image Storage

Product images will initially be stored in a persistent local directory through `LocalImageStorage`.

### AD21 — Image Reference Persistence

PostgreSQL will store an `imageKey` and metadata rather than image binaries or absolute local paths.

### AD22 — Testing Tools

Vitest will cover unit and integration tests, Supertest will cover HTTP API tests, and Playwright will cover browser-based end-to-end flows.

### AD23 — Environment Configuration

dotenv will load local environment variables, and Zod will validate them at application startup.

### AD24 — Docker Compose

Docker Compose will manage the development services and persistent data volumes.

### AD25 — Code Quality

ESLint will enforce code-quality rules, and Prettier will handle formatting.

### AD26 — Password Hash Attribute

User persistence and Domain entities use `passwordHash`; plain-text passwords
exist only temporarily at registration and authentication boundaries.

### AD27 — Initial Administrator Bootstrap

The first `ADMIN` is created through the controlled
`npm run bootstrap:admin` command, not through a public HTTP route.

### AD28 — Monetary Persistence

The system currency is `USD`. PostgreSQL persists monetary amounts as validated
canonical decimal strings with exactly two fractional digits.

### AD29 — Required Table Number

Every order requires a non-empty `tableNumber`; `customerName` remains optional.

### AD30 — Self Role Change Prohibition

An administrator may change another user's role but cannot change their own
role.

### AD31 — Deferred User Security Features

Password changes, user-account deactivation, administrator revocation of
another user's sessions, and system-wide logout are deferred to a possible
future version.

### AD32 — Distinct Repeated Order Items

The same product may appear in multiple distinct order items in one order.

Every add-item operation creates a new `OrderItem`; the system does not merge
items automatically.

### AD33 — Order-Item Notes

`OrderItem` contains optional preparation notes. Notes are trimmed, limited to
500 characters, represented as `null` when empty, and preserved in order
history.

---

## 19. Open Technology Decisions

The core architecture is sufficiently defined to begin implementation.

The following secondary decisions may be made later:

```text
JWT library and signing algorithm
Exact access-token and refresh-token lifetimes
API documentation tooling
Structured logging solution
Rate-limiting strategy
Image normalization or resizing
Production object-storage provider
CI/CD pipeline
Production hosting and reverse proxy
Monitoring and observability
```

These decisions must preserve the dependency rules defined in this document.

For example:

- A JWT library must remain behind `AccessTokenProvider`.
- A production storage provider must implement `ImageStorage`.
- Logging must not expose passwords, tokens, or sensitive request data.
- Rate limiting belongs at the Presentation or deployment boundary.
- Image processing must not become a Domain dependency.

---

## 20. Architecture Constraints

The following constraints apply throughout the project:

- Controllers must not access the database directly.
- Routes must not contain business rules.
- Use cases must not know HTTP status codes.
- Domain entities must not import Infrastructure types.
- Raw SQL must exist only in Infrastructure.
- PostgreSQL rows must not be exposed as Domain entities without conversion.
- Repository implementations must not decide order business rules.
- Classes and modules must have focused responsibilities.
- Repository and service contracts must not expose unrelated operations.
- Contract implementations must preserve the behavior expected by their consumers.
- Authentication middleware must not replace authorization inside protected use cases.
- The role-change use case must reject attempts by an administrator to change their own role.
- JWT payloads must not contain passwords, hashes, or unnecessary sensitive data.
- Refresh tokens must not be persisted in plain text.
- Refresh-token rotation and revocation must be enforced by the Application workflow.
- Passwords, access tokens, and refresh tokens must never be logged.
- User entities and persistence models must use `passwordHash`, not `password`.
- Bootstrap credentials must never be hard-coded.
- Monetary strings must use the validated canonical USD format.
- Every order must have a non-empty `tableNumber`.
- Busboy must be used only at the HTTP boundary.
- Controllers must not write files directly.
- Uploaded file names and paths must not be trusted.
- Upload size and quantity limits must be enforced.
- Product images must survive Docker container recreation through a persistent volume.
- PostgreSQL must store image references, not image binary data.
- Completed and cancelled orders must remain immutable.
- The database must not enforce uniqueness on `(order_id, product_id)`.
- Order-item notes must be validated and preserved in historical records.
- Adding a product must create a distinct order item rather than merging it automatically.
- Tests of Domain and Application must run without PostgreSQL.
- New dependencies must respect the dependency direction.
