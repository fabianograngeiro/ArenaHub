import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy, serverTimestamp } from '@/lib/dataApi';
import { db } from '@/lib/dataApi';
import { Product, Category, InventoryLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  X, 
  Save, 
  Edit2, 
  Trash2, 
  History,
  Tag,
  FileText,
  Calendar,
  Layers,
  Hash,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, isBefore, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'shop' | 'logs' | 'categories'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingAnother, setIsAddingAnother] = useState(false);

  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 5,
    categoryId: '',
    description: '',
    imageUrl: '',
    expiryDate: '',
    taxInvoiceInfo: { ncm: '', cfop: '', taxRate: 0 }
  });

  useEffect(() => {
    const pUnsub = onSnapshot(collection(db, 'products'), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const cUnsub = onSnapshot(collection(db, 'categories'), (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as Category))));
    const lUnsub = onSnapshot(query(collection(db, 'inventoryLogs'), orderBy('timestamp', 'desc')), (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog))));
    return () => { pUnsub(); cUnsub(); lUnsub(); };
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), { name: newCategoryName });
        setEditingCategory(null);
      } else {
        await addDoc(collection(db, 'categories'), {
          name: newCategoryName,
          type: 'product'
        });
      }
      setNewCategoryName('');
    } catch (error) { console.error(error); }
  };

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const nearExpiryProducts = products.filter(p => p.expiryDate && isBefore(parseISO(p.expiryDate), addDays(new Date(), 30)));

  const handleSaveProduct = async (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), formData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          stock: Number(formData.stock) || 0,
          price: Number(formData.price) || 0,
          cost: Number(formData.cost) || 0,
          createdAt: serverTimestamp()
        });
      }

      if (addAnother) {
        setFormData({
          name: '',
          sku: '',
          barcode: '',
          price: 0,
          cost: 0,
          stock: 0,
          minStock: 5,
          categoryId: formData.categoryId, // Keep category for consistency
          description: '',
          imageUrl: '',
          taxInvoiceInfo: { ncm: '', cfop: '', taxRate: 0 }
        });
        setEditingProduct(null);
      } else {
        setIsModalOpen(false);
        setEditingProduct(null);
      }
    } catch (error) { console.error(error); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        alert('Imagem muito grande! Máximo 1MB para produtos.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({...formData, imageUrl: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredProducts = products.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(searchLower) ||
      (p.sku?.toLowerCase().includes(searchLower)) ||
      (p.barcode?.toLowerCase().includes(searchLower)) ||
      (categories.find(c => c.id === p.categoryId)?.name.toLowerCase().includes(searchLower));

    if (activeTab === 'shop') {
      const shopCategoryIds = categories
        .filter(c => ['Loja', 'Vestuário', 'Equipamentos', 'Produtos da Loja'].some(name => c.name.includes(name)))
        .map(c => c.id);
      return matchesSearch && shopCategoryIds.includes(p.categoryId);
    }
    
    return matchesSearch;
  });

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter dark:text-white">Estoque & Produtos</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-serif italic text-sm md:text-base">Controle de inventário, notas fiscais e perdas.</p>
        </div>
        <div className="flex overflow-x-auto no-scrollbar bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 w-full xl:w-auto gap-1">
          {(['dashboard', 'products', 'shop', 'categories', 'logs'] as const).map(tab => (
            <button 
              key={tab} onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xl" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              )}
            >
              {tab === 'dashboard' ? 'Painel' : tab === 'products' ? 'Estoque Geral' : tab === 'shop' ? 'Produtos da Loja' : tab === 'categories' ? 'Categorias' : 'Histórico'}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'dashboard' && (
        <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {[
            { label: 'Total Itens', value: products.length, icon: Package, color: 'zinc' },
            { label: 'Estoque Baixo', value: lowStockProducts.length, icon: AlertTriangle, color: 'rose' },
            { label: 'Próximo Vencimento', value: nearExpiryProducts.length, icon: Calendar, color: 'orange' },
            { label: 'Valor em Estoque', value: `R$ ${products.reduce((acc, p) => acc + (p.stock * p.cost), 0).toLocaleString()}`, icon: ArrowUpRight, color: 'emerald' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
               <div className={cn("p-2 md:p-4 rounded-xl md:rounded-3xl w-fit mb-2 md:mb-4", `bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600`)}>
                 <stat.icon className="w-4 h-4 md:w-6 md:h-6" />
               </div>
               <p className="text-[7px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">{stat.label}</p>
               <h3 className="text-base md:text-2xl font-black mt-0.5 md:mt-1 dark:text-white truncate">{stat.value}</h3>
            </div>
          ))}
       </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-black mb-6 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" size={20} /> Alertas de Reposição
                </h3>
                <div className="space-y-4">
                  {lowStockProducts.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20">
                      <span className="font-bold text-rose-700 dark:text-rose-400">{p.name}</span>
                      <span className="text-xs font-black px-3 py-1 bg-rose-200 dark:bg-rose-900/40 rounded-full text-rose-700 dark:text-rose-300">
                        Apenas {p.stock} un.
                      </span>
                    </div>
                  ))}
                  {lowStockProducts.length === 0 && <p className="text-zinc-400 italic text-sm text-center py-8">Nenhum item com estoque baixo.</p>}
                </div>
             </div>
             
             <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-black mb-6 dark:text-white flex items-center gap-2">
                  <Calendar className="text-orange-500" size={20} /> Alertas de Vencimento
                </h3>
                <div className="space-y-4">
                  {nearExpiryProducts.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                      <span className="font-bold text-orange-700 dark:text-orange-400">{p.name}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                        {p.expiryDate ? format(parseISO(p.expiryDate), "dd/MM/yy") : 'N/A'}
                      </span>
                    </div>
                  ))}
                  {nearExpiryProducts.length === 0 && <p className="text-zinc-400 italic text-sm text-center py-8">Nenhum item vencendo em breve.</p>}
                </div>
             </div>
           </div>
        </div>
      )}

      {(activeTab === 'products' || activeTab === 'shop') && (
        <div className="space-y-6">
           <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, categoria, SKU ou NCM..."
                  className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-4 ring-zinc-500/10 dark:text-white"
                />
              </div>
              <button 
                onClick={() => { 
                  setEditingProduct(null); 
                  setFormData({ 
                    name: '', 
                    price: 0, 
                    cost: 0, 
                    stock: 0, 
                    minStock: 5, 
                    sku: '', 
                    barcode: '', 
                    description: '',
                    imageUrl: '',
                    expiryDate: '',
                    taxInvoiceInfo: { ncm: '', cfop: '', taxRate: 0 } 
                  }); 
                  setIsModalOpen(true); 
                }}
                className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-4 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
              >
                <Plus size={20} /> {activeTab === 'shop' ? 'Novo Produto de Loja' : 'Cadastrar Produto'}
              </button>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-[2rem] md:rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="overflow-x-auto no-scrollbar">
               <table className="w-full text-left min-w-[1000px] xl:min-w-0">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                    <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Produto</th>
                    <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">SKU / Cód. Barras</th>
                    <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Categoria</th>
                    <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Estoque</th>
                    <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Preços (Custo/Venda)</th>
                    <th className="p-3 md:p-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors group border-b border-zinc-100 dark:border-zinc-800">
                      <td className="p-3 md:p-6">
                        <div className="flex items-center gap-2 md:gap-4">
                           <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg md:rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-colors overflow-hidden">
                             {product.imageUrl ? (
                               <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <Package size={16} className="md:w-5 md:h-5" />
                             )}
                           </div>
                           <div>
                              <p className="font-bold text-[10px] md:text-base dark:text-white uppercase tracking-tight italic">{product.name}</p>
                              <p className="text-[8px] md:text-[10px] text-zinc-400 font-mono">NCM: {product.taxInvoiceInfo?.ncm || '---'}</p>
                           </div>
                        </div>
                      </td>
                      <td className="p-3 md:p-6">
                        <div className="space-y-1">
                          <p className="text-[10px] md:text-xs font-mono dark:text-zinc-300">SKU: {product.sku || '---'}</p>
                          <p className="text-[8px] md:text-[10px] font-mono text-zinc-500">{product.barcode || '---'}</p>
                        </div>
                      </td>
                      <td className="p-3 md:p-6">
                        <span className="px-2 md:px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          {categories.find(c => c.id === product.categoryId)?.name || 'Sem Categoria'}
                        </span>
                      </td>
                      <td className="p-3 md:p-6">
                        <p className={cn("font-mono font-black text-xs md:text-base", product.stock <= product.minStock ? "text-rose-500" : "text-emerald-500")}>
                          {product.stock} un
                        </p>
                        <p className="text-[8px] md:text-[10px] text-zinc-400 uppercase font-black tracking-widest whitespace-nowrap">Min: {product.minStock}</p>
                      </td>
                      <td className="p-3 md:p-6">
                        <p className="text-xs md:text-sm font-black dark:text-white">R$ {product.price}</p>
                        <p className="text-[8px] md:text-[10px] text-zinc-400 font-bold italic">Custo: R$ {product.cost}</p>
                      </td>
                      <td className="p-3 md:p-6 text-right">
                        <div className="flex gap-1 md:gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { 
                              setEditingProduct(product); 
                              setFormData({
                                ...product,
                                sku: product.sku || '',
                                barcode: product.barcode || '',
                                description: product.description || '',
                                imageUrl: product.imageUrl || '',
                                expiryDate: product.expiryDate || '',
                                taxInvoiceInfo: {
                                  ncm: product.taxInvoiceInfo?.ncm || '',
                                  cfop: product.taxInvoiceInfo?.cfop || '',
                                  taxRate: product.taxInvoiceInfo?.taxRate || 0
                                }
                              }); 
                              setIsModalOpen(true); 
                            }} 
                            className="p-1.5 md:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          >
                            <Edit2 size={12} className="md:w-4 md:h-4" />
                          </button>
                          <button onClick={() => deleteDoc(doc(db, 'products', product.id))} className="p-1.5 md:p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-rose-500">
                            <Trash2 size={12} className="md:w-4 md:h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-xl">
             <h3 className="text-xl font-black mb-6 dark:text-white flex items-center gap-2">
               <Layers className="text-zinc-400" size={20} /> {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
             </h3>
             <form onSubmit={handleCreateCategory} className="flex gap-4">
                <input 
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria (ex: Cervejas)"
                  className="flex-1 px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white"
                />
                <button type="submit" className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">
                  {editingCategory ? 'Salvar' : 'Criar'}
                </button>
                {editingCategory && (
                  <button type="button" onClick={() => { setEditingCategory(null); setNewCategoryName(''); }} className="px-4 text-zinc-400 hover:text-rose-500">
                    <X size={20} />
                  </button>
                )}
             </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {categories.filter(c => c.type === 'product').map(cat => {
               const catProducts = products.filter(p => p.categoryId === cat.id);
               const isExpanded = expandedCategory === cat.id;

               return (
                 <div key={cat.id} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden h-fit transition-all">
                    <div className="p-6 flex justify-between items-center group">
                      <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}>
                        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                          <Tag size={20} />
                        </div>
                        <div>
                          <span className="font-black text-lg dark:text-white uppercase tracking-tighter italic">{cat.name}</span>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mt-1">{catProducts.length} Produtos cadastrados</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!['Cervejas', 'Bebidas', 'Alimentos', 'Geral'].includes(cat.name) ? (
                          <>
                            <button onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => deleteDoc(doc(db, 'categories', cat.id))} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-rose-500">
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Sistema</span>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="px-6 pb-6 overflow-hidden"
                        >
                          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                            {catProducts.length > 0 ? catProducts.map(p => (
                              <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                 <div>
                                   <p className="text-sm font-bold dark:text-white">{p.name}</p>
                                   <p className="text-[10px] text-zinc-400 font-mono italic">SKU: {p.sku || '---'}</p>
                                 </div>
                                 <button 
                                  onClick={() => { 
                                    setEditingProduct(p); 
                                    setFormData({
                                      ...p,
                                      sku: p.sku || '',
                                      barcode: p.barcode || '',
                                      description: p.description || '',
                                      imageUrl: p.imageUrl || '',
                                      expiryDate: p.expiryDate || '',
                                      taxInvoiceInfo: {
                                        ncm: p.taxInvoiceInfo?.ncm || '',
                                        cfop: p.taxInvoiceInfo?.cfop || '',
                                        taxRate: p.taxInvoiceInfo?.taxRate || 0
                                      }
                                    }); 
                                    setIsModalOpen(true); 
                                  }} 
                                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-2"
                                 >
                                   <Edit2 size={14} />
                                 </button>
                              </div>
                            )) : (
                              <p className="text-center text-xs text-zinc-400 py-4 italic">Nenhum produto nesta categoria.</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
               );
             })}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
           <table className="w-full">
             <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Data & Hora</th>
                  <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Produto</th>
                  <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo</th>
                  <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantidade</th>
                  <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">NF/Ref</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {logs.map(log => {
                  const prod = products.find(p => p.id === log.productId);
                  return (
                    <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="p-6 text-sm font-medium dark:text-white">{format(parseISO(log.timestamp), "dd/MM HH:mm")}</td>
                      <td className="p-6 font-bold dark:text-white">{prod?.name || '---'}</td>
                      <td className="p-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          log.type === 'entry' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {log.type === 'entry' ? 'Entrada' : log.type === 'exit' ? 'Saída' : 'Perda/Estorno'}
                        </span>
                      </td>
                      <td className="p-6 font-mono font-bold dark:text-white">{log.quantity} un</td>
                      <td className="p-6 text-xs text-zinc-400 font-mono italic">{log.invoiceNumber || '---'}</td>
                    </tr>
                  );
                })}
             </tbody>
           </table>
        </div>
      )}

      {/* Product Modal with Fiscal Fields */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[3rem] p-10 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black dark:text-white tracking-tighter">{editingProduct ? 'Editar' : 'Novo'} Produto</h2>
                <button onClick={() => setIsModalOpen(false)} className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-2xl"><X size={24} /></button>
              </div>

              <form onSubmit={(e) => handleSaveProduct(e, false)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Informações Básicas</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                        <Tag size={12} className="text-zinc-300" /> Nome do Produto
                      </label>
                      <input 
                        required placeholder="Ex: Cerveja Skol" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border-none outline-none focus:ring-4 ring-zinc-500/10 dark:text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                        <Layers size={12} className="text-zinc-300" /> Categoria
                      </label>
                      <select 
                        required
                        value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none dark:text-white"
                      >
                        <option value="">Selecionar Categoria</option>
                        {categories.filter(c => c.type === 'product').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <Tag size={12} className="text-zinc-300" /> SKU
                        </label>
                        <input 
                          placeholder="CERV-SKOL" value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white outline-none focus:ring-4 ring-zinc-500/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <Hash size={12} className="text-zinc-300" /> Cód. Barras
                        </label>
                        <input 
                          placeholder="789..." value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white outline-none focus:ring-4 ring-zinc-500/10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <FileText size={12} className="text-zinc-300" /> Custo Unit. (R$)
                        </label>
                        <input 
                          type="number" step="0.01" placeholder="0.00" value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})}
                          className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <Package size={12} className="text-zinc-300" /> Preço Venda (R$)
                        </label>
                        <input 
                          type="number" step="0.01" placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                          className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                   <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Estoque & Fiscal (Opcional)</p>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                            <Plus size={12} className="text-zinc-300" /> Estoque Inicial
                          </label>
                          <input 
                            type="number" placeholder="0" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                            className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                            <AlertTriangle size={12} className="text-zinc-300" /> Estoque Mínimo
                          </label>
                          <input 
                            type="number" placeholder="5" value={formData.minStock} onChange={e => setFormData({...formData, minStock: Number(e.target.value)})}
                            className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white"
                          />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <Calendar size={12} className="text-zinc-300" /> Data de Vencimento
                        </label>
                        <input 
                          type="date" value={formData.expiryDate || ''} onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white hover:cursor-pointer"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <ImageIcon size={12} className="text-zinc-300" /> Imagem do Produto
                        </label>
                        <div className="flex gap-4 items-center">
                           <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                              {formData.imageUrl ? (
                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon size={20} className="text-zinc-300" />
                              )}
                           </div>
                           <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-transparent active:scale-95 group">
                              <Upload size={14} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">Upload</span>
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                           </label>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                          <FileText size={12} className="text-zinc-300" /> Descrição Curta (Site)
                        </label>
                        <textarea 
                          rows={3}
                          placeholder="Ex: Raquete profissional de carbono, leve e resistente..." 
                          value={formData.description || ''} 
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white outline-none focus:ring-4 ring-zinc-500/10 resize-none"
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                            <FileText size={12} className="text-zinc-300" /> NCM
                          </label>
                          <input 
                            placeholder="0000.00.00" value={formData.taxInvoiceInfo?.ncm || ''} onChange={e => setFormData({...formData, taxInvoiceInfo: {...formData.taxInvoiceInfo!, ncm: e.target.value}})}
                            className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                            <FileText size={12} className="text-zinc-300" /> CFOP
                          </label>
                          <input 
                            placeholder="0.000" value={formData.taxInvoiceInfo?.cfop || ''} onChange={e => setFormData({...formData, taxInvoiceInfo: {...formData.taxInvoiceInfo!, cfop: e.target.value}})}
                            className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl dark:text-white"
                          />
                        </div>
                     </div>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                   <button 
                    type="button"
                    onClick={(e) => handleSaveProduct(e as any, true)}
                    className="py-6 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                   >
                     <Plus size={20} /> Salvar e Adicionar Outro
                   </button>
                   <button 
                    type="submit"
                    className="py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-zinc-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >
                     <Save size={20} /> {editingProduct ? 'Salvar Alterações' : 'Concluir Cadastro'}
                   </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
