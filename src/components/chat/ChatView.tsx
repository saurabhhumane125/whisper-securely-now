import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, User, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface ChatViewProps {
  conversationId: string;
  otherUserName: string;
  otherUserId: string;
  onBack: () => void;
}

export default function ChatView({ conversationId, otherUserName, otherUserId, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Track presence
  useEffect(() => {
    if (!user || !conversationId) return;

    const presenceChannel = supabase.channel(`presence-${conversationId}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineUsers = Object.values(state).flat();
        setIsOnline(onlineUsers.some((u) => (u as { user_id?: string }).user_id === otherUserId));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (newPresences.some((p) => (p as { user_id?: string }).user_id === otherUserId)) {
          setIsOnline(true);
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (leftPresences.some((p) => (p as { user_id?: string }).user_id === otherUserId)) {
          setIsOnline(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user, conversationId, otherUserId]);

  // Mark messages as read when conversation is opened or new messages arrive
  useEffect(() => {
    if (!conversationId || !user) return;

    const markAsRead = async () => {
      await supabase.rpc('mark_messages_read', { p_conversation_id: conversationId });
    };

    markAsRead();
  }, [conversationId, user, messages]);

  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch messages:', error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages and updates
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === (payload.new as Message).id ? (payload.new as Message) : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || sending) return;

    const content = newMessage.trim();
    if (content.length > 2000) {
      return;
    }

    setSending(true);
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });

    if (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content); // Restore message on error
    }

    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center relative">
          <User className="w-5 h-5 text-primary" />
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
              isOnline ? 'bg-green-500' : 'bg-muted-foreground/50'
            }`}
          />
        </div>
        <div>
          <p className="font-medium text-foreground">{otherUserName}</p>
          <p className="text-xs text-muted-foreground">
            {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scrollbar">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground/60">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSent = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isSent ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div className={`max-w-[75%] ${isSent ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
                    <p className={`text-xs ${isSent ? 'text-foreground/60' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </p>
                    {isSent && (
                      msg.read_at ? (
                        <CheckCheck className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-foreground/60" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-input border-border focus:ring-primary"
            maxLength={2000}
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim() || sending}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}