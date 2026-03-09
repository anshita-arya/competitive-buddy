import { useState } from 'react';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AuthPage() {
  const { toast } = useToast();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  async function handleGoogle() {
    setLoadingGoogle(true);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: 'Sign-in failed', description: String(error), variant: 'destructive' });
      setLoadingGoogle(false);
    }
  }

  async function handleApple() {
    setLoadingApple(true);
    const { error } = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: 'Sign-in failed', description: String(error), variant: 'destructive' });
      setLoadingApple(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl intel-gradient flex items-center justify-center shadow-lg">
            <Zap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold intel-gradient-text">Competitive Buddy</h1>
            <p className="text-muted-foreground text-sm mt-1">your compass in the outside world</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Welcome</h2>
            <p className="text-sm text-muted-foreground">Sign in to save your analyses and access your history</p>
          </div>

          <div className="space-y-3">
            {/* Google */}
            <Button
              variant="outline"
              className="w-full h-11 gap-3 font-medium border-border/80 hover:bg-muted/60 transition-all"
              onClick={handleGoogle}
              disabled={loadingGoogle || loadingApple}
            >
              {loadingGoogle ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Apple */}
            <Button
              variant="outline"
              className="w-full h-11 gap-3 font-medium border-border/80 hover:bg-muted/60 transition-all"
              onClick={handleApple}
              disabled={loadingGoogle || loadingApple}
            >
              {loadingApple ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 fill-foreground" aria-hidden="true">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                </svg>
              )}
              Continue with Apple
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to keep your competitive data secure and private.
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          Microsoft SSO coming soon
        </p>
      </div>
    </div>
  );
}
