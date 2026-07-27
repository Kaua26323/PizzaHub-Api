# PizzaHub

## 1. Overview

PizzaHub is a backend API for managing a pizzeria's product catalog and order workflow.

The system allows staff members to create, update, submit, and complete customer orders. Administrators can perform all staff operations and are also responsible for managing users, product categories, and products.

## 2. User Roles

The system has two user roles:

### ADMIN

Administrators have full access to the system.

They can:

- Manage users and their roles.
- Manage product categories.
- Manage products.
- Create and manage orders.
- Submit orders for preparation.
- Complete or cancel orders.

### STAFF

Staff members are responsible for the pizzeria's daily operations.

They can:

- Create orders.
- Add, update, or remove items from draft orders.
- Submit orders for preparation.
- View the order queue.
- Complete orders.
- Cancel orders in draft or preparation.

Staff members cannot manage users, categories, or products.

## 3. Functional Requirements

### Authentication and Users

- **FR01:** A user must be able to register using a name, email, and password.
- **FR02:** A user must be able to log in using valid credentials.
- **FR03:** After a successful login, the API must generate a short-lived JWT access token and an opaque refresh token.
- **FR04:** A user must be able to obtain a new access token by presenting a valid refresh token.
- **FR05:** A refresh token must be rotated whenever it is successfully used.
- **FR06:** A user must be able to log out from their current authentication session.
- **FR07:** A user must be able to revoke all of their active authentication sessions.
- **FR08:** An authenticated user must be able to retrieve their own profile information.
- **FR09:** Users registered through the public registration route must receive the `STAFF` role by default.
- **FR10:** A user must not be able to assign themselves the `ADMIN` role.
- **FR11:** An administrator must be able to list registered users.
- **FR12:** An administrator must be able to change another user's role.
- **FR13:** Changing a user's role must revoke that user's active refresh-token sessions.
- **FR14:** Refresh tokens must never be stored in plain text by the server.
- **FR15:** The system must provide a controlled bootstrap command for creating the first `ADMIN` user.

### Categories

- **FR16:** Authenticated users must be able to list all product categories.
- **FR17:** An administrator must be able to create a category.
- **FR18:** An administrator must be able to update a category.
- **FR19:** An administrator must be able to delete a category.

### Products

- **FR20:** Authenticated users must be able to list all products.
- **FR21:** Products must be filterable by category.
- **FR22:** An administrator must be able to create a product by sending its data and image in a single `multipart/form-data` request.
- **FR23:** A product must contain a name, price, description, image, category, and availability status.
- **FR24:** An administrator must be able to update a product's data and optionally replace its image.
- **FR25:** An administrator must be able to permanently delete a product only when it is not referenced by any order item.
- **FR26:** An administrator must be able to activate or deactivate a product by changing its `isActive` status.

### Orders

- **FR27:** A staff member or administrator must be able to create a draft order with a required `tableNumber` and an optional `customerName`.
- **FR28:** A staff member or administrator must be able to add one or more items to a draft order.
- **FR29:** Each order item must reference a product, contain a quantity, and may contain optional preparation notes.
- **FR30:** The same product may appear in multiple distinct order items within the same order.
- **FR31:** Each order item represents one product configuration, and its quantity indicates how many units share the same notes.
- **FR32:** A staff member or administrator must be able to update the quantity and notes of an order item.
- **FR33:** A staff member or administrator must be able to remove an item from a draft order.
- **FR34:** An authenticated user must be able to retrieve the details of an order.
- **FR35:** An authenticated user must be able to list orders.
- **FR36:** Orders must be filterable by status.
- **FR37:** A staff member or administrator must be able to submit a draft order for preparation.
- **FR38:** A staff member or administrator must be able to view orders waiting for preparation.
- **FR39:** A staff member or administrator must be able to mark an order as completed.
- **FR40:** A staff member or administrator must be able to cancel an order in `DRAFT` or `IN_PREPARATION`.
- **FR41:** The system must record which user created each order.
- **FR42:** The system must record when an order was created, submitted, completed, or cancelled.

## 4. Order Statuses

An order must have one of the following statuses:

- `DRAFT`: The order has been created and its items can still be changed.
- `IN_PREPARATION`: The order has been submitted for preparation.
- `COMPLETED`: The order has been prepared and completed.
- `CANCELLED`: The order was cancelled before completion.

The standard order flow is:

```text
DRAFT → IN_PREPARATION → COMPLETED
```

An order may also be cancelled while it is in `DRAFT` or `IN_PREPARATION`.

Cancellation Flows:

```text
DRAFT → CANCELLED
```

```text
DRAFT → IN_PREPARATION → CANCELLED
```

## 5. API Routes

All private routes require a valid authentication token.

### Authentication

- `POST /auth/register` — Register a new user with the `STAFF` role.
- `POST /auth/login` — Authenticate a user and issue an access token and refresh token.
- `POST /auth/refresh` — Rotate a valid refresh token and issue a new access token and refresh token.
- `POST /auth/logout` — Revoke the current refresh-token session.
- `POST /auth/logout-all` — Revoke all refresh-token sessions owned by the authenticated user.

The first administrator is not created through a public HTTP route. It is created through the controlled bootstrap command:

```text
npm run bootstrap:admin
```

### Users

- `GET /users/me` — Retrieve the authenticated user's information.
- `GET /users` — List registered users. **Requires ADMIN role.**
- `PATCH /users/:userId/role` — Change another user's role. An administrator cannot target their own user ID. **Requires ADMIN role.**

### Categories

- `GET /categories` — List all categories.
- `POST /categories` — Create a category. **Requires ADMIN role.**
- `PATCH /categories/:categoryId` — Update a category. **Requires ADMIN role.**
- `DELETE /categories/:categoryId` — Delete a category. **Requires ADMIN role.**

