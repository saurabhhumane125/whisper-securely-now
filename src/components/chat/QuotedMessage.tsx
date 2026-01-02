import { Reply } from 'lucide-react';

interface QuotedMessageProps {
  senderName: string;
  content: string;
  onClick?: () => void;
}

export default function QuotedMessage({ senderName, content, onClick }: QuotedMessageProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2 w-full p-2 mb-2 rounded bg-muted/50 border-l-2 border-primary text-left hover:bg-muted transition-colors"
    >
      <Reply className="w-3 h-3 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-primary truncate">{senderName}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {content || '[Attachment]'}
        </p>
      </div>
    </button>
  );
}
