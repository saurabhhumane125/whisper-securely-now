import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import UserSearch from '@/components/chat/UserSearch';
import ConversationList from '@/components/chat/ConversationList';
import ChatView from '@/components/chat/ChatView';
import { Shield, LogOut, Search, MessageSquare, X, User } from 'lucide-react';

export default function Chat() {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    otherUserName: string;
    otherUserId: string;
  } | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSelectUser = async (userId: string, displayName: string) => {
    try {
      const { data, error } = await supabase.rpc('find_or_create_conversation', {
        other_user_id: userId,
      });

      if (error) {
        console.error('Failed to create conversation:', error);
        toast({
          title: 'Error',
          description: 'Could not start conversation. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setSelectedConversation({
        id: data,
        otherUserName: displayName,
        otherUserId: userId,
      });
      setShowSearch(false);
    } catch (err) {
      console.error('Conversation error:', err);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectConversation = (conversationId: string, otherUserName: string, otherUserId: string) => {
    setSelectedConversation({
      id: conversationId,
      otherUserName,
      otherUserId,
    });
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Signed out',
      description: 'See you next time!',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* App Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-semibold text-foreground">SecureChat</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="text-muted-foreground hover:text-foreground"
          >
            <User className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Conversations */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-border bg-sidebar flex flex-col shrink-0 ${
            selectedConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {showSearch ? (
            <UserSearch onSelectUser={handleSelectUser} />
          ) : (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-medium text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Conversations
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto chat-scrollbar">
                <ConversationList
                  selectedId={selectedConversation?.id || null}
                  onSelect={handleSelectConversation}
                />
              </div>
            </>
          )}
        </div>

        {/* Chat View */}
        <div
          className={`flex-1 ${
            selectedConversation ? 'flex' : 'hidden md:flex'
          } flex-col`}
        >
          {selectedConversation ? (
            <ChatView
              conversationId={selectedConversation.id}
              otherUserName={selectedConversation.otherUserName}
              otherUserId={selectedConversation.otherUserId}
              onBack={handleBack}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-medium text-foreground mb-2">Welcome to SecureChat</h2>
              <p className="text-muted-foreground max-w-sm">
                Select a conversation or search for a user to start messaging securely.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
