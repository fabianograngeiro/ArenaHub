import { FormEvent, useEffect, useState } from 'react';
import { AppUser, createUser, deleteUser, listUsers } from '@/lib/authApi';
import { Plus, Shield, Trash2, Users } from 'lucide-react';

export function SuperadminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' as 'admin' | 'superadmin' });

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await listUsers();
      setUsers(payload.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createUser(form);
      setForm({ name: '', email: '', password: '', role: 'admin' });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar usuário.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este usuário?')) return;
    try {
      await deleteUser(id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir usuário.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight dark:text-white flex items-center gap-3">
          <Users className="w-7 h-7" /> Gestão de Usuários
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Crie e administre usuários do sistema.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleCreate} className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
          <h2 className="font-black text-lg dark:text-white">Novo usuário</h2>
          <input
            required
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
          />
          <input
            type="password"
            required
            placeholder="Senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'superadmin' })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 dark:text-white"
          >
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <button className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold flex items-center justify-center gap-2">
            <Plus size={18} /> Criar usuário
          </button>
          {error && <p className="text-rose-500 text-sm">{error}</p>}
        </form>

        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-zinc-500">Carregando usuários...</div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="text-left px-6 py-4 text-xs uppercase tracking-widest text-zinc-500">Nome</th>
                  <th className="text-left px-6 py-4 text-xs uppercase tracking-widest text-zinc-500">Email</th>
                  <th className="text-left px-6 py-4 text-xs uppercase tracking-widest text-zinc-500">Perfil</th>
                  <th className="text-right px-6 py-4 text-xs uppercase tracking-widest text-zinc-500">Ação</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-6 py-4 font-semibold dark:text-white">{user.name}</td>
                    <td className="px-6 py-4 text-zinc-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 dark:text-white">
                        <Shield size={14} /> {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(user.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
