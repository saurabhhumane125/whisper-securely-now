import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, Users, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import MessageActions from './MessageActions';
import ManageGroupMembersDialog from './ManageGroupMembersDialog';

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  sender?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface GroupChatViewProps {
  groupId: string;
  groupName: string;
  onBack: () => void;
}

export default function GroupChatView({ groupId, groupName, onBack }: GroupChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [createdBy, setCreatedBy] = useState<string>('');
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!groupId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch group messages:', error);
      } else {
        // Fetch sender profiles
        const messagesWithSenders = await Promise.all(
          (data || []).map(async (msg) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', msg.sender_id)
              .maybeSingle();

            return { ...msg, sender: profile || { display_name: 'Unknown', avatar_url: null } };
          })
        );
        setMessages(messagesWithSenders);
      }
      setLoading(false);
    };

    const fetchGroupInfo = async () => {
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      setMemberCount(count || 0);

      const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .maybeSingle();

      if (group) {
        setCreatedBy(group.created_by);
      }
    };

    fetchMessages();
    fetchGroupInfo();

    // Subscribe to new messages
    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const newMsg = payload.new as GroupMessage;
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle();

          setMessages((prev) => [...prev, { ...newMsg, sender: profile || { display_name: 'Unknown', avatar_url: null } }]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === (payload.new as GroupMessage).id
                ? { ...msg, ...(payload.new as GroupMessage) }
                : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== (payload.old as { id: string }).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !user || sending) return;

    const content = newMessage.trim();
    if (content.length > 2000) return;

    setSending(true);
    setNewMessage('');

    const { error } = await supabase.from('group_messages').insert({
      group_id: groupId,
      sender_id: user.id,
      content,
    });

    if (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content);
    }

    setSending(false);
  };

  const handleMembersChanged = async () => {
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    setMemberCount(count || 0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">{groupName}</p>
          <p className="text-xs text-muted-foreground">
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setManageMembersOpen(true)}
          title="Manage members"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <ManageGroupMembersDialog
        open={manageMembersOpen}
        onOpenChange={setManageMembersOpen}
        groupId={groupId}
        groupName={groupName}
        createdBy={createdBy}
        onMembersChanged={handleMembersChanged}
        onLeaveGroup={onBack}
      />

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
              <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[75%] group ${isSent ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                  {!isSent && (
                    <p className="text-xs font-medium text-primary mb-1">{msg.sender?.display_name}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
                    <p className={`text-xs ${isSent ? 'text-foreground/60' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      {msg.edited_at && ' (edited)'}
                    </p>
                    {isSent && (
                      <MessageActions
                        messageId={msg.id}
                        content={msg.content}
                        createdAt={msg.created_at}
                        onUpdate={(newContent) => {
                          setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, content: newContent, edited_at: new Date().toISOString() } : m))
                          );
                        }}
                        onDelete={() => {
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                        }}
                      />
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
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="bg-primary hover:bg-primary/90">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
