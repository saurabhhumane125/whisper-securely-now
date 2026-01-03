import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { File, Download, Play, Pause, Volume2 } from 'lucide-react';

interface MessageContentProps {
  content: string;
  fileUrl?: string | null;
  fileType?: string | null;
}

export default function MessageContent({ content, fileUrl, fileType }: MessageContentProps) {
  const [imageOpen, setImageOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const nameParts = filename.split('.');
    if (nameParts.length > 1) {
      return `file.${nameParts[nameParts.length - 1]}`;
    }
    return filename;
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
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

      {fileUrl && fileType === 'audio' && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-48">
          <audio
            ref={audioRef}
            src={fileUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={togglePlayback}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <div className="flex-1 flex items-center gap-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
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
