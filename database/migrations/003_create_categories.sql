CREATE TABLE categories (
  id UUID PRIMARY KEY,

  name TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT categories_name_not_blank
    CHECK (BTRIM(name) <> '')
);
