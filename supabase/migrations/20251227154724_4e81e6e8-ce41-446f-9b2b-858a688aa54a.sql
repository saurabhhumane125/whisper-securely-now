-- Add RLS policies for editing and deleting messages
-- Users can only edit their own messages within 10 minutes of creation
CREATE POLICY "Users can update own messages within 10 minutes"
ON public.messages
FOR UPDATE
USING (
  auth.uid() = sender_id 
  AND created_at > (now() - interval '10 minutes')
)
WITH CHECK (
  auth.uid() = sender_id 
  AND created_at > (now() - interval '10 minutes')
);

-- Users can delete their own messages anytime
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Add edited_at column to track when message was edited
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

-- Create groups table for group chats
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group_messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  edited_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all new tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Groups policies: members can view groups they belong to
CREATE POLICY "Members can view their groups"
ON public.groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
  )
);

-- Only authenticated users can create groups
CREATE POLICY "Users can create groups"
ON public.groups
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Group creator can update group
CREATE POLICY "Creator can update group"
ON public.groups
FOR UPDATE
USING (auth.uid() = created_by);

-- Group creator can delete group
CREATE POLICY "Creator can delete group"
ON public.groups
FOR DELETE
USING (auth.uid() = created_by);

-- Group members policies
CREATE POLICY "Members can view group members"
ON public.group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
  )
);

-- Group creator can add members
CREATE POLICY "Creator can add members"
ON public.group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
  )
  OR user_id = auth.uid() -- Allow self-insertion for creator
);

-- Group creator can remove members
CREATE POLICY "Creator can remove members"
ON public.group_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
  )
  OR user_id = auth.uid() -- Members can leave
);

-- Group messages policies
CREATE POLICY "Members can view group messages"
ON public.group_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send group messages"
ON public.group_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can edit own group messages within 10 minutes"
ON public.group_messages
FOR UPDATE
USING (
  auth.uid() = sender_id
  AND created_at > (now() - interval '10 minutes')
)
WITH CHECK (
  auth.uid() = sender_id
  AND created_at > (now() - interval '10 minutes')
);

CREATE POLICY "Users can delete own group messages"
ON public.group_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Update conversation timestamp trigger for group messages
CREATE OR REPLACE FUNCTION public.update_group_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.groups
  SET updated_at = now()
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_group_updated_at
  AFTER INSERT ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_timestamp();