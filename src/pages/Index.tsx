import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import OnboardingFlow from '@/components/OnboardingFlow';
import AnalysisResults from '@/components/AnalysisResults';
import HistorySidebar from '@/components/HistorySidebar';
import { Button } from '@/components/ui/button';
import {
  History, Plus, Zap, Linkedin, LogOut, Loader2,
  Swords, Target, Briefcase, Sparkles, Map as MapIcon, FileText
} from 'lucide-react';
import anshitaAvatar from '@/assets/anshita-avatar.png';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AppView = 'dashboard' | 'onboarding' | 'results';
export type AppSection = 'key-competition' | 'competitor-analysis' | 'deal-analysis';

const Index = () => {
  const { user, profile, loading, isNewUser, signOut, refreshIsNewUser } = useAuth();
  const [section, setSection] = useState<AppSection>('competitor-analysis');
  const [view, setView] = useState<AppView | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  function getEffectiveView(): AppView {
    if (view !== null) return view;
    return isNewUser ? 'onboarding' : 'dashboard';
  }

  async function handleAnalysisComplete(id: string) {
    setAnalysisId(id);
    setView('results');
    await refreshIsNewUser();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const effectiveView = getEffectiveView();

  const navItems: { id: AppSection; label: string; icon: typeof Swords }[] = [
    { id: 'key-competition', label: 'Key Competition', icon: Swords },
    { id: 'competitor-analysis', label: 'Competitor Analysis', icon: Target },
    { id: 'deal-analysis', label: 'Deal Analysis', icon: Briefcase },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            className="flex items-center gap-3"
            onClick={() => { setSection('competitor-analysis'); setView('dashboard'); }}
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
            {section === 'competitor-analysis' && effectiveView === 'results' && (
              <Button variant="outline" size="sm"
                onClick={() => { setView('onboarding'); setAnalysisId(null); }} className="gap-2">
                <Plus className="w-4 h-4" /> New Analysis
              </Button>
            )}
            {section === 'competitor-analysis' && effectiveView !== 'onboarding' && (
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(h => !h)} className="gap-2">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </Button>
            )}

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
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer" onClick={signOut}>
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Primary nav sidebar */}
        <nav className="hidden md:flex flex-col w-60 border-r border-border/60 bg-card/30 p-3 gap-1 flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 pb-2 pt-1 font-semibold">
            Workspace
          </p>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setView(null); setAnalysisId(null); }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  active
                    ? "intel-gradient text-primary-foreground shadow-md"
                    : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile nav pills */}
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-1 bg-card border border-border rounded-full p-1 shadow-lg">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setView(null); setAnalysisId(null); }}
                className={cn(
                  "p-2.5 rounded-full transition-all",
                  active ? "intel-gradient text-primary-foreground" : "text-muted-foreground"
                )}
                aria-label={item.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* History Sidebar */}
        {section === 'competitor-analysis' && showHistory && (
          <HistorySidebar
            onSelect={(id) => { setAnalysisId(id); setView('results'); setShowHistory(false); }}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {section === 'key-competition' && <KeyCompetitionPlaceholder />}
          {section === 'deal-analysis' && <DealAnalysisPlaceholder />}
          {section === 'competitor-analysis' && (
            <>
              {effectiveView === 'dashboard' && (
                <Dashboard
                  onNewAnalysis={() => setView('onboarding')}
                  onSelectAnalysis={(id) => { setAnalysisId(id); setView('results'); }}
                />
              )}
              {effectiveView === 'onboarding' && (
                <div>
                  {isNewUser && view === null && (
                    <div className="bg-primary/5 border-b border-primary/10 px-4 py-3 text-center">
                      <p className="text-sm text-primary font-medium">
                        👋 Welcome to Competitive Buddy, {profile?.display_name?.split(' ')[0] || 'there'}! Let's run your first analysis.
                      </p>
                    </div>
                  )}
                  <OnboardingFlow onComplete={handleAnalysisComplete} />
                </div>
              )}
              {effectiveView === 'results' && analysisId && (
                <AnalysisResults analysisId={analysisId} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/80 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">Created by</span>
          <img src={anshitaAvatar} alt="Anshita" className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/30" />
          <span className="text-sm font-medium text-foreground">Anshita</span>
          <a href="https://www.linkedin.com/in/anshitaarya/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium">
            Connect <Linkedin className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </div>
  );
};

function ComingSoonCard({ icon: Icon, title, description }: { icon: typeof Swords; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 flex flex-col items-center justify-center text-center min-h-[260px] hover:border-primary/30 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-semibold text-base">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      <span className="mt-4 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
        Coming soon
      </span>
    </div>
  );
}

function KeyCompetitionPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl intel-gradient flex items-center justify-center">
          <Swords className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Key Competition</h1>
          <p className="text-sm text-muted-foreground">Battle-ready intel on the rivals you face most often.</p>
        </div>
      </div>

      <div className="relative rounded-2xl border border-border bg-card/40 p-10 text-center overflow-hidden">
        <div className="absolute inset-0 intel-gradient opacity-5" />
        <div className="relative">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold intel-gradient-text">Coming soon</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            We're building a dedicated workspace to track your most strategic competitors with always-on monitoring.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ComingSoonCard icon={FileText} title="Battle Cards"
          description="One-page sales enablement cards with positioning, objection handling, and win themes." />
        <ComingSoonCard icon={MapIcon} title="Position Map"
          description="Visualize where every competitor sits across the dimensions that matter for your market." />
      </div>
    </div>
  );
}

function DealAnalysisPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl intel-gradient flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Deal Analysis</h1>
          <p className="text-sm text-muted-foreground">Deal-level competitive intelligence to help you win more.</p>
        </div>
      </div>

      <div className="relative rounded-2xl border border-border bg-card/40 p-16 text-center overflow-hidden">
        <div className="absolute inset-0 intel-gradient opacity-5" />
        <div className="relative">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold intel-gradient-text">Coming soon</h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
            Soon you'll be able to drop in a deal and get instant competitive context, talk tracks, and risk signals.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Index;
