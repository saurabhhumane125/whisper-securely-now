-- Add file columns to messages table
ALTER TABLE public.messages 
ADD COLUMN file_url text,
ADD COLUMN file_type text;

-- Add file columns to group_messages table
ALTER TABLE public.group_messages 
ADD COLUMN file_url text,
ADD COLUMN file_type text;

-- Create message reactions table
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Create group message reactions table
CREATE TABLE public.group_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on reactions tables
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS for message_reactions: users in conversation can view/add reactions
CREATE POLICY "Conversation participants can view reactions"
ON public.message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

CREATE POLICY "Conversation participants can add reactions"
ON public.message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

CREATE POLICY "Users can remove own reactions"
ON public.message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- RLS for group_message_reactions: group members can view/add reactions
CREATE POLICY "Group members can view reactions"
ON public.group_message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members gmem ON gmem.group_id = gm.group_id
    WHERE gm.id = group_message_reactions.message_id
    AND gmem.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can add reactions"
ON public.group_message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members gmem ON gmem.group_id = gm.group_id
    WHERE gm.id = group_message_reactions.message_id
    AND gmem.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove own reactions"
ON public.group_message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', true, 10485760);

-- Storage policies for chat files
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view chat files"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-files');

CREATE POLICY "Users can delete own chat files"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reactions;