import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MessageActionsProps {
  messageId: string;
  content: string;
  createdAt: string;
  onUpdate: (newContent: string) => void;
  onDelete: () => void;
}

export default function MessageActions({ messageId, content, createdAt, onUpdate, onDelete }: MessageActionsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const canEdit = () => {
    const createdTime = new Date(createdAt).getTime();
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    return now - createdTime < tenMinutes;
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === content) {
      setIsEditing(false);
      setEditContent(content);
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('messages')
      .update({ content: editContent.trim(), edited_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to edit message:', error);
      toast({
        title: 'Error',
        description: 'Could not edit message. The 10-minute window may have passed.',
        variant: 'destructive',
      });
      setEditContent(content);
    } else {
      onUpdate(editContent.trim());
    }
    setIsEditing(false);
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Failed to delete message:', error);
      toast({
        title: 'Error',
        description: 'Could not delete message.',
        variant: 'destructive',
      });
    } else {
      onDelete();
    }
    setShowDeleteDialog(false);
    setLoading(false);
  };

  if (isEditing) {
    return (
      <div className="flex gap-2 mt-2">
        <Input
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="flex-1 text-sm"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleEdit();
            }
            if (e.key === 'Escape') {
              setIsEditing(false);
              setEditContent(content);
            }
          }}
          autoFocus
        />
        <Button size="sm" onClick={handleEdit} disabled={loading}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsEditing(false);
            setEditContent(content);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit() && (
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This message will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
