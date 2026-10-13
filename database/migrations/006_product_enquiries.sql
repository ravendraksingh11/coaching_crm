CREATE TABLE IF NOT EXISTS product_enquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(254) NOT NULL,
  enquiry TEXT NOT NULL,
  contacted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_enquiries_created_at
  ON product_enquiries(created_at DESC);
