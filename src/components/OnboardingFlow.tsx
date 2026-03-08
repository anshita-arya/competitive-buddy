import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight, Plus, Check, Globe, Zap, Building2, User, Layers, Pencil, Package, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
  onComplete: (analysisId: string) => void;
}

type Step = 'profile' | 'competitors' | 'categories' | 'launching';

interface CompetitorSuggestion {
  name: string;       // company name
  product: string;    // competing product name
  website: string;
  type: 'direct' | 'disruptor';
  description: string;
}

interface CategorySuggestion {
  name: string;
  description: string;
}

const STEPS = [
  { id: 'profile', label: 'Your Profile', icon: User },
  { id: 'competitors', label: 'Competitors', icon: Building2 },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'launching', label: 'Analyzing', icon: Zap },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('profile');

  // Profile
  const [product, setProduct] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');

  // Competitors
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<CompetitorSuggestion[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  // Track per-competitor product overrides keyed by company name
  const [productOverrides, setProductOverrides] = useState<Record<string, string>>({});
  // Track which competitor is being edited
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingProductValue, setEditingProductValue] = useState('');
  // Track which competitor cards are expanded (showing details)
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(new Set());

  const [customCompetitorName, setCustomCompetitorName] = useState('');
  const [customCompetitorProduct, setCustomCompetitorProduct] = useState('');
  const [customCompetitors, setCustomCompetitors] = useState<CompetitorSuggestion[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);

  // Categories
  const [suggestedCategories, setSuggestedCategories] = useState<CategorySuggestion[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [customCategory, setCustomCategory] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [launching, setLaunching] = useState(false);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product.trim() || !company.trim() || !role.trim()) return;

    setLoadingCompetitors(true);
    setStep('competitors');

    try {
      const { data, error } = await supabase.functions.invoke('suggest-competitors', {
        body: { product, company, role },
      });
      if (error) throw error;
      const competitors: CompetitorSuggestion[] = (data.competitors || []).map((c: CompetitorSuggestion) => ({
        ...c,
        product: c.product || c.name,
      }));
      setSuggestedCompetitors(competitors);
      // Auto-select first 4
      const autoSelect = new Set<string>(competitors.slice(0, 4).map((c) => c.name));
      setSelectedCompetitors(autoSelect);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoadingCompetitors(false);
    }
  }

  function toggleCompetitor(name: string) {
    setSelectedCompetitors(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function startEditProduct(companyName: string, currentProduct: string) {
    setEditingProduct(companyName);
    setEditingProductValue(productOverrides[companyName] ?? currentProduct);
  }

  function saveEditProduct(companyName: string) {
    if (editingProductValue.trim()) {
      setProductOverrides(prev => ({ ...prev, [companyName]: editingProductValue.trim() }));
    }
    setEditingProduct(null);
  }

  function addCustomCompetitor() {
    if (!customCompetitorName.trim()) return;
    const c: CompetitorSuggestion = {
      name: customCompetitorName.trim(),
      product: customCompetitorProduct.trim() || customCompetitorName.trim(),
      website: '',
      type: 'direct',
      description: 'Custom competitor',
    };
    setCustomCompetitors(prev => [...prev, c]);
    setSelectedCompetitors(prev => new Set([...prev, c.name]));
    setCustomCompetitorName('');
    setCustomCompetitorProduct('');
  }

  async function handleCompetitorsNext() {
    if (selectedCompetitors.size === 0) return;
    setLoadingCategories(true);
    setStep('categories');

    try {
      const allCompetitors = [...suggestedCompetitors, ...customCompetitors];
      const selected = allCompetitors.filter(c => selectedCompetitors.has(c.name)).map(c => c.name);
      const { data, error } = await supabase.functions.invoke('suggest-categories', {
        body: { product, company, competitors: selected },
      });
      if (error) throw error;
      const cats: CategorySuggestion[] = data.categories || [];
      setSuggestedCategories(cats);
      setSelectedCategories(cats.length > 0 ? new Set([cats[0].name]) : new Set());
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoadingCategories(false);
    }
  }

  async function handleLaunch() {
    if (selectedCategories.size === 0) return;
    setLaunching(true);
    setStep('launching');

    try {
      const { data: analysis, error: aErr } = await supabase.from('analyses').insert({
        user_product: product,
        user_role: role,
        user_company: company,
        status: 'pending',
      }).select().single();
      if (aErr || !analysis) throw new Error(aErr?.message || 'Failed to create analysis');

      const allCompetitors = [...suggestedCompetitors, ...customCompetitors];
      const selected = allCompetitors.filter(c => selectedCompetitors.has(c.name));
      // Use overridden product names where available; store as "Company - Product" for analysis
      await supabase.from('competitors').insert(
        selected.map(c => ({
          analysis_id: analysis.id,
          name: `${c.name} – ${productOverrides[c.name] ?? c.product}`,
          website: c.website || null,
          type: c.type,
        }))
      );

      await supabase.from('categories').insert(
        Array.from(selectedCategories).map(name => ({
          analysis_id: analysis.id,
          name,
        }))
      );

      const { error: runErr } = await supabase.functions.invoke('run-analysis', {
        body: { analysis_id: analysis.id },
      });
      if (runErr) throw runErr;

      onComplete(analysis.id);
    } catch (err) {
      toast({ title: 'Analysis failed', description: (err as Error).message, variant: 'destructive' });
      setStep('categories');
      setLaunching(false);
    }
  }

  const allCompetitors = [...suggestedCompetitors, ...customCompetitors];

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-secondary/20 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCurrent = s.id === step;
            const isDone = i < stepIndex;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  isCurrent && 'intel-gradient text-white shadow-md',
                  isDone && 'bg-primary/10 text-primary',
                  !isCurrent && !isDone && 'text-muted-foreground'
                )}>
                  {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('w-6 h-px', i < stepIndex ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step: Profile */}
        {step === 'profile' && (
          <Card className="border-border/60 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Tell us about your product</CardTitle>
              <CardDescription>We'll use this to suggest relevant competitors and analysis categories.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    placeholder="e.g. Notion Labs, Inc."
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product">Product Name</Label>
                  <Input
                    id="product"
                    placeholder="e.g. Notion, Slack, Figma"
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={setRole} required>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Product Manager">Product Manager</SelectItem>
                      <SelectItem value="Founder / CEO">Founder / CEO</SelectItem>
                      <SelectItem value="CMO / Marketing">CMO / Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Business Development">Business Development</SelectItem>
                      <SelectItem value="Strategy / Corporate Development">Strategy / Corporate Development</SelectItem>
                      <SelectItem value="Analyst">Analyst</SelectItem>
                      <SelectItem value="Engineer / Technical Lead">Engineer / Technical Lead</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={!role} className="w-full gap-2 intel-gradient text-white border-0" size="lg">
                  Find Competitors <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step: Competitors */}
        {step === 'competitors' && (
          <Card className="border-border/60 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Select your competitors</CardTitle>
              <CardDescription>
                We've suggested direct competitors and disruptors. You can correct the competing product if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingCompetitors ? (
                <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Finding competitors with AI...</p>
                </div>
              ) : (
                <>
                  {(['direct', 'disruptor'] as const).map(type => {
                    const list = allCompetitors.filter(c => c.type === type);
                    if (!list.length) return null;
                    return (
                      <div key={type}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                          {type === 'direct' ? '⚔️ Direct Competitors' : '⚡ Disruptors & Emerging Players'}
                        </p>
                        <div className="space-y-2">
                          {list.map(c => {
                            const isSelected = selectedCompetitors.has(c.name);
                            const currentProduct = productOverrides[c.name] ?? c.product;
                            const isEditing = editingProduct === c.name;
                            const isExpanded = expandedCompetitors.has(c.name);
                            return (
                              <div
                                key={c.name}
                                className={cn(
                                  'rounded-lg border transition-all',
                                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                                )}
                              >
                                {/* Main row: checkbox + Company – Product + expand toggle */}
                                <div className="flex items-center gap-3 p-3">
                                  <button
                                    onClick={() => toggleCompetitor(c.name)}
                                    className={cn(
                                      'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                                      isSelected ? 'border-primary bg-primary' : 'border-border'
                                    )}
                                  >
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </button>

                                  {/* Company + product inline */}
                                  <button
                                    onClick={() => toggleCompetitor(c.name)}
                                    className="flex-1 text-left flex items-center gap-2 min-w-0"
                                  >
                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="font-semibold text-sm truncate">{c.name}</span>
                                    <span className="text-muted-foreground text-sm flex-shrink-0">—</span>
                                    {isEditing ? null : (
                                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full truncate flex items-center gap-1">
                                        <Package className="w-3 h-3 flex-shrink-0" />
                                        {currentProduct}
                                        {productOverrides[c.name] && (
                                          <span className="text-primary/60 ml-1">✎</span>
                                        )}
                                      </span>
                                    )}
                                  </button>

                                  {/* Edit product & expand buttons */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {!isEditing && (
                                      <button
                                        onClick={e => { e.stopPropagation(); startEditProduct(c.name, c.product); }}
                                        className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                                        title="Edit competing product"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setExpandedCompetitors(prev => {
                                          const next = new Set(prev);
                                          if (next.has(c.name)) next.delete(c.name);
                                          else next.add(c.name);
                                          return next;
                                        });
                                      }}
                                      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                      title="Show details"
                                    >
                                      <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-180')} />
                                    </button>
                                  </div>
                                </div>

                                {/* Inline product edit input */}
                                {isEditing && (
                                  <div className="flex items-center gap-2 px-3 pb-3 ml-8">
                                    <Package className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    <Input
                                      className="h-7 text-xs py-0 flex-1"
                                      value={editingProductValue}
                                      onChange={e => setEditingProductValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveEditProduct(c.name);
                                        if (e.key === 'Escape') setEditingProduct(null);
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs px-2 intel-gradient text-white border-0"
                                      onClick={() => saveEditProduct(c.name)}
                                    >
                                      <Check className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}

                                {/* Expandable details: URL + description */}
                                {isExpanded && (
                                  <div className="px-3 pb-3 ml-8 space-y-1 border-t border-border/50 pt-2 mt-1">
                                    {c.website && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Globe className="w-3 h-3 flex-shrink-0" />
                                        <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline-offset-2 hover:underline truncate">{c.website}</a>
                                      </p>
                                    )}
                                    {c.description && (
                                      <p className="text-xs text-muted-foreground">{c.description}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom competitor input */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">➕ Add Custom</p>
                    <div className="space-y-2">
                      <Input
                        placeholder="Company name"
                        value={customCompetitorName}
                        onChange={e => setCustomCompetitorName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomCompetitor()}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Competing product name (optional)"
                          value={customCompetitorProduct}
                          onChange={e => setCustomCompetitorProduct(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomCompetitor()}
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={addCustomCompetitor} size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep('profile')} className="flex-1">Back</Button>
                    <Button
                      onClick={handleCompetitorsNext}
                      disabled={selectedCompetitors.size === 0}
                      className="flex-2 gap-2 intel-gradient text-white border-0"
                    >
                      Next: Categories <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Categories */}
        {step === 'categories' && (
          <Card className="border-border/60 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Choose analysis categories</CardTitle>
              <CardDescription>Select which dimensions to analyze across all competitors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingCategories ? (
                <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Generating relevant categories...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {suggestedCategories.map(cat => {
                      const isSelected = selectedCategories.has(cat.name);
                      return (
                        <button
                          key={cat.name}
                          onClick={() => setSelectedCategories(prev => {
                            const next = new Set(prev);
                            if (next.has(cat.name)) next.delete(cat.name);
                            else next.add(cat.name);
                            return next;
                          })}
                          className={cn(
                            'relative text-left p-3 rounded-lg border transition-all',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/40'
                          )}
                        >
                          <div className={cn(
                            'absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          )}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <p className="font-medium text-sm pr-6 leading-snug">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom category */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a custom category..."
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customCategory.trim()) {
                            setSuggestedCategories(prev => [...prev, { name: customCategory.trim(), description: '' }]);
                            setSelectedCategories(prev => new Set([...prev, customCategory.trim()]));
                            setCustomCategory('');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!customCategory.trim()) return;
                          setSuggestedCategories(prev => [...prev, { name: customCategory.trim(), description: '' }]);
                          setSelectedCategories(prev => new Set([...prev, customCategory.trim()]));
                          setCustomCategory('');
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">{selectedCategories.size} categories selected</p>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep('competitors')} className="flex-1">Back</Button>
                    <Button
                      onClick={handleLaunch}
                      disabled={selectedCategories.size === 0 || launching}
                      className="flex-2 gap-2 intel-gradient text-white border-0"
                    >
                      {launching ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Analysis...</> : <><Zap className="w-4 h-4" /> Run Analysis</>}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Launching */}
        {step === 'launching' && (
          <Card className="border-border/60 shadow-xl">
            <CardContent className="py-16 flex flex-col items-center gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl intel-gradient flex items-center justify-center animate-pulse">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Running competitive analysis...</h2>
                <p className="text-muted-foreground max-w-sm">
                  Scraping competitor data with Firecrawl and synthesizing insights with Gemini. This may take 1-2 minutes.
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                {['Scraping competitor websites', 'Analyzing product launches', 'Processing blog & announcements', 'Synthesizing insights with AI'].map((label, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" style={{ animationDelay: `${i * 200}ms` }} />
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
