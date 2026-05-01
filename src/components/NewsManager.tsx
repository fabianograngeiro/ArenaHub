import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Calendar, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Image as ImageIcon,
  ChevronRight,
  Clock,
  Tag,
  Trophy,
  Star,
  Users
} from 'lucide-react';
import { db, handleDataError, OperationType } from '@/lib/dataApi';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from '@/lib/dataApi';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  category: 'noticia' | 'evento' | 'torneio';
  imageUrl?: string;
  status: 'published' | 'draft';
}

export const NewsManager = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState<Partial<NewsItem>>({
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0],
    category: 'noticia',
    status: 'published',
    imageUrl: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem)));
      setLoading(false);
    }, (err) => {
      handleDataError(err, OperationType.LIST, 'news');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'news', editingItem.id), formData);
      } else {
        await addDoc(collection(db, 'news'), formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ title: '', content: '', date: new Date().toISOString().split('T')[0], category: 'noticia', status: 'published', imageUrl: '' });
    } catch (err) {
      handleDataError(err, OperationType.WRITE, 'news');
    }
  };

  const filteredItems = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return null;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter dark:text-white uppercase italic">Notícias & Eventos</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium italic serif">Gerencie o mural de avisos e torneios da sua arena.</p>
        </div>
        <button 
          onClick={() => { setEditingItem(null); setFormData({ title: '', content: '', date: new Date().toISOString().split('T')[0], category: 'noticia', status: 'published', imageUrl: '' }); setIsModalOpen(true); }}
          className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center gap-3 shadow-2xl hover:scale-105 transition-all outline-none"
        >
          <Plus size={20} /> Nova Publicação
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar notícias ou eventos..."
          className="w-full pl-16 pr-8 py-5 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredItems.map(item => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-2xl transition-all overflow-hidden flex flex-col h-full"
          >
            <div className="aspect-[16/9] bg-zinc-50 dark:bg-zinc-800 relative">
               {item.imageUrl ? (
                 <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <Megaphone size={48} />
                 </div>
               )}
               <div className="absolute top-6 left-6">
                 <span className={cn(
                   "px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg",
                   item.category === 'evento' ? "bg-emerald-500 text-white" : 
                   item.category === 'torneio' ? "bg-blue-600 text-white" : "bg-zinc-900 text-white"
                 )}>
                   {item.category}
                 </span>
               </div>
            </div>

            <div className="p-8 space-y-4 flex-1">
               <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">
                 <Calendar size={14} /> {format(new Date(item.date), 'dd MMMM, yyyy')}
               </div>
               <h3 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white leading-none line-clamp-2">{item.title}</h3>
               <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium line-clamp-3 leading-relaxed">{item.content}</p>
            </div>

            <div className="p-8 pt-0 flex justify-between items-center bg-zinc-50/50 dark:bg-white/5 mt-auto">
               <span className={cn("text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full", item.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600")}>
                 {item.status === 'published' ? 'Publicado' : 'Rascunho'}
               </span>
               <div className="flex gap-2">
                 <button 
                  onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }}
                  className="p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                 >
                   <Edit2 size={16} />
                 </button>
                 <button 
                  onClick={() => deleteDoc(doc(db, 'news', item.id))}
                  className="p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
            </div>
          </motion.div>
        ))}
        
        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4 opacity-40">
             <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Megaphone size={32} />
             </div>
             <p className="text-xs font-black uppercase tracking-widest">Nenhuma publicação encontrada.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-zinc-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
               <div className="flex justify-between items-center mb-10">
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter dark:text-white">{editingItem ? 'Editar' : 'Nova'} Publicação</h2>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl hover:rotate-90 transition-transform"><X size={24} /></button>
               </div>

               <form onSubmit={handleSave} className="space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Título da Notícia/Evento</label>
                       <input 
                         required
                         value={formData.title} 
                         onChange={e => setFormData({...formData, title: e.target.value})}
                         className="w-full px-8 py-5 bg-zinc-50 dark:bg-zinc-800 rounded-3xl outline-none border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 dark:text-white font-bold"
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Categoria</label>
                          <select 
                             value={formData.category}
                             onChange={e => setFormData({...formData, category: e.target.value as any})}
                             className="w-full px-8 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-3xl outline-none dark:text-white font-bold"
                          >
                             <option value="noticia">Publicação (Blog)</option>
                             <option value="evento">Evento Social</option>
                             <option value="torneio">Torneio Oficial</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Data do Evento</label>
                          <input 
                             type="date"
                             value={formData.date}
                             onChange={e => setFormData({...formData, date: e.target.value})}
                             className="w-full px-8 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-3xl outline-none dark:text-white font-bold"
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">URL da Imagem Capa</label>
                       <div className="relative">
                          <ImageIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input 
                             placeholder="https://images.unsplash.com/..."
                             value={formData.imageUrl}
                             onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                             className="w-full pl-16 pr-8 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-3xl outline-none dark:text-white font-medium"
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Conteúdo da Publicação</label>
                       <textarea 
                         rows={6}
                         value={formData.content}
                         onChange={e => setFormData({...formData, content: e.target.value})}
                         className="w-full px-8 py-6 bg-zinc-50 dark:bg-zinc-800 rounded-3xl outline-none dark:text-white font-medium resize-none"
                         placeholder="Escreva aqui os detalhes da notícia ou evento..."
                       />
                    </div>

                    <div className="flex items-center gap-3 ml-2">
                       <input 
                         type="checkbox" 
                         id="status"
                         checked={formData.status === 'published'} 
                         onChange={e => setFormData({...formData, status: e.target.checked ? 'published' : 'draft'})}
                         className="w-5 h-5 rounded-lg border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                       />
                       <label htmlFor="status" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Publicar Imediatamente</label>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Save size={24} /> {editingItem ? 'Salvar Alterações' : 'Publicar Agora'}
                  </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
