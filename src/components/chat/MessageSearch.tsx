import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  id: string;
  content: string;
  conversation_id: string;
  sender_id: string;
  created_at: string;
  other_user_id: string;
  other_user_name: string;
}

interface MessageSearchProps {
  onSelectResult: (conversationId: string, otherUserName: string, otherUserId: string) => void;
  onClose: () => void;
}

export default function MessageSearch({ onSelectResult, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (query.trim().length < 2) return;

    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase.rpc('search_messages', {
      search_query: query.trim(),
    });

    if (error) {
      console.error('Search failed:', error);
      setResults([]);
    } else {
      setResults(data || []);
    }

    setLoading(false);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-medium text-foreground">Search Messages</h2>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in messages..."
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={query.trim().length < 2 || loading}>
            Search
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-pulse text-muted-foreground">Searching...</div>
            </div>
          ) : results.length > 0 ? (
            results.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelectResult(result.conversation_id, result.other_user_name, result.other_user_id)}
                className="w-full p-3 rounded-lg bg-card hover:bg-accent text-left transition-colors border border-border"
              >
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {result.other_user_name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {highlightMatch(result.content, query)}
                </p>
              </button>
            ))
          ) : searched ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No messages found</p>
              <p className="text-sm text-muted-foreground/60">Try a different search term</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Search your messages</p>
              <p className="text-sm text-muted-foreground/60">Enter at least 2 characters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
