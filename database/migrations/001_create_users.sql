CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_name_not_blank
    CHECK (BTRIM(name) <> ''),

  CONSTRAINT users_email_not_blank
    CHECK (BTRIM(email) <> ''),

  CONSTRAINT users_password_hash_not_blank
    CHECK (BTRIM(password_hash) <> ''),

  CONSTRAINT users_role_valid
    CHECK (role IN ('ADMIN', 'STAFF'))
);
