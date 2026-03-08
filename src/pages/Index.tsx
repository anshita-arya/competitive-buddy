import { useState } from 'react';
import OnboardingFlow from '@/components/OnboardingFlow';
import AnalysisResults from '@/components/AnalysisResults';
import HistorySidebar from '@/components/HistorySidebar';
import { Button } from '@/components/ui/button';
import { History, Plus, Zap, Linkedin } from 'lucide-react';
import anshitaAvatar from '@/assets/anshita-avatar.png';

export type AppView = 'onboarding' | 'results';

const Index = () => {
  const [view, setView] = useState<AppView>('onboarding');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg intel-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight intel-gradient-text">Competitive Buddy</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">your compass in the outside world</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'results' && (
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
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
          {view === 'onboarding' ? (
            <OnboardingFlow
              onComplete={(id) => { setAnalysisId(id); setView('results'); }}
            />
          ) : analysisId ? (
            <AnalysisResults analysisId={analysisId} />
          ) : null}
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
            <Linkedin className="w-4 h-4" />
            Connect
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
