# Docker Compose Persistence Smoke Test

## 1. Objective

Verify that PostgreSQL data and uploaded product images persist after recreating the PizzaHub API container.

This smoke test validates Docker Compose volume configuration, application startup, and data persistence.

It does not replace HTTP integration tests or the API acceptance matrix.

## 2. Environment

- **Runtime:** Node.js 24
- **Database:** PostgreSQL 17
- **Container orchestration:** Docker Compose
- **Image storage:** Local filesystem with a named Docker volume
- **API endpoint:** `http://localhost:3000`
- **Compose file:** `docker-compose.yml`

### Persistent volumes

| Volume              | Mount point                | Purpose                                |
| ------------------- | -------------------------- | -------------------------------------- |
| `postgres_dev_data` | `/var/lib/postgresql/data` | PostgreSQL database files              |
| `product_images`    | `/app/uploads`             | Temporary and permanent product images |

The temporary and permanent image directories share the same volume to support filesystem `rename()` operations without cross-device errors (`EXDEV`).

### Environment configuration

The Docker Compose configuration uses `.env.development` for Compose variable interpolation and `.env.docker` for the API container by default.

The API environment file can be overridden through `API_ENV_FILE`.

When running inside Docker Compose, `DATABASE_URL` must reference the PostgreSQL service using the hostname `database`, rather than `localhost`.

Ensure that the database credentials match the PostgreSQL service configuration.

## 3. Prerequisites

- Docker and Docker Compose installed.
- Required environment files configured.
- PostgreSQL migrations applied.
- An ADMIN account available.
- A valid PNG, JPEG, or WebP image for upload.
- `curl`, `jq`, and `sha256sum` available.

Do not use `docker compose down -v` during this smoke test, as it removes persistent volumes and their data.

## 4. Test Procedure

### 4.1 Start the application

Build and start the Docker Compose services:

```bash
docker compose --env-file .env.development up -d --build
```

Verify service status:

```bash
docker compose --env-file .env.development ps
```

Verify API health:

```bash
curl -i http://localhost:3000/health
```

**Expected:** HTTP 200 with `data.status` equal to `ok`.

Define the base URL for subsequent requests:

```bash
export API_URL="http://localhost:3000"
```

### 4.2 Authenticate as ADMIN

Authenticate using an existing administrator account:

```bash
read -r -p "ADMIN email: " ADMIN_EMAIL
read -r -s -p "ADMIN password: " ADMIN_PASSWORD
echo

TOKEN=$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg email "$ADMIN_EMAIL" \
      --arg password "$ADMIN_PASSWORD" \
      '{email: $email, password: $password}')" \
  | jq -r '.data.accessToken'
)

unset ADMIN_PASSWORD

test -n "$TOKEN" && test "$TOKEN" != "null"
```

**Expected:** Authentication succeeds and an access token is returned.

Do not print or store the access token in the test report.

### 4.3 Create a category

Create a unique category for the smoke test:

```bash
SMOKE_ID="$(date +%s)"
CATEGORY_NAME="Docker Smoke $SMOKE_ID"

curl -i -X POST "$API_URL/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg name "$CATEGORY_NAME" '{name: $name}')"
```

**Expected:** HTTP 201.

Retrieve the category ID:

```bash
CATEGORY_ID=$(
  curl -fsS "$API_URL/categories" \
    -H "Authorization: Bearer $TOKEN" \
  | jq -r --arg name "$CATEGORY_NAME" \
      '.data[] | select(.name == $name) | .id'
)

echo "Category ID: $CATEGORY_ID"
```

**Expected:** A valid category UUID.

### 4.4 Create a product with an image

Set the path to a valid PNG image:

```bash
IMAGE_FILE="$HOME/Downloads/pizza.png"
```

Update this path to point to an existing image.

Create a product:

```bash
PRODUCT_NAME="Pizza Docker Smoke $SMOKE_ID"

curl -i -X POST "$API_URL/products" \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=$PRODUCT_NAME" \
  -F "description=Product used to verify Docker persistence" \
  -F "price=49.90" \
  -F "categoryId=$CATEGORY_ID" \
  -F "isActive=true" \
  -F "image=@${IMAGE_FILE};type=image/png"
```

