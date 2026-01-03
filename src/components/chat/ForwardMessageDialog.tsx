import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Users, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  fileUrl?: string | null;
  fileType?: string | null;
}

interface Conversation {
  id: string;
  type: 'direct';
  name: string;
  avatarUrl?: string | null;
}

interface Group {
  id: string;
  type: 'group';
  name: string;
  avatarUrl?: string | null;
}

type Destination = Conversation | Group;

export default function ForwardMessageDialog({
  open,
  onOpenChange,
  messageContent,
  fileUrl,
  fileType,
}: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;

    const fetchDestinations = async () => {
      setLoading(true);
      const results: Destination[] = [];

      // Fetch conversations
      const { data: convData } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (convData) {
        for (const conv of convData) {
          const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', otherUserId)
            .maybeSingle();

          results.push({
            id: conv.id,
            type: 'direct',
            name: profile?.display_name || 'Unknown',
            avatarUrl: profile?.avatar_url,
          });
        }
      }

      // Fetch groups
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberData && memberData.length > 0) {
        const groupIds = memberData.map((m) => m.group_id);
        const { data: groupsData } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        if (groupsData) {
          for (const group of groupsData) {
            results.push({
              id: group.id,
              type: 'group',
              name: group.name,
              avatarUrl: group.avatar_url,
            });
          }
        }
      }

      setDestinations(results);
      setLoading(false);
    };

    fetchDestinations();
  }, [open, user]);

  const handleForward = async (destination: Destination) => {
    if (!user) return;

    setSending(destination.id);

    try {
      if (destination.type === 'direct') {
        const { error } = await supabase.from('messages').insert({
          conversation_id: destination.id,
          sender_id: user.id,
          content: messageContent,
          file_url: fileUrl || null,
          file_type: fileType || null,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.from('group_messages').insert({
          group_id: destination.id,
          sender_id: user.id,
          content: messageContent,
          file_url: fileUrl || null,
          file_type: fileType || null,
        });

        if (error) throw error;
      }

      toast({
        title: 'Message forwarded',
        description: `Message sent to ${destination.name}`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to forward message:', error);
      toast({
        title: 'Error',
        description: 'Could not forward message',
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : destinations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No destinations available</p>
          ) : (
            <div className="space-y-1">
              {destinations.map((dest) => (
                <button
                  key={`${dest.type}-${dest.id}`}
                  onClick={() => handleForward(dest)}
                  disabled={sending !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {dest.avatarUrl ? (
                      <img src={dest.avatarUrl} alt={dest.name} className="w-full h-full object-cover" />
                    ) : dest.type === 'group' ? (
                      <Users className="w-5 h-5 text-primary" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{dest.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{dest.type === 'direct' ? 'Direct message' : 'Group'}</p>
                  </div>
                  {sending === dest.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <Send className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
