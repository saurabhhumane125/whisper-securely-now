import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
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
import { Users, UserMinus, UserPlus, Loader2, LogOut, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

interface GroupMember {
  id: string;
  user_id: string;
  profile: Profile;
}

interface ManageGroupMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  createdBy: string;
  onMembersChanged: () => void;
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
}

export default function ManageGroupMembersDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  createdBy,
  onMembersChanged,
  onLeaveGroup,
  onDeleteGroup,
}: ManageGroupMembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCreator = user?.id === createdBy;

  useEffect(() => {
    if (!open || !groupId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch current members
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('id, user_id')
        .eq('group_id', groupId);

      if (memberError) {
        console.error('Failed to fetch members:', memberError);
        setLoading(false);
        return;
      }

      // Fetch member profiles
      const memberUserIds = memberData?.map((m) => m.user_id) || [];
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, email, avatar_url')
          .in('id', memberUserIds);

        const membersWithProfiles = memberData?.map((m) => ({
          ...m,
          profile: profiles?.find((p) => p.id === m.user_id) || {
            id: m.user_id,
            display_name: 'Unknown',
            email: '',
            avatar_url: null,
          },
        })) || [];

        setMembers(membersWithProfiles);
      }

      // If creator, fetch available users to add
      if (user?.id === createdBy) {
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

          // Remove already members
          memberUserIds.forEach((id) => userIds.delete(id));

          if (userIds.size > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name, email, avatar_url')
              .in('id', Array.from(userIds));

            setAvailableUsers(profiles || []);
          } else {
            setAvailableUsers([]);
          }
        }
      }

      setLoading(false);
      setSelectedToAdd([]);
    };

    fetchData();
  }, [open, groupId, user?.id, createdBy]);

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!isCreator || userId === createdBy) return;

    setRemoving(userId);

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      console.error('Failed to remove member:', error);
      toast({
        title: 'Error',
        description: 'Could not remove member.',
        variant: 'destructive',
      });
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      // Add back to available users
      const removedMember = members.find((m) => m.id === memberId);
      if (removedMember) {
        setAvailableUsers((prev) => [...prev, removedMember.profile]);
      }
      toast({
        title: 'Member removed',
        description: 'Member has been removed from the group.',
      });
      onMembersChanged();
    }

    setRemoving(null);
  };

  const handleAddMembers = async () => {
    if (!isCreator || selectedToAdd.length === 0) return;

    setAdding(true);

    const newMembers = selectedToAdd.map((userId) => ({
      group_id: groupId,
      user_id: userId,
    }));

    const { error } = await supabase.from('group_members').insert(newMembers);

    if (error) {
      console.error('Failed to add members:', error);
      toast({
        title: 'Error',
        description: 'Could not add members.',
        variant: 'destructive',
      });
    } else {
      // Add to members list
      const addedProfiles = availableUsers.filter((u) => selectedToAdd.includes(u.id));
      const newMemberEntries = addedProfiles.map((p) => ({
        id: crypto.randomUUID(),
        user_id: p.id,
        profile: p,
      }));
      setMembers((prev) => [...prev, ...newMemberEntries]);
      setAvailableUsers((prev) => prev.filter((u) => !selectedToAdd.includes(u.id)));
      setSelectedToAdd([]);
      toast({
        title: 'Members added',
        description: `${addedProfiles.length} member(s) added to the group.`,
      });
      onMembersChanged();
    }

    setAdding(false);
  };

  const handleLeaveGroup = async () => {
    if (!user || isCreator) return;

    setLeaving(true);

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to leave group:', error);
      toast({
        title: 'Error',
        description: 'Could not leave the group.',
        variant: 'destructive',
      });
      setLeaving(false);
    } else {
      toast({
        title: 'Left group',
        description: `You have left "${groupName}".`,
      });
      onOpenChange(false);
      onLeaveGroup?.();
    }
  };

  const handleDeleteGroup = async () => {
    if (!user || !isCreator) return;
    setDeleting(true);
    await supabase.from('group_messages').delete().eq('group_id', groupId);
    await supabase.from('group_members').delete().eq('group_id', groupId);
    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    if (error) {
      toast({ title: 'Error', description: 'Could not delete the group.', variant: 'destructive' });
      setDeleting(false);
    } else {
      toast({ title: 'Group deleted', description: `"${groupName}" has been deleted.` });
      onOpenChange(false);
      onDeleteGroup?.();
    }
  };

  const toggleSelectToAdd = (userId: string) => {
    setSelectedToAdd((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {groupName} - Members
          </DialogTitle>
          <DialogDescription>
            {isCreator ? 'Manage group members' : 'View group members'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Current Members */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Current Members ({members.length})</h4>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {member.profile.display_name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.profile.display_name}
                          {member.user_id === createdBy && (
                            <span className="ml-2 text-xs text-primary">(Creator)</span>
                          )}
                          {member.user_id === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.profile.email}
                        </p>
                      </div>
                      {isCreator && member.user_id !== createdBy && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveMember(member.id, member.user_id)}
                          disabled={removing === member.user_id}
                        >
                          {removing === member.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Add Members (Creator only) */}
            {isCreator && availableUsers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add Members
                </h4>
                <ScrollArea className="h-[150px] border rounded-md p-2">
                  <div className="space-y-2">
                    {availableUsers.map((profile) => (
                      <label
                        key={profile.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedToAdd.includes(profile.id)}
                          onCheckedChange={() => toggleSelectToAdd(profile.id)}
                        />
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>
                            {profile.display_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{profile.display_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                {selectedToAdd.length > 0 && (
                  <Button
                    onClick={handleAddMembers}
                    disabled={adding}
                    className="w-full"
                    size="sm"
                  >
                    {adding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add {selectedToAdd.length} Member{selectedToAdd.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {isCreator && availableUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No more contacts available to add.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isCreator && !showDeleteConfirm && (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="w-full sm:w-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Group
            </Button>
          )}
          {isCreator && showDeleteConfirm && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteGroup} disabled={deleting} className="flex-1">
                {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : 'Confirm Delete'}
              </Button>
            </div>
          )}
          {!isCreator && (
            <Button variant="destructive" onClick={handleLeaveGroup} disabled={leaving} className="w-full sm:w-auto">
              {leaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Leaving...</> : <><LogOut className="w-4 h-4 mr-2" />Leave Group</>}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
