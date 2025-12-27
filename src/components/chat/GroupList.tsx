import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  updated_at: string;
  member_count?: number;
}

interface GroupListProps {
  selectedId: string | null;
  onSelect: (groupId: string, groupName: string) => void;
}

export default function GroupList({ selectedId, onSelect }: GroupListProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = async () => {
    if (!user) return;

    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (!memberData || memberData.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberData.map((m) => m.group_id);

    const { data: groupsData, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch groups:', error);
      setGroups([]);
    } else {
      // Get member counts
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          return { ...group, member_count: count || 0 };
        })
      );
      setGroups(groupsWithCounts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();

    // Subscribe to group updates
    const channel = supabase
      .channel('groups-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
        },
        () => {
          fetchGroups();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages',
        },
        () => {
          fetchGroups();
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
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <Users className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="text-muted-foreground">No groups yet</p>
          <p className="text-sm text-muted-foreground/60">Create a group to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => onSelect(group.id, group.name)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
            selectedId === group.id ? 'bg-primary/10' : 'hover:bg-secondary'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {group.avatar_url ? (
              <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              <Users className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground truncate">{group.name}</p>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(group.updated_at), { addSuffix: false })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {group.member_count} member{group.member_count !== 1 ? 's' : ''}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
