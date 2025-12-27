import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, User, Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  display_name: string;
  email: string;
}

interface UserSearchProps {
  onSelectUser: (userId: string, displayName: string) => void;
}

export default function UserSearch({ onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // PRIVACY: Only search when query has at least 2 characters
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      setHasSearched(true);

      try {
        const { data, error } = await supabase.rpc('search_users', {
          search_query: query.trim(),
        });

        if (error) {
          console.error('Search error:', error);
          setResults([]);
        } else {
          setResults(data || []);
        }
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  return (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-10 bg-card border-border focus:ring-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Search Results */}
      {hasSearched && !loading && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No users found
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id, user.display_name)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-secondary transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{user.display_name}</p>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Privacy Notice */}
      {!hasSearched && (
        <p className="text-xs text-muted-foreground/60 text-center">
          Type at least 2 characters to search for users
        </p>
      )}
    </div>
  );
}
