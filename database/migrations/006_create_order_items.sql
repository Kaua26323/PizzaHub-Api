CREATE TABLE order_items(
  id UUID PRIMARY KEY, 
  
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,

  product_name VARCHAR(80) NOT NULL,
  unit_price TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  notes VARCHAR(500),


  CONSTRAINT order_items_product_name_not_blank
    CHECK(BTRIM(product_name) <> ''),
  
  CONSTRAINT order_items_unit_price_must_be_valid
    CHECK(
      unit_price ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
      AND unit_price <> '0.00' 
    ),

  CONSTRAINT order_items_quantity_must_be_greater_than_zero
    CHECK(quantity > 0),

  CONSTRAINT order_items_order_id_fk
    FOREIGN KEY (order_id)
    REFERENCES orders(id),
  
  CONSTRAINT order_items_product_id_fk
    FOREIGN KEY (product_id)
    REFERENCES products(id)
);

CREATE INDEX order_items_by_order_id_idx
  ON order_items(order_id);

CREATE INDEX order_items_by_product_id_idx
  ON order_items(product_id);