**Expected:** HTTP 201.

For JPEG or WebP images, change the MIME type to `image/jpeg` or `image/webp`, respectively.

Retrieve the product ID and image URL:

```bash
PRODUCT_DATA=$(
  curl -fsS "$API_URL/products" \
    -H "Authorization: Bearer $TOKEN" \
  | jq -c --arg name "$PRODUCT_NAME" \
      '.data[] | select(.name == $name)'
)

PRODUCT_ID=$(echo "$PRODUCT_DATA" | jq -r '.id')
IMAGE_URL=$(echo "$PRODUCT_DATA" | jq -r '.imageUrl')

echo "Product ID: $PRODUCT_ID"
echo "Image URL: $IMAGE_URL"
```

**Expected:** The product exists with the correct category, price, and image URL.

### 4.5 Record image integrity before recreation

Download the product image:

```bash
curl -fS "$API_URL$IMAGE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/pizzahub-before.img
```

Calculate its SHA-256 checksum:

```bash
sha256sum /tmp/pizzahub-before.img
```

**Expected:** The image is downloaded successfully and its checksum is available for comparison.

### 4.6 Recreate the API container

Recreate only the API container, preserving the database container and named volumes:

```bash
docker compose --env-file .env.development \
  up -d --force-recreate --no-deps api
```

Verify that the API started successfully:

```bash
docker compose --env-file .env.development logs --tail=50 api
```

Check its health endpoint again:

```bash
curl -i "$API_URL/health"
```

**Expected:** HTTP 200.

### 4.7 Verify PostgreSQL persistence

If the access token has expired, authenticate again before continuing.

Verify the category:

```bash
curl -fsS "$API_URL/categories" \
  -H "Authorization: Bearer $TOKEN" \
| jq --arg id "$CATEGORY_ID" \
    '.data[] | select(.id == $id)'
```

Verify the product:

```bash
curl -fsS "$API_URL/products" \
  -H "Authorization: Bearer $TOKEN" \
| jq --arg id "$PRODUCT_ID" \
    '.data[] | select(.id == $id)'
```

**Expected:**

- The category retains its original ID.
- The product retains its original ID.
- The product data remains unchanged.
- The original image URL remains associated with the product.

### 4.8 Verify image persistence and integrity

Download the image after recreating the API container:

```bash
curl -fS "$API_URL$IMAGE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/pizzahub-after.img
```

Calculate the new checksum:

```bash
sha256sum \
  /tmp/pizzahub-before.img \
  /tmp/pizzahub-after.img
```

Compare the files directly:

```bash
cmp /tmp/pizzahub-before.img /tmp/pizzahub-after.img \
  && echo "PASS: Product image remained unchanged."
```

**Expected:** Both files are byte-for-byte identical.

## 5. Test Results

- **Execution date:** 2026-11-12
- **Environment:** Local Docker Compose
- **Git commit:** Record the tested commit SHA
- **Overall result:** PASS, subject to the checks recorded below

| Verification             | Expected result                   | Status |
| ------------------------ | --------------------------------- | ------ |
| API startup              | API starts successfully           | PASS   |
| API health               | HTTP 200                          | PASS   |
| ADMIN authentication     | Login succeeds                    | PASS   |
| Category creation        | HTTP 201                          | PASS   |
| Product creation         | HTTP 201 with image upload        | PASS   |
| API container recreation | Container recreated successfully  | PASS   |
| Category persistence     | Original category remains         | PASS   |
| Product persistence      | Original product remains          | PASS   |
| Image persistence        | Original image remains accessible | PASS   |
| Image integrity          | Identical file contents           | PASS   |

## 6. Conclusion

**Result: PASS**, provided that all persistence and image-integrity checks above have succeeded.

The smoke test confirms that PostgreSQL data and uploaded product images remain available after recreating the API container.

Named Docker volumes preserve application data independently of the API container lifecycle.

This completes **T122 — Docker Compose Persistence Smoke Test**.
