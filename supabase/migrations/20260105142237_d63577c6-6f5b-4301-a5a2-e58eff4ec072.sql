-- Drop existing policies that conflict
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;

-- Create comprehensive RLS policies for storage.objects

-- Chat files: Users can view files in their conversations or group chats
CREATE POLICY "Authenticated users can view chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  (
    -- User's own uploads
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Voice recordings in voice folder (format: voice/timestamp.ext)
    (storage.foldername(name))[1] = 'voice'
  )
);

-- Chat files: Users can upload their own files
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid() IS NOT NULL
);

-- Avatars: Anyone authenticated can view avatars (profile pics should be visible)
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Avatars: Users can upload their own avatars
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Avatars: Users can update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix search_users function - sanitize wildcards and add auth check
CREATE OR REPLACE FUNCTION public.search_users(search_query TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_query TEXT;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Require minimum 2 characters
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) < 2 THEN
    RETURN;
  END IF;
  
  -- Escape SQL wildcards to prevent injection
  safe_query := REPLACE(REPLACE(TRIM(search_query), '%', '\%'), '_', '\_');
  
  RETURN QUERY
  SELECT p.id, p.display_name, p.email
  FROM public.profiles p
  WHERE p.id != auth.uid()
    AND (
      p.display_name ILIKE '%' || safe_query || '%' ESCAPE '\'
      OR p.email ILIKE '%' || safe_query || '%' ESCAPE '\'
    )
  LIMIT 5;
END;
$$;

-- Fix search_messages function - sanitize wildcards
CREATE OR REPLACE FUNCTION public.search_messages(search_query TEXT)
RETURNS TABLE (
  id UUID,
  content TEXT,
  conversation_id UUID,
  sender_id UUID,
  created_at TIMESTAMPTZ,
  other_user_id UUID,
  other_user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_query TEXT;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Require minimum 2 characters
  IF search_query IS NULL OR LENGTH(TRIM(search_query)) < 2 THEN
    RETURN;
  END IF;
  
  -- Escape SQL wildcards to prevent injection
  safe_query := REPLACE(REPLACE(TRIM(search_query), '%', '\%'), '_', '\_');
  
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
    p.display_name as other_user_name
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  JOIN public.profiles p ON p.id = CASE 
    WHEN c.participant_1 = auth.uid() THEN c.participant_2
    ELSE c.participant_1
  END
  WHERE (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    AND m.content ILIKE '%' || safe_query || '%' ESCAPE '\'
  ORDER BY m.created_at DESC
  LIMIT 50;
END;
$$;