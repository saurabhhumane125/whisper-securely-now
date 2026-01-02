import { X, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReplyPreviewProps {
  replyTo: {
    id: string;
    content: string;
    senderName: string;
  };
  onClear: () => void;
}

export default function ReplyPreview({ replyTo, onClear }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border">
      <Reply className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary truncate">
          Replying to {replyTo.senderName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {replyTo.content || '[Attachment]'}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onClear}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
