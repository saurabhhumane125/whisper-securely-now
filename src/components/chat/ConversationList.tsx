import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { User, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  updated_at: string;
  other_user?: {
    id: string;
    display_name: string;
    email: string;
    avatar_url?: string | null;
  };
}

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conversationId: string, otherUserName: string, otherUserId: string, otherUserAvatar?: string | null) => void;
}

export default function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch conversations:', error);
        setConversations([]);
      } else {
        // Fetch other user profiles
        const convWithProfiles = await Promise.all(
          (data || []).map(async (conv) => {
            const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, email, avatar_url')
              .eq('id', otherUserId)
              .maybeSingle();
            
            return {
              ...conv,
              other_user: profile || { id: otherUserId, display_name: 'Unknown', email: '' },
            };
          })
        );
        setConversations(convWithProfiles);
      }
      setLoading(false);
    };

    fetchConversations();

    // Subscribe to conversation updates
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-3 bg-muted rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <MessageSquare className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="text-muted-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground/60">Search for a user to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id, conv.other_user?.display_name || 'Unknown', conv.other_user?.id || '', conv.other_user?.avatar_url)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
            selectedId === conv.id
              ? 'bg-primary/10'
              : 'hover:bg-secondary'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {conv.other_user?.avatar_url ? (
              <img src={conv.other_user.avatar_url} alt={conv.other_user.display_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground truncate">
                {conv.other_user?.display_name || 'Unknown'}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: false })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {conv.other_user?.email}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
