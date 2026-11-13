# Bootstrap Admin Smoke Test

## 1. Objective

Verify that the administrator bootstrap process securely creates the initial ADMIN account and handles subsequent execution safely.

## 2. Prerequisites

- PostgreSQL is running and accessible.
- Database migrations have been applied.
- A disposable database with no existing ADMIN is available.
- Required environment variables are configured in `.env.development`, which the command loads.

## 3. Test Procedure

### 3.1 Initial administrator creation

Run:

```bash
npm run bootstrap:admin
```

Provide a valid administrator name, email, and password.

**Expected:**

- The bootstrap completes successfully.
- Exactly one ADMIN account is created.
- The process exits successfully.
- The password is not echoed to the terminal.

Verify the administrator role and account count in the database.

### 3.2 Duplicate bootstrap attempt

Run the bootstrap command again using a different email address.

**Expected:**

- The operation is rejected safely.
- No additional ADMIN account is created.
- The process returns a non-zero exit status.
- No sensitive information is exposed.

### 3.3 Sensitive information verification

Inspect the terminal output from both executions.

**Expected:**

- No plaintext password.
- No password hash.
- No JWT secret or access token.
- No database credentials.

## 4. Test Results

| Verification           | Expected result                 | Status |
| ---------------------- | ------------------------------- | ------ |
| Initial ADMIN creation | Exactly one ADMIN created       | PASS   |
| Administrator role     | Role is ADMIN                   | PASS   |
| Duplicate execution    | Safely rejected                 | PASS   |
| Database consistency   | No additional ADMIN created     | PASS   |
| Exit status            | Success: 0; rejection: non-zero | PASS   |
| Sensitive information  | No secrets exposed              | PASS   |

## 5. Conclusion

**Result: PASS**

The smoke test confirmed that:

- The initial ADMIN account is created successfully.
- Subsequent bootstrap attempts are rejected.
- No additional ADMIN accounts are created.
- The process returns the expected exit codes.
- No sensitive information is exposed in terminal output.

This completes **T123 — Bootstrap Admin Smoke Test**.
