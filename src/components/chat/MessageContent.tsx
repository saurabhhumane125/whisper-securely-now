import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { File, Download } from 'lucide-react';

interface MessageContentProps {
  content: string;
  fileUrl?: string | null;
  fileType?: string | null;
}

export default function MessageContent({ content, fileUrl, fileType }: MessageContentProps) {
  const [imageOpen, setImageOpen] = useState(false);

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    // Remove timestamp prefix
    const nameParts = filename.split('.');
    if (nameParts.length > 1) {
      return `file.${nameParts[nameParts.length - 1]}`;
    }
    return filename;
  };

  return (
    <div className="space-y-2">
      {fileUrl && fileType === 'image' && (
        <>
          <img
            src={fileUrl}
            alt="Shared image"
            className="max-w-full max-h-60 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setImageOpen(true)}
          />
          <Dialog open={imageOpen} onOpenChange={setImageOpen}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none">
              <img
                src={fileUrl}
                alt="Shared image"
                className="w-full h-auto rounded-lg object-contain max-h-[85vh]"
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {fileUrl && fileType === 'file' && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
        >
          <File className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm flex-1 truncate">{getFileName(fileUrl)}</span>
          <Download className="w-4 h-4 text-muted-foreground" />
        </a>
      )}

      {content && (
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
      )}
    </div>
  );
}
