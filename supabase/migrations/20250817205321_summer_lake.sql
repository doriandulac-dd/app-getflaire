/*
  # Add selected departments to stripe subscriptions

  1. Schema Changes
    - Add `selected_departments` column to `stripe_subscriptions` table
    - Column type: text[] (array of text)
    - Allows storing the list of departments selected by users

  2. Purpose
    - Enable pre-selection of user's current subscription details
    - Store department selections for subscription management
    - Support subscription upgrade/downgrade flows
*/

-- Add selected_departments column to stripe_subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_subscriptions' AND column_name = 'selected_departments'
  ) THEN
    ALTER TABLE stripe_subscriptions ADD COLUMN selected_departments text[];
  END IF;
END $$;