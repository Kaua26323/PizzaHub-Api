CREATE TABLE orders(
  id UUID PRIMARY KEY,
  
  table_number INTEGER NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by_user_id UUID NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,


  CONSTRAINT orders_table_number_must_be_valid
    CHECK(table_number > 0),

  CONSTRAINT orders_status_must_be_valid
    CHECK(status IN ('DRAFT', 'IN_PREPARATION', 'COMPLETED', 'CANCELLED')),

  CONSTRAINT orders_created_by_user_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
);

CREATE INDEX orders_by_created_user_id_idx
  ON orders(created_by_user_id);

CREATE INDEX orders_by_status_idx
  ON orders(status);



