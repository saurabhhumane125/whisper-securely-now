-- Add read_at column to messages table
ALTER TABLE public.messages 
ADD COLUMN read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only mark messages from the OTHER user as read
  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id != auth.uid()
    AND read_at IS NULL;
END;
$$;