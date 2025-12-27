-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create a new policy that allows users to view profiles of people they're in conversation with
CREATE POLICY "Users can view profiles in conversations"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.participant_1 = auth.uid() AND c.participant_2 = profiles.id)
       OR (c.participant_2 = auth.uid() AND c.participant_1 = profiles.id)
  )
);