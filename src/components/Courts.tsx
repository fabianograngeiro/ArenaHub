import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from '@/lib/dataApi';
import { db, handleDataError, OperationType } from '@/lib/dataApi';
import { Court } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Save,
  Layers,
  DollarSign,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Courts = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sport: 'futebol',
    pricePerHour: 0
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'courts'), (snapshot) => {
      setCourts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court)));
    }, (error) => handleDataError(error, OperationType.LIST, 'courts'));
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourt) {
        await updateDoc(doc(db, 'courts', editingCourt.id), formData);
      } else {
        await addDoc(collection(db, 'courts'), { ...formData, arenaId: 'default' });
      }
      setIsModalOpen(false);
      setEditingCourt(null);
      setFormData({ name: '', sport: 'futebol', pricePerHour: 0 });
    } catch (error) {
      handleDataError(error, editingCourt ? OperationType.UPDATE : OperationType.CREATE, 'courts');
    }
  };

  const handleEdit = (court: Court) => {
    setEditingCourt(court);
    setFormData({ name: court.name, sport: court.sport, pricePerHour: court.pricePerHour });
    setIsModalOpen(true);
  };

  const filteredCourts = courts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black dark:text-white tracking-tighter mb-2 italic uppercase">Quadras</h1>
          <p className="text-zinc-400 font-serif italic text-base md:text-lg">Gerenciamento completo das suas arenas de jogo.</p>
        </div>
        <button 
          onClick={() => {
            setEditingCourt(null);
            setFormData({ name: '', sport: 'futebol', pricePerHour: 0 });
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto group relative px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-3">
            <Plus size={20} strokeWidth={3} /> Nova Quadra
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <div className="relative group max-w-2xl">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors">
          <Search size={20} />
        </div>
        <input 
          type="text" 
          placeholder="Buscar quadra pelo nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-16 pr-8 py-6 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] shadow-sm outline-none focus:ring-4 ring-zinc-500/5 dark:text-zinc-100 transition-all font-medium text-lg placeholder:text-zinc-300 italic"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredCourts.map((court) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={court.id}
              className="group relative bg-white dark:bg-zinc-900 rounded-[3rem] p-8 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-2xl transition-all"
            >
              <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(court)} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => deleteDoc(doc(db, 'courts', court.id))} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-rose-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="mb-8">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-400 mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-900 transition-all duration-500">
                  <Layers size={32} />
                </div>
                <h3 className="text-2xl font-black dark:text-white tracking-tight uppercase italic">{court.name}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-1">{court.sport}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-3xl">
                  <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <DollarSign size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Preço/Hora</span>
                  </div>
                  <p className="font-mono font-black dark:text-white text-xl text-blue-600">R$ {court.pricePerHour}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-3xl">
                  <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <Clock size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Status</span>
                  </div>
                  <p className="font-black dark:text-white text-[10px] uppercase tracking-widest text-green-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-green-500 rounded-full" /> Disponível
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl p-10 border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black dark:text-white italic uppercase tracking-tighter">
                  {editingCourt ? 'Editar Quadra' : 'Nova Quadra'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">Nome da Quadra</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-8 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-3xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-bold transition-all"
                      placeholder="Ex: Quadra Central"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">Esporte/Tipo</label>
                      <select 
                        value={formData.sport}
                        onChange={(e) => setFormData({...formData, sport: e.target.value})}
                        className="w-full px-8 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-3xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-bold transition-all appearance-none"
                      >
                        <option value="futebol">Futebol</option>
                        <option value="tenis">Tênis</option>
                        <option value="volei">Vôlei</option>
                        <option value="beach">Beach Tennis</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">Preço por Hora (R$)</label>
                      <input 
                        required
                        type="number" 
                        value={formData.pricePerHour}
                        onChange={(e) => setFormData({...formData, pricePerHour: parseInt(e.target.value)})}
                        className="w-full px-8 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-3xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-mono font-bold transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-zinc-500/10"
                >
                  <Save size={20} /> Salvar Configurações
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
