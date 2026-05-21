import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, AlertCircle, BarChart3, Lightbulb, RefreshCw, ChevronDown, ChevronUp, Clock, RotateCw, Megaphone, Activity, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AnalysisResultsProps {
  analysisId: string;
}

interface CompetitorData {
  competitor_id: string;
  category: string;
  ai_summary: string | null;
  score: number | null;
}

interface Competitor {
  id: string;
  name: string; // legacy "Company – Product" composite
  company_name: string | null;
  product_name: string | null;
  website: string | null;
  type: 'direct' | 'disruptor';
}

function ScoreBadge({ score }: { score: number | null }) {
  if (!score) return <span className="text-muted-foreground text-xs">—</span>;
  const color =
    score >= 8 ? 'bg-destructive/10 text-destructive border-destructive/20' :
    score >= 6 ? 'bg-[hsl(38_92%_50%/0.1)] text-[hsl(38_60%_35%)] border-[hsl(38_92%_50%/0.3)]' :
    'bg-primary/10 text-primary border-primary/20';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border', color)}>
      {score}/10
    </span>
  );
}

function renderInline(text: string) {
  // Render **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');

  // Group bullet lines into <ul> blocks
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (key: string) => {
    if (bulletBuffer.length) {
      elements.push(
        <ul key={key} className="space-y-1.5 my-2 ml-1">
          {bulletBuffer.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>{renderInline(b)}</span>
            </li>
          ))}
        </ul>
      );
      bulletBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets(`bullet-${i}`);
      return;
    }
    if (trimmed.startsWith('### ')) {
      flushBullets(`bullet-${i}`);
      elements.push(
        <h4 key={i} className="font-bold text-sm uppercase tracking-wider text-primary mt-5 mb-1.5 flex items-center gap-2">
          <span className="w-3 h-0.5 bg-primary rounded-full inline-block" />
          {trimmed.slice(4)}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      flushBullets(`bullet-${i}`);
      elements.push(
        <h3 key={i} className="font-bold text-base text-foreground mt-6 mb-2 border-b border-border/40 pb-1">{trimmed.slice(3)}</h3>
      );
    } else if (trimmed.startsWith('# ')) {
      flushBullets(`bullet-${i}`);
      elements.push(
        <h2 key={i} className="font-bold text-lg text-foreground mt-4 mb-2">{trimmed.slice(2)}</h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      bulletBuffer.push(trimmed.slice(2));
    } else if (trimmed.match(/^\d+\.\s/)) {
      flushBullets(`bullet-${i}`);
      elements.push(
        <div key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90 my-1">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
            {trimmed.match(/^(\d+)\./)?.[1]}
          </span>
          <span>{renderInline(trimmed.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
    } else {
      flushBullets(`bullet-${i}`);
      elements.push(
        <p key={i} className="text-sm leading-relaxed text-foreground/90">{renderInline(trimmed)}</p>
      );
    }
  });
  flushBullets('bullet-end');

  return <div className="space-y-1">{elements}</div>;
}

function ComparisonCell({
  cellData, expanded, onToggle, emptyText, isSelf = false,
}: {
  cellData: CompetitorData | null | undefined;
  expanded: boolean;
  onToggle: () => void;
  emptyText: React.ReactNode;
  isSelf?: boolean;
}) {
  if (!cellData || (!cellData.ai_summary && !cellData.score)) {
    return <span className="text-muted-foreground text-xs italic">{emptyText}</span>;
  }
  const summary = cellData.ai_summary || '';
  // First sentence as bullet headline
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0]?.trim() || summary;
  const hasMore = summary.length > firstSentence.length + 5;
  return (
    <div className="space-y-1.5">
      {!isSelf && <ScoreBadge score={cellData.score} />}
      {summary && (
        <div>
          <div className="flex items-start gap-1.5 text-xs leading-snug">
            <span className="mt-[5px] w-1 h-1 rounded-full bg-primary flex-shrink-0" />
            <span className="text-foreground/90">{firstSentence}</span>
          </div>
          {hasMore && (
            <>
              <button
                onClick={onToggle}
                className="text-[11px] text-primary hover:underline mt-1 inline-flex items-center gap-0.5"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" />Hide details</> : <><ChevronDown className="w-3 h-3" />Details</>}
              </button>
              {expanded && (
                <p className="mt-1.5 pl-2.5 border-l-2 border-primary/30 text-xs text-muted-foreground leading-relaxed">
                  {summary}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IntelCard({
  title, icon, updatedAt, loading, onRefresh, empty, emptyText, children,
}: {
  title: string;
  icon: React.ReactNode;
  updatedAt: string | null | undefined;
  loading: boolean;
  onRefresh: () => void;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}{title}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1" onClick={onRefresh} disabled={loading} title="Refresh">
            <RotateCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
        {updatedAt && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Updated {new Date(updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading && empty ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning the web…
          </div>
        ) : empty ? (
          <p className="text-xs text-muted-foreground italic">{emptyText}</p>
        ) : children}
      </CardContent>
    </Card>
  );
}

export default function AnalysisResults({ analysisId }: AnalysisResultsProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [data, setData] = useState<CompetitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [rerunning, setRerunning] = useState(false);
  const [intel, setIntel] = useState<{ recent_announcements: any[]; market_trends: any[]; intel_updated_at: string | null } | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);

  async function generateSelfAssessment() {
    if (selfLoading) return;
    setSelfLoading(true);
    try {
      const { error } = await supabase.functions.invoke('self-assessment', {
        body: { analysisId },
      });
      if (error) throw error;
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to generate self assessment');
    } finally {
      setSelfLoading(false);
    }
  }

  async function loadIntel(force = false) {
    if (intelLoading) return;
    setIntelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-intel', {
        body: { analysisId, force },
      });
      if (error) throw error;
      setIntel({
        recent_announcements: data?.recent_announcements || [],
        market_trends: data?.market_trends || [],
        intel_updated_at: data?.intel_updated_at || null,
      });
      if (force) toast.success('Intel refreshed');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load market intel');
    } finally {
      setIntelLoading(false);
    }
  }

  async function rerunAnalysis() {
    if (rerunning) return;
    setRerunning(true);
    try {
      await supabase.from('analyses').update({
        status: 'pending',
        executive_summary: null,
        recommendations: null,
        recent_announcements: null,
        market_trends: null,
        intel_updated_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', analysisId);

      setIntel(null);

      const { error } = await supabase.functions.invoke('run-analysis', {
        body: { analysis_id: analysisId },
      });
      if (error) throw error;
      toast.success('Re-running analysis…');
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to rerun analysis');
    } finally {
      setRerunning(false);
    }
  }

  async function fetchData() {
    const [{ data: a }, { data: comps }, { data: cats }, { data: d }] = await Promise.all([
      supabase.from('analyses').select('*').eq('id', analysisId).single(),
      supabase.from('competitors').select('*').eq('analysis_id', analysisId),
      supabase.from('categories').select('*').eq('analysis_id', analysisId),
      supabase.from('competitor_data').select('*').eq('analysis_id', analysisId),
    ]);

    setAnalysis(a);
    setCompetitors((comps as Competitor[]) || []);
    setCategories(cats?.map(c => c.name) || []);
    setData((d as CompetitorData[]) || []);
    if (a?.recent_announcements || a?.market_trends) {
      setIntel({
        recent_announcements: Array.isArray(a.recent_announcements) ? (a.recent_announcements as any[]) : [],
        market_trends: Array.isArray(a.market_trends) ? (a.market_trends as any[]) : [],
        intel_updated_at: a.intel_updated_at || null,
      });
    }
    setLoading(false);

    return a?.status;
  }

  useEffect(() => {
    fetchData();
  }, [analysisId]);

  // Auto-load intel once analysis is completed and we don't have fresh data
  useEffect(() => {
    if (analysis?.status !== 'completed') return;
    const stale = !intel || !intel.intel_updated_at ||
      (Date.now() - new Date(intel.intel_updated_at).getTime()) > 24 * 60 * 60 * 1000;
    if (stale && !intelLoading) loadIntel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.status]);

  // Auto-generate self-assessment if completed analysis lacks it
  useEffect(() => {
    if (analysis?.status !== 'completed') return;
    if (!categories.length) return;
    const selfComp = competitors.find(c => (c.type as any) === 'self');
    const selfHasData = selfComp
      ? data.some(d => d.competitor_id === selfComp.id && d.ai_summary)
      : false;
    if (!selfHasData && !selfLoading) generateSelfAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.status, competitors.length, categories.length, data.length]);

  // Poll if running
  useEffect(() => {
    if (!analysis) return;
    if (analysis.status === 'running' || analysis.status === 'pending') {
      setPolling(true);
      const interval = setInterval(async () => {
        const status = await fetchData();
        if (status === 'completed' || status === 'failed') {
          setPolling(false);
          clearInterval(interval);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [analysis?.status]);

  function getCellData(competitorId: string, category: string) {
    return data.find(d => d.competitor_id === competitorId && d.category === category);
  }

  function toggleCell(key: string) {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading analysis...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-muted-foreground">Analysis not found.</p>
      </div>
    );
  }

  if (analysis.status === 'running' || analysis.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 rounded-2xl intel-gradient flex items-center justify-center animate-pulse">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Analysis in progress...</h2>
          <p className="text-muted-foreground text-sm">Scraping & synthesizing data across {competitors.length} competitors × {categories.length} categories</p>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (analysis.status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="font-semibold">Analysis failed.</p>
        <Button variant="outline" size="sm" onClick={() => fetchData()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  // Completed
  const selfCompetitor = competitors.find(c => c.type === 'self' as any);
  const otherCompetitors = competitors.filter(c => c.type !== 'self' as any);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{analysis.user_product} · Competitive Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {analysis.user_company} · {analysis.user_role} · {competitors.length} competitors · {categories.length} categories
          </p>
          <p className="text-muted-foreground text-xs mt-1.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Last run {new Date(analysis.updated_at || analysis.created_at).toLocaleString(undefined, {
              dateStyle: 'medium', timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">✓ Completed</Badge>
          <Button variant="outline" size="sm" onClick={rerunAnalysis} disabled={rerunning} className="gap-1.5">
            <RotateCw className={cn('w-3.5 h-3.5', rerunning && 'animate-spin')} />
            {rerunning ? 'Re-running…' : 'Rerun'}
          </Button>
          {polling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="summary" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Summary</TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Comparison</TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-1.5"><Lightbulb className="w-3.5 h-3.5" />Strategy</TabsTrigger>
        </TabsList>

        {/* Executive Summary */}
        <TabsContent value="summary">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.executive_summary ? (
                <MarkdownText text={analysis.executive_summary} />
              ) : (
                <p className="text-muted-foreground text-sm">No summary available.</p>
              )}

              {/* Competitor overview cards */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitors.filter(c => c.type !== 'self' as any).map(comp => {
                  const compData = data.filter(d => d.competitor_id === comp.id && d.score);
                  const avgScore = compData.length
                    ? Math.round(compData.reduce((sum, d) => sum + (d.score || 0), 0) / compData.length * 10) / 10
                    : null;
                  const companyLabel = comp.company_name || comp.name?.split(' – ')[0] || comp.name;
                  const productLabel = comp.product_name || comp.name?.split(' – ')[1] || null;
                  return (
                    <div key={comp.id} className={cn(
                      'p-4 rounded-xl border card-hover',
                      comp.type === 'disruptor' ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'
                    )}>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{companyLabel}</p>
                          {productLabel && (
                            <p className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-full inline-block mt-1 truncate max-w-full">
                              {productLabel}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className={cn(
                          'text-xs flex-shrink-0',
                          comp.type === 'disruptor' ? 'border-accent/50 text-accent' : 'border-primary/30 text-primary'
                        )}>
                          {comp.type === 'disruptor' ? '⚡ Disruptor' : '⚔️ Direct'}
                        </Badge>
                      </div>
                      {avgScore !== null && (
                        <div className="text-sm text-muted-foreground">
                          Avg threat score: <span className="font-bold text-foreground">{avgScore}/10</span>
                        </div>
                      )}
                      {comp.website && (
                        <a href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-primary hover:underline mt-1 block truncate">
                          {comp.website}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Table */}
        <TabsContent value="table">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
            <div className="min-w-0">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Tabular Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-semibold text-muted-foreground w-40 sticky left-0 bg-muted/50 z-10">Category</th>
                      <th className="text-left p-3 font-semibold min-w-[180px] bg-primary/5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{analysis.user_company}</span>
                            <Badge variant="outline" className="text-xs ml-1 border-primary/40 text-primary bg-primary/10">
                              ★ You
                            </Badge>
                          </div>
                          <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full w-fit">
                            {analysis.user_product}
                          </span>
                        </div>
                      </th>
                      {otherCompetitors.map(comp => {
                        const companyLabel = comp.company_name || comp.name?.split(' – ')[0] || comp.name;
                        const productLabel = comp.product_name || comp.name?.split(' – ')[1] || null;
                        return (
                          <th key={comp.id} className="text-left p-3 font-semibold min-w-[180px]">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{companyLabel}</span>
                                <Badge variant="outline" className={cn('text-xs ml-1', comp.type === 'disruptor' ? 'border-accent/40 text-accent' : 'border-primary/30 text-primary')}>
                                  {comp.type === 'disruptor' ? '⚡' : '⚔️'}
                                </Badge>
                              </div>
                              {productLabel && (
                                <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full w-fit">
                                  {productLabel}
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, catIdx) => (
                      <tr key={cat} className={cn('border-b border-border/50', catIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                        <td className="p-3 font-medium text-muted-foreground text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                          {cat}
                        </td>
                        {(() => {
                          const cellData = selfCompetitor ? getCellData(selfCompetitor.id, cat) : null;
                          const key = `self:${cat}`;
                          const isExpanded = expandedCells.has(key);
                          return (
                            <td className="p-3 align-top bg-primary/5">
                              <ComparisonCell
                                cellData={cellData}
                                expanded={isExpanded}
                                onToggle={() => toggleCell(key)}
                                emptyText={selfLoading ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Generating…
                                  </span>
                                ) : 'Self-assessment pending'}
                              />
                            </td>
                          );
                        })()}
                        {otherCompetitors.map(comp => {
                          const cellData = getCellData(comp.id, cat);
                          const key = `${comp.id}:${cat}`;
                          const isExpanded = expandedCells.has(key);
                          return (
                            <td key={comp.id} className="p-3 align-top">
                              <ComparisonCell
                                cellData={cellData}
                                expanded={isExpanded}
                                onToggle={() => toggleCell(key)}
                                emptyText="—"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Score legend */}
              <div className="p-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Threat score legend:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive/15 border border-destructive/25 inline-block" /> 8–10 High threat</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-secondary border border-border inline-block" /> 6–7 Moderate</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary/10 border border-primary/20 inline-block" /> 1–5 Lower threat</span>
              </div>
            </CardContent>
          </Card>
            </div>
            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <IntelCard
                title="Recent Announcements & Launches"
                icon={<Megaphone className="w-5 h-5 text-primary" />}
                updatedAt={intel?.intel_updated_at}
                loading={intelLoading}
                onRefresh={() => loadIntel(true)}
                empty={!intel || !intel.recent_announcements?.length}
                emptyText="No recent announcements found yet."
              >
                <div className="space-y-4">
                  {intel?.recent_announcements?.map((group: any, gi: number) => (
                    <div key={gi}>
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-primary" />
                        {group.company}{group.product ? ` · ${group.product}` : ''}
                      </p>
                      <ul className="space-y-2.5 ml-2.5">
                        {(group.items || []).map((it: any, i: number) => (
                          <li key={i} className="border-l border-border pl-3 -ml-px">
                            <a href={it.url} target="_blank" rel="noreferrer"
                              className="text-xs font-medium text-foreground hover:text-primary inline-flex items-start gap-1 leading-snug">
                              {it.title}
                              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60" />
                            </a>
                            {it.date && <p className="text-[10px] text-muted-foreground mt-0.5">{it.date}</p>}
                            {it.highlight && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.highlight}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </IntelCard>

              <IntelCard
                title="Market Trends"
                icon={<Activity className="w-5 h-5 text-primary" />}
                updatedAt={intel?.intel_updated_at}
                loading={intelLoading}
                onRefresh={() => loadIntel(true)}
                empty={!intel || !intel.market_trends?.length}
                emptyText="No trend signals available yet."
              >
                <div className="space-y-4">
                  {intel?.market_trends?.map((t: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border/60">
                      <p className="text-xs font-semibold text-foreground mb-1.5">{t.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{t.summary}</p>
                      {!!t.signals?.length && (
                        <ul className="space-y-1 mb-2">
                          {t.signals.map((s: string, si: number) => (
                            <li key={si} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                              <span className="mt-1 w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!!t.sources?.length && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/40">
                          {t.sources.slice(0, 3).map((s: any, si: number) => (
                            <a key={si} href={s.url} target="_blank" rel="noreferrer"
                              className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                              <ExternalLink className="w-2.5 h-2.5" />
                              {s.title ? (s.title.length > 30 ? s.title.slice(0, 30) + '…' : s.title) : 'source'}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </IntelCard>
            </aside>
          </div>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                Strategic Recommendations for {analysis.user_company}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.recommendations ? (
                <MarkdownText text={analysis.recommendations} />
              ) : (
                <p className="text-muted-foreground text-sm">No recommendations available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
