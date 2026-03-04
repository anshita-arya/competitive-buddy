import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, AlertCircle, BarChart3, Lightbulb, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  name: string;
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

function MarkdownText({ text }: { text: string }) {
  // Simple markdown-like rendering for the output
  const paragraphs = text.split('\n').filter(p => p.trim());
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {paragraphs.map((p, i) => {
        if (p.startsWith('## ')) return <h3 key={i} className="font-bold text-base mt-4">{p.slice(3)}</h3>;
        if (p.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4">{p.slice(2)}</h2>;
        if (p.startsWith('- ') || p.startsWith('• ')) return <li key={i} className="ml-4 list-disc">{p.slice(2)}</li>;
        if (p.match(/^\d+\.\s/)) return <li key={i} className="ml-4 list-decimal">{p.replace(/^\d+\.\s/, '')}</li>;
        if (p.startsWith('**') && p.endsWith('**')) return <p key={i} className="font-semibold">{p.slice(2, -2)}</p>;
        return <p key={i}>{p}</p>;
      })}
    </div>
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
    setLoading(false);

    return a?.status;
  }

  useEffect(() => {
    fetchData();
  }, [analysisId]);

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
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{analysis.user_product} · Competitive Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {analysis.user_company} · {analysis.user_role} · {competitors.length} competitors · {categories.length} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">✓ Completed</Badge>
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
                {competitors.map(comp => {
                  const compData = data.filter(d => d.competitor_id === comp.id && d.score);
                  const avgScore = compData.length
                    ? Math.round(compData.reduce((sum, d) => sum + (d.score || 0), 0) / compData.length * 10) / 10
                    : null;
                  return (
                    <div key={comp.id} className={cn(
                      'p-4 rounded-xl border card-hover',
                      comp.type === 'disruptor' ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{comp.name}</span>
                        <Badge variant="outline" className={cn(
                          'text-xs',
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
                      {competitors.map(comp => (
                        <th key={comp.id} className="text-left p-3 font-semibold min-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            {comp.name}
                            <Badge variant="outline" className={cn('text-xs ml-1', comp.type === 'disruptor' ? 'border-accent/40 text-accent' : 'border-primary/30 text-primary')}>
                              {comp.type === 'disruptor' ? '⚡' : '⚔️'}
                            </Badge>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, catIdx) => (
                      <tr key={cat} className={cn('border-b border-border/50', catIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                        <td className="p-3 font-medium text-muted-foreground text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                          {cat}
                        </td>
                        {competitors.map(comp => {
                          const cellData = getCellData(comp.id, cat);
                          const key = `${comp.id}:${cat}`;
                          const isExpanded = expandedCells.has(key);
                          return (
                            <td key={comp.id} className="p-3 align-top">
                              {cellData ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <ScoreBadge score={cellData.score} />
                                  </div>
                                  {cellData.ai_summary && (
                                    <div>
                                      <p className={cn('text-xs text-muted-foreground leading-relaxed', !isExpanded && 'line-clamp-3')}>
                                        {cellData.ai_summary}
                                      </p>
                                      {cellData.ai_summary.length > 150 && (
                                        <button
                                          onClick={() => toggleCell(key)}
                                          className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-0.5"
                                        >
                                          {isExpanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
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
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-200 inline-block" /> 8–10 High threat</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200 inline-block" /> 6–7 Moderate</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200 inline-block" /> 1–5 Lower threat</span>
              </div>
            </CardContent>
          </Card>
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
