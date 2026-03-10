import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import OnboardingFlow from '@/components/OnboardingFlow';
import AnalysisResults from '@/components/AnalysisResults';
import HistorySidebar from '@/components/HistorySidebar';
import { Button } from '@/components/ui/button';
import { History, Plus, Zap, Linkedin, LogOut, Loader2 } from 'lucide-react';
import anshitaAvatar from '@/assets/anshita-avatar.png';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AppView = 'dashboard' | 'onboarding' | 'results';

const Index = () => {
  const { user, profile, loading, isNewUser, signOut, refreshIsNewUser } = useAuth();
  const [view, setView] = useState<AppView | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Determine current view (null means auth not resolved yet)
  function getEffectiveView(): AppView {
    if (view !== null) return view;
    // First time user → onboarding; returning user → dashboard
    return isNewUser ? 'onboarding' : 'dashboard';
  }

  async function handleAnalysisComplete(id: string) {
    setAnalysisId(id);
    setView('results');
  }

  // ---- Loading splash ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---- Not logged in → auth page ----
  if (!user) {
    return <AuthPage />;
  }

  const effectiveView = getEffectiveView();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            className="flex items-center gap-3"
            onClick={() => setView(isNewUser ? 'onboarding' : 'dashboard')}
          >
            <div className="w-8 h-8 rounded-lg intel-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight intel-gradient-text">Competitive Buddy</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">your compass in the outside world</span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {effectiveView === 'results' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setView('onboarding'); setAnalysisId(null); }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                New Analysis
              </Button>
            )}
            {effectiveView !== 'dashboard' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('dashboard')}
                className="gap-2"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            )}

            {/* User avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                  <Avatar className="w-8 h-8 ring-2 ring-primary/30">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs intel-gradient text-primary-foreground">
                      {(profile?.display_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  onClick={signOut}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* History Sidebar */}
        {showHistory && (
          <HistorySidebar
            onSelect={(id) => { setAnalysisId(id); setView('results'); setShowHistory(false); }}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {effectiveView === 'dashboard' && (
            <Dashboard
              onNewAnalysis={() => setView('onboarding')}
              onSelectAnalysis={(id) => { setAnalysisId(id); setView('results'); }}
            />
          )}
          {effectiveView === 'onboarding' && (
            <div>
              {/* Welcome banner for new users */}
              {isNewUser && view === null && (
                <div className="bg-primary/5 border-b border-primary/10 px-4 py-3 text-center">
                  <p className="text-sm text-primary font-medium">
                    👋 Welcome to Competitive Buddy, {profile?.display_name?.split(' ')[0] || 'there'}! Let's run your first analysis.
                  </p>
                </div>
              )}
              <OnboardingFlow
                onComplete={handleAnalysisComplete}
              />
            </div>
          )}
          {effectiveView === 'results' && analysisId && (
            <AnalysisResults analysisId={analysisId} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/80 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">Created by</span>
          <img
            src={anshitaAvatar}
            alt="Anshita"
            className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/30"
          />
          <span className="text-sm font-medium text-foreground">Anshita</span>
          <a
            href="https://www.linkedin.com/in/anshitaarya/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Connect
            <Linkedin className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
