import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from '@/lib/dataApi';
import { db } from '@/lib/dataApi';
import { Client } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, User, Phone, Mail, Trash2, Edit2, X, Save } from 'lucide-react';
import { cn, formatPhone } from '../lib/utils';

export const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), {
          ...formData,
        });
      } else {
        await addDoc(collection(db, 'clients'), {
          ...formData,
          createdAt: new Date().toISOString(),
          totalBookings: 0,
          totalSpent: 0,
          balance: 0,
        });
      }
      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '' });
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Erro ao salvar cliente');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-0 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 italic font-serif text-sm md:text-base">Gerencie sua base de clientes e histórico de agendamentos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente..." 
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 ring-zinc-500/20 transition-all dark:text-white"
            />
          </div>
          <button 
            onClick={() => {
              setEditingClient(null);
              setFormData({ name: '', phone: '', email: '' });
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
          >
            <Plus size={20} /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Cliente</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Contato</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Agendamentos</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Total Gastos</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Saldo</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredClients.map((client) => (
                <tr key={client.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-900 transition-colors">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-bold dark:text-white">{client.name}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-none mt-1">Desde {new Date(client.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <p className="text-xs dark:text-zinc-300 flex items-center gap-2"><Phone size={12} className="text-zinc-400"/> {formatPhone(client.phone)}</p>
                      {client.email && <p className="text-[10px] text-zinc-500 flex items-center gap-2"><Mail size={12} className="text-zinc-400"/> {client.email}</p>}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                      {client.totalBookings || 0}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className="font-mono font-black text-sm text-zinc-900 dark:text-white">
                      R$ {(client.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className={cn(
                      "font-mono font-black text-sm",
                      (client.balance || 0) < 0 ? "text-rose-500" : (client.balance || 0) > 0 ? "text-emerald-500" : "text-zinc-400"
                    )}>
                      R$ {(client.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEdit(client)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-500 transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-xl text-rose-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredClients.length === 0 && (
            <div className="p-20 text-center opacity-50 flex flex-col items-center gap-4">
              <Search size={48} strokeWidth={1} />
              <p className="font-serif italic text-lg">Nenhum cliente encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/5 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold dark:text-white">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Nome Completo</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl outline-none focus:ring-2 ring-zinc-500/20 dark:text-white"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Telefone (WhatsApp)</label>
                <input 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl outline-none focus:ring-2 ring-zinc-500/20 dark:text-white"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">E-mail (Opcional)</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl outline-none focus:ring-2 ring-zinc-500/20 dark:text-white"
                  placeholder="cliente@email.com"
                />
              </div>
              <button className="w-full py-4 mt-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95">
                <Save size={20} />
                {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
