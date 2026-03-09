import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Clock, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisItem {
  id: string;
  user_product: string;
  user_company: string;
  user_role: string;
  status: string;
  created_at: string;
}

interface DashboardProps {
  onNewAnalysis: () => void;
  onSelectAnalysis: (id: string) => void;
}

export default function Dashboard({ onNewAnalysis, onSelectAnalysis }: DashboardProps) {
  const { user, profile } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('analyses')
      .select('id, user_product, user_company, user_role, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setAnalyses((data as AnalysisItem[]) || []);
        setLoading(false);
      });
  }, [user]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const firstName = profile?.display_name?.split(' ')[0] || 'back';
  const completedCount = analyses.filter(a => a.status === 'completed').length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || 'Avatar'}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30"
            />
          ) : (
            <div className="w-12 h-12 rounded-full intel-gradient flex items-center justify-center text-primary-foreground font-bold text-lg">
              {(profile?.display_name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, <span className="intel-gradient-text">{firstName}</span> 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              {completedCount} completed {completedCount === 1 ? 'analysis' : 'analyses'}
            </p>
          </div>
        </div>
        <Button
          onClick={onNewAnalysis}
          className="gap-2 intel-gradient text-primary-foreground border-0 shadow-md"
          size="lg"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Button>
      </div>

      {/* Stats row */}
      {analyses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border/60 rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Analyses</p>
            <p className="text-3xl font-bold mt-1 intel-gradient-text">{analyses.length}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
            <p className="text-3xl font-bold mt-1 text-primary">{completedCount}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Products Tracked</p>
            <p className="text-3xl font-bold mt-1 text-foreground">
              {new Set(analyses.map(a => a.user_product)).size}
            </p>
          </div>
        </div>
      )}

      {/* Analyses list */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Your Analyses</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-border rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No analyses yet</p>
              <p className="text-sm text-muted-foreground mt-1">Run your first competitive analysis to get started</p>
            </div>
            <Button onClick={onNewAnalysis} className="gap-2 intel-gradient text-primary-foreground border-0 mt-2">
              <Plus className="w-4 h-4" />
              New Analysis
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {analyses.map(a => (
              <button
                key={a.id}
                onClick={() => onSelectAnalysis(a.id)}
                className="w-full text-left p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-primary/30 transition-all group flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{a.user_product}</p>
                    <span className="text-muted-foreground text-xs">·</span>
                    <p className="text-xs text-muted-foreground truncate">{a.user_company}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium',
                      a.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                      a.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' :
                      'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    )}>
                      {a.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
