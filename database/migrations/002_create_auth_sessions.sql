CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,

  user_id UUID NOT NULL,
  token_family_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  
  ip_address TEXT,
  user_agent TEXT,

  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT auth_sessions_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id),
    
  CONSTRAINT auth_sessions_refresh_token_hash_not_blank
    CHECK (BTRIM(refresh_token_hash) <> '')
);

CREATE UNIQUE INDEX auth_sessions_one_active_per_family_idx
  ON auth_sessions(token_family_id)
  WHERE revoked_at IS NULL;

CREATE INDEX auth_sessions_token_family_idx
  ON auth_sessions(token_family_id);

CREATE INDEX auth_sessions_user_id_idx
  ON auth_sessions(user_id);

CREATE INDEX auth_sessions_expires_at_idx
  ON auth_sessions(expires_at);
