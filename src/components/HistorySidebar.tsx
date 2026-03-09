import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { X, BarChart3, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistorySidebarProps {
  onSelect: (id: string) => void;
  onClose: () => void;
}

interface AnalysisItem {
  id: string;
  user_product: string;
  user_company: string;
  status: string;
  created_at: string;
}

export default function HistorySidebar({ onSelect, onClose }: HistorySidebarProps) {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('analyses')
      .select('id, user_product, user_company, status, created_at')
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

  return (
    <aside className="w-72 border-r border-border bg-card shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Analysis History</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
            <BarChart3 className="w-8 h-8 opacity-30" />
            <p>No analyses yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {analyses.map(a => (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors flex items-center gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.user_product}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.user_company}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      a.status === 'completed' ? 'bg-primary/10 text-primary' :
                      a.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                      'bg-secondary/20 text-secondary-foreground'
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
    </aside>
  );
}
