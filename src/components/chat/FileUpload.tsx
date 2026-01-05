import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, File, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileUploaded: (fileUrl: string, fileType: string) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFileUploaded, disabled }: FileUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (1 hour expiry)
      const { data: signedData, error: signError } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(fileName, 3600);

      if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to create signed URL');

      const fileType = file.type.startsWith('image/') ? 'image' : 'file';
      
      setPreview({
        url: signedData.signedUrl,
        type: fileType,
        name: file.name,
      });
      
      // Store file path instead of full URL for message storage
      onFileUploaded(fileName, fileType);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearPreview = () => {
    setPreview(null);
    onFileUploaded('', '');
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
        disabled={disabled || uploading}
      />
      
      {preview && (
        <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
          {preview.type === 'image' ? (
            <Image className="w-4 h-4 text-muted-foreground" />
          ) : (
            <File className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {preview.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={clearPreview}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className="shrink-0"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Paperclip className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
