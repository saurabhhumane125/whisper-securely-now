-- Add reply_to columns for message replies
ALTER TABLE public.messages 
ADD COLUMN reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.group_messages 
ADD COLUMN reply_to_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL;

-- Create index for faster reply lookups
CREATE INDEX idx_messages_reply_to ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_group_messages_reply_to ON public.group_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Create a search function for messages
CREATE OR REPLACE FUNCTION public.search_messages(search_query text)
RETURNS TABLE(
  id uuid,
  content text,
  conversation_id uuid,
  sender_id uuid,
  created_at timestamptz,
  other_user_id uuid,
  other_user_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) < 2 THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.conversation_id,
    m.sender_id,
    m.created_at,
    CASE 
      WHEN c.participant_1 = auth.uid() THEN c.participant_2 
      ELSE c.participant_1 
    END as other_user_id,
    CASE 
      WHEN c.participant_1 = auth.uid() THEN p2.display_name 
      ELSE p1.display_name 
    END as other_user_name
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.profiles p1 ON p1.id = c.participant_1
  LEFT JOIN public.profiles p2 ON p2.id = c.participant_2
  WHERE (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    AND m.content ILIKE '%' || search_query || '%'
  ORDER BY m.created_at DESC
  LIMIT 50;
END;
$$;