### Products

- `GET /products` — List all products.
- `GET /products?categoryId=:categoryId` — List products by category.
- `POST /products` — Create a product by sending its data and image as `multipart/form-data`. **Requires ADMIN role.**
- `PATCH /products/:productId` — Update product data and optionally replace its image using `multipart/form-data`. **Requires ADMIN role.**
- `PATCH /products/:productId/status` — Change the product's `isActive` value. **Requires ADMIN role.**
- `DELETE /products/:productId` — Permanently delete a product only when it has no order history. **Requires ADMIN role.**

### Orders

- `POST /orders` — Create a draft order.
- `GET /orders` — List orders with optional status filters.
- `GET /orders/:orderId` — Retrieve the details of an order.
- `PATCH /orders/:orderId/submit` — Submit a draft order for preparation.
- `PATCH /orders/:orderId/complete` — Mark an order as completed.
- `PATCH /orders/:orderId/cancel` — Cancel an order in draft or preparation.

### Order Items

- `POST /orders/:orderId/items` — Create a new order item with a product, quantity, and optional notes. Each request creates a distinct order item.
- `PATCH /orders/:orderId/items/:itemId` — Update an item's quantity and/or notes.
- `DELETE /orders/:orderId/items/:itemId` — Remove an item from a draft order.

## 6. Business Rules

- **BR01:** Only administrators can create, update, delete, activate, or deactivate categories and products.
- **BR02:** A category can contain multiple products.
- **BR03:** Each product must belong to exactly one category.
- **BR04:** An order can contain multiple order items.
- **BR05:** Each order item must reference exactly one product.
- **BR06:** A product can appear in multiple orders.
- **BR06A:** Every order must have a non-empty `tableNumber`.
- **BR06B:** `customerName` is optional.
- **BR07:** Only draft orders can have items added, updated, or removed.
- **BR08:** An order must contain at least one item before being submitted.
- **BR09:** Only draft orders can be submitted for preparation.
- **BR10:** Only orders in preparation can be marked as completed.
- **BR11:** Only orders in `DRAFT` or `IN_PREPARATION` can be cancelled.
- **BR12:** Completed orders cannot be modified or cancelled.
- **BR13:** Cancelled orders cannot be modified, submitted, or completed.
- **BR14:** The quantity of an order item must be greater than zero.
- **BR15:** The price of a product must be greater than zero.
- **BR15A:** Product prices and historical order-item unit prices use United States Dollar (`USD`).
- **BR15B:** Monetary values must be persisted as canonical decimal strings using two fractional digits, such as `"45.90"`.
- **BR16:** A user cannot assign themselves an administrator role during registration.
- **BR17:** A category containing products cannot be deleted until its products are removed or reassigned.
- **BR18:** An order item must preserve the product price recorded when the item was added.
- **BR19:** Access tokens must have a short expiration time.
- **BR20:** Refresh tokens must be opaque, cryptographically random values.
- **BR21:** The server must store only a cryptographic hash of each refresh token.
- **BR22:** A successfully used refresh token must be invalidated and replaced with a new refresh token.
- **BR23:** Reuse of a previously rotated refresh token may revoke the complete token family.
- **BR24:** Logout must revoke the corresponding refresh-token session.
- **BR25:** Changing a user's role must revoke that user's active refresh-token sessions.
- **BR26:** A product may be permanently deleted only when no `OrderItem` references it.
- **BR27:** When a product has order history, permanent deletion must be rejected and the product may only be deactivated.
- **BR28:** Changing `isActive` must not remove or alter the product's historical order references.
- **BR29:** An inactive product cannot be added to new orders.
- **BR30:** An administrator cannot change their own role.
- **BR31:** An order may contain multiple order items that reference the same product.
- **BR32:** Adding a product to a draft order must create a new order item instead of merging it with an existing item.
- **BR33:** Each order item represents a specific product configuration.
- **BR34:** The quantity of an order item indicates how many units share the same preparation notes.
- **BR35:** Order-item notes are optional, must be trimmed, and an empty value must be stored as `null`.
- **BR36:** Order-item notes must not exceed 500 characters.
- **BR37:** Order-item notes must be preserved as part of the historical order record.

## 7. Non-Functional Requirements

- **NFR01:** The API must be consumable by web and mobile clients.
- **NFR02:** The API must exchange data using JSON, except for endpoints that upload files, which must use `multipart/form-data`.
- **NFR03:** Private routes must require authentication.
- **NFR04:** User passwords must never be stored as plain text.
- **NFR05:** The API must validate all incoming request data.
- **NFR06:** The API must return consistent HTTP status codes and error responses.
- **NFR07:** Under normal operating conditions, 95% of API requests must respond in less than two seconds.
- **NFR08:** Uploaded product images must have their file type and size validated.
- **NFR09:** Core business rules and order workflows must be covered by automated tests.
- **NFR10:** Refresh-token session state must be persisted in PostgreSQL.
- **NFR11:** Access tokens, refresh tokens, passwords, and password hashes must never be written to application logs.
- **NFR12:** The bootstrap command must create an `ADMIN` through a controlled, explicit execution and must not contain a hard-coded password.
- **NFR13:** Monetary values persisted in PostgreSQL must use a validated canonical decimal-string format.

---

## 8. Future Considerations

The following authentication and user-management capabilities are not part of
the current implementation scope, but may be added in a future version:

- Allowing an authenticated user to change their password.
- Allowing an administrator to activate or deactivate user accounts.
- Allowing an administrator to revoke another user's authentication sessions.
- Allowing an administrator to trigger a system-wide logout.

When implemented, these operations should revoke the affected refresh-token
sessions.

These capabilities must not be included in the initial `tasks.md` unless the
project scope is explicitly expanded.
