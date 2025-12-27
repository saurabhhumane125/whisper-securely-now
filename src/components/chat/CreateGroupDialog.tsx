import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: () => void;
}

export default function CreateGroupDialog({ open, onOpenChange, onGroupCreated }: CreateGroupDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const fetchUsers = async () => {
      setLoading(true);
      // Get users from existing conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select('participant_1, participant_2')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (conversations) {
        const userIds = new Set<string>();
        conversations.forEach((c) => {
          if (c.participant_1 !== user.id) userIds.add(c.participant_1);
          if (c.participant_2 !== user.id) userIds.add(c.participant_2);
        });

        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, email, avatar_url')
            .in('id', Array.from(userIds));

          setAvailableUsers(profiles || []);
        }
      }
      setLoading(false);
    };

    fetchUsers();
    setGroupName('');
    setSelectedUsers([]);
  }, [open, user]);

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0 || !user) {
      toast({
        title: 'Error',
        description: 'Please enter a group name and select at least one member.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: groupName.trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (groupError || !group) {
      console.error('Failed to create group:', groupError);
      toast({
        title: 'Error',
        description: 'Could not create group. Please try again.',
        variant: 'destructive',
      });
      setCreating(false);
      return;
    }

    // Add creator as member
    const members = [user.id, ...selectedUsers].map((userId) => ({
      group_id: group.id,
      user_id: userId,
    }));

    const { error: membersError } = await supabase.from('group_members').insert(members);

    if (membersError) {
      console.error('Failed to add members:', membersError);
      // Try to clean up the group
      await supabase.from('groups').delete().eq('id', group.id);
      toast({
        title: 'Error',
        description: 'Could not add members to group. Please try again.',
        variant: 'destructive',
      });
      setCreating(false);
      return;
    }

    toast({
      title: 'Success',
      description: `Group "${groupName}" created successfully!`,
    });

    onOpenChange(false);
    onGroupCreated();
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Create Group
          </DialogTitle>
          <DialogDescription>
            Create a new group chat with your contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Members</Label>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading contacts...</div>
            ) : availableUsers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No contacts available. Start some conversations first!
              </div>
            ) : (
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-2">
                  {availableUsers.map((profile) => (
                    <label
                      key={profile.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUsers.includes(profile.id)}
                        onCheckedChange={() => toggleUser(profile.id)}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>{profile.display_name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{profile.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedUsers.length} member{selectedUsers.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
          >
            {creating ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
