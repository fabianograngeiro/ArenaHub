import { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { clearToken, resetAppToFactory } from '@/lib/authApi';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function animateRandomDisappear(rootId: string): Promise<void> {
  return new Promise((resolve) => {
    const root = document.getElementById(rootId);
    if (!root) {
      resolve();
      return;
    }

    const all = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const tag = el.tagName.toLowerCase();
      return tag !== 'style' && tag !== 'script' && el.offsetParent !== null;
    });

    if (all.length === 0) {
      resolve();
      return;
    }

    const randomized = shuffle(all);
    const delays = randomized.map((_, index) => Math.floor(Math.random() * 500) + index * 22);
    let maxDelay = 0;

    randomized.forEach((el, idx) => {
      const delay = delays[idx];
      if (delay > maxDelay) maxDelay = delay;

      el.style.transition = 'opacity 420ms ease, transform 420ms ease, filter 420ms ease';
      el.style.willChange = 'opacity, transform, filter';

      window.setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px) scale(0.985)';
        el.style.filter = 'blur(1px)';
      }, delay);
    });

    window.setTimeout(() => resolve(), maxDelay + 520);
  });
}

export function SuperadminSystem() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    const confirmed = confirm('Isso vai resetar todo o app para padrão de fábrica e remover todos os dados. Continuar?');
    if (!confirmed) return;

    setLoading(true);
    setError('');

    try {
      await resetAppToFactory();
      await animateRandomDisappear('superadmin-system-reset-root');
      clearToken();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao resetar aplicação.');
      setLoading(false);
    }
  };

  return (
    <div id="superadmin-system-reset-root" className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight dark:text-white">Sistema</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Ações críticas de manutenção global do app.</p>
      </header>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-12 flex flex-col items-center gap-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-xs font-black uppercase tracking-widest">
          <AlertTriangle size={14} /> Zona Crítica
        </div>

        <button
          onClick={handleReset}
          disabled={loading}
          className="w-72 h-72 md:w-80 md:h-80 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-[0_30px_70px_rgba(225,29,72,0.35)] font-black uppercase tracking-[0.2em] text-sm md:text-base transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-4"
          title="Resetar o App"
        >
          <RotateCcw size={42} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Resetando...' : 'Resetar o App'}
        </button>

        <p className="text-center text-sm text-zinc-500 max-w-xl">
          Essa ação redefine o banco para padrão de fábrica e encerra todas as sessões ativas.
        </p>

        {error && <p className="text-rose-500 font-medium">{error}</p>}
      </div>
    </div>
  );
}
