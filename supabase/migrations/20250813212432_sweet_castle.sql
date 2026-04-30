/*
  # Create stripe_invoices table and stripe_user_invoices view

  1. New Tables
    - `stripe_invoices`
      - `id` (bigint, primary key)
      - `customer_id` (text, references stripe customer)
      - `invoice_id` (text, unique, Stripe invoice ID)
      - `hosted_invoice_url` (text, nullable)
      - `invoice_pdf` (text, nullable)
      - `amount_due` (bigint, amount in cents)
      - `amount_paid` (bigint, amount in cents)
      - `amount_remaining` (bigint, amount in cents)
      - `currency` (text)
      - `status` (text, invoice status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `deleted_at` (timestamp, nullable)

  2. Views
    - `stripe_user_invoices` - joins invoices with customer data for authenticated users

  3. Security
    - Enable RLS on `stripe_invoices` table
    - Add policy for users to read their own invoice data
*/

-- Create stripe_invoices table
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id text NOT NULL,
  invoice_id text UNIQUE NOT NULL,
  hosted_invoice_url text,
  invoice_pdf text,
  amount_due bigint NOT NULL DEFAULT 0,
  amount_paid bigint NOT NULL DEFAULT 0,
  amount_remaining bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Enable RLS
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own invoice data
CREATE POLICY "Users can view their own invoice data"
  ON stripe_invoices
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id 
      FROM stripe_customers 
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    ) 
    AND deleted_at IS NULL
  );

-- Create view for user invoices
CREATE OR REPLACE VIEW stripe_user_invoices
WITH (security_invoker = true) AS
SELECT 
  si.customer_id,
  si.id as invoice_id,
  si.invoice_id as stripe_invoice_id,
  si.hosted_invoice_url,
  si.invoice_pdf,
  si.amount_due,
  si.amount_paid,
  si.amount_remaining,
  si.currency,
  si.status,
  si.created_at
FROM stripe_invoices si
INNER JOIN stripe_customers sc ON si.customer_id = sc.customer_id
WHERE sc.user_id = auth.uid() 
  AND si.deleted_at IS NULL 
  AND sc.deleted_at IS NULL;