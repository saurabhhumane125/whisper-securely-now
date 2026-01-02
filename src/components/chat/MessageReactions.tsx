import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  tableName: 'message_reactions' | 'group_message_reactions';
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

export default function MessageReactions({ messageId, tableName }: MessageReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  const fetchReactions = async () => {
    const { data, error } = await supabase
      .from(tableName)
      .select('emoji, user_id')
      .eq('message_id', messageId);

    if (error) {
      console.error('Failed to fetch reactions:', error);
      return;
    }

    // Group reactions by emoji
    const grouped = (data || []).reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
      }
      acc[r.emoji].count++;
      acc[r.emoji].users.push(r.user_id);
      if (r.user_id === user?.id) {
        acc[r.emoji].hasReacted = true;
      }
      return acc;
    }, {} as Record<string, Reaction>);

    setReactions(Object.values(grouped));
  };

  useEffect(() => {
    fetchReactions();

    // Subscribe to reaction changes
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, tableName, user?.id]);

  const toggleReaction = async (emoji: string) => {
    if (!user) return;

    const existingReaction = reactions.find((r) => r.emoji === emoji && r.hasReacted);

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from(tableName)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      // Add reaction
      await supabase.from(tableName).insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }

    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.button
            key={reaction.emoji}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => toggleReaction(reaction.emoji)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
              reaction.hasReacted
                ? 'bg-primary/20 border border-primary/30'
                : 'bg-muted hover:bg-muted/80 border border-transparent'
            }`}
          >
            <span>{reaction.emoji}</span>
            <span className="text-muted-foreground">{reaction.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="p-1.5 hover:bg-muted rounded transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
