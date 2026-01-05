import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSignedUrlOptions {
  bucket: 'chat-files' | 'avatars';
  path: string | null | undefined;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export function useSignedUrl({ bucket, path, expiresIn = 3600 }: UseSignedUrlOptions) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    // If it's already a full URL (legacy data), use it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      setSignedUrl(path);
      return;
    }

    const getSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);

        if (signError) throw signError;
        setSignedUrl(data?.signedUrl || null);
      } catch (err) {
        console.error('Failed to get signed URL:', err);
        setError(err as Error);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    getSignedUrl();
  }, [bucket, path, expiresIn]);

  return { signedUrl, loading, error };
}

// Helper function for one-time signed URL generation
export async function getSignedUrl(
  bucket: 'chat-files' | 'avatars',
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null;
  
  // If it's already a full URL (legacy data), use it directly
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data?.signedUrl || null;
  } catch (err) {
    console.error('Failed to get signed URL:', err);
    return null;
  }
}
