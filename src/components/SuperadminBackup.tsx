import { useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { clearToken, getBackup, restoreBackup } from '@/lib/authApi';

export function SuperadminBackup() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleDownload = async () => {
    setError('');
    setMessage('');
    try {
      const payload = await getBackup();
      const blob = new Blob([JSON.stringify(payload.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arenahub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Backup exportado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar backup.');
    }
  };

  const handleRestoreFile = async (file: File) => {
    setError('');
    setMessage('');
    setRestoring(true);
    try {
      const raw = await file.text();
      const backup = JSON.parse(raw);
      await restoreBackup(backup);
      clearToken();
      setMessage('Backup restaurado. Faça login novamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar backup.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight dark:text-white">Backup do Sistema</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Exporte ou restaure todo o banco JSON da aplicação.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
          <h2 className="font-black text-lg dark:text-white">Exportar backup</h2>
          <p className="text-sm text-zinc-500">Gera um arquivo JSON com todos os usuários e dados das coleções.</p>
          <button onClick={handleDownload} className="px-5 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold flex items-center gap-2">
            <Download size={18} /> Baixar backup
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
          <h2 className="font-black text-lg dark:text-white">Restaurar backup</h2>
          <p className="text-sm text-zinc-500">Substitui todo o banco atual. Após restaurar, será necessário fazer login novamente.</p>
          <label className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-100 text-amber-800 font-bold cursor-pointer">
            <Upload size={18} /> Selecionar arquivo
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestoreFile(file);
              }}
            />
          </label>
          {restoring && <p className="text-sm text-zinc-500 flex items-center gap-2"><RotateCcw size={16} className="animate-spin" /> Restaurando...</p>}
        </div>
      </div>

      {message && <p className="text-emerald-600 font-medium">{message}</p>}
      {error && <p className="text-rose-500 font-medium">{error}</p>}
    </div>
  );
}
