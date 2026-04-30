/*
  # Change requests

  Stores user requests that require admin/manual validation, such as changing
  authorized departments.
*/

CREATE TABLE IF NOT EXISTS public.change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  current_list text[] DEFAULT ARRAY[]::text[],
  requested_list text[] NOT NULL DEFAULT ARRAY[]::text[],
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own change requests"
  ON public.change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own change requests"
  ON public.change_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read agency change requests"
  ON public.change_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users requester
      JOIN public.users admin_user ON admin_user.agency_id = requester.agency_id
      WHERE requester.id = change_requests.user_id
        AND admin_user.id = auth.uid()
        AND admin_user."Role" = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_change_requests_user_id ON public.change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.change_requests(status);
