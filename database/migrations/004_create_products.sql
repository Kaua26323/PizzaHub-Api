CREATE TABLE products (
  id UUID PRIMARY KEY,
  
  name VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  price TEXT NOT NULL,
  
  image_key TEXT NOT NULL UNIQUE,
  image_mime_type TEXT NOT NULL,
  image_size INTEGER NOT NULL,
  
  is_active BOOLEAN NOT NULL,
  category_id UUID NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT products_name_not_blank
    CHECK (BTRIM(name) <> ''),

  CONSTRAINT products_description_not_blank
    CHECK (BTRIM(description) <> ''),

  CONSTRAINT products_price_must_be_valid
    CHECK (
      price ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      AND price <> '0.00'
    ),
  
  CONSTRAINT products_image_key_not_blank
    CHECK (BTRIM(image_key) <> ''),

  CONSTRAINT products_image_mime_type_must_be_valid
    CHECK (image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),

  CONSTRAINT products_image_size_must_be_greater_than_zero
    CHECK (image_size > 0),

  CONSTRAINT products_category_id_fk
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
);

CREATE INDEX products_by_category_idx
  ON products(category_id);


