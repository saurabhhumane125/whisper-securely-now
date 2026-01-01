import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TypingUser {
  id: string;
  name: string;
}

export function useTypingIndicator(channelName: string) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !channelName) return;

    const channel = supabase.channel(`typing:${channelName}`);
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];

        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((presence) => {
            if (presence.typing && presence.user_id !== user.id) {
              users.push({
                id: presence.user_id,
                name: presence.display_name,
              });
            }
          });
        });

        setTypingUsers(users);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [channelName, user]);

  const startTyping = useCallback(
    async (displayName: string) => {
      if (!channelRef.current || !user) return;

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      await channelRef.current.track({
        user_id: user.id,
        display_name: displayName,
        typing: true,
      });

      // Auto-stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    },
    [user]
  );

  const stopTyping = useCallback(async () => {
    if (!channelRef.current || !user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    await channelRef.current.track({
      user_id: user.id,
      typing: false,
    });
  }, [user]);

  return {
    typingUsers: typingUsers.map((u) => u.name),
    startTyping,
    stopTyping,
  };
}
