import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Palette, 
  Layout, 
  Eye, 
  Save, 
  Plus, 
  Trash2, 
  Settings, 
  Image as ImageIcon,
  Type,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Monitor,
  Smartphone,
  Check,
  ChevronDown,
  Layers,
  Upload
} from 'lucide-react';
import { SiteConfig, Settings as AppSettings, Product } from '../types';
import { doc, getDoc, setDoc, collection, onSnapshot } from '@/lib/dataApi';
import { db, handleDataError, OperationType } from '@/lib/dataApi';
import { cn } from '../lib/utils';

const PALETTES = [
  {
    name: 'Arena Dark (Padrão)',
    primary: '#000000',
    secondary: '#10b981',
    accent: '#3b82f6',
    background: '#ffffff',
    text: '#000000',
  },
  {
    name: 'Ocean Blue',
    primary: '#1e3a8a',
    secondary: '#38bdf8',
    accent: '#f472b6',
    background: '#f8fafc',
    text: '#0f172a',
  },
  {
    name: 'Sunset Sport',
    primary: '#9a3412',
    secondary: '#fb923c',
    accent: '#facc15',
    background: '#fff7ed',
    text: '#431407',
  },
  {
    name: 'Forest Green',
    primary: '#064e3b',
    secondary: '#34d399',
    accent: '#fbbf24',
    background: '#f0fdf4',
    text: '#022c22',
  },
  {
    name: 'Cyberpunk',
    primary: '#ec4899',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    background: '#0f172a',
    text: '#f8fafc',
  }
];

export const WebsiteEditor = () => {
  const [config, setConfig] = useState<SiteConfig>({
    id: 'default',
    name: 'Minha Arena',
    palette: PALETTES[0],
    hero: {
      title: 'A Melhor Experiência Esportiva',
      description: 'Reserve sua quadra agora e venha viver o esporte no mais alto nível.',
      ctaText: 'Agendar Agora',
      backgroundImage: 'https://images.unsplash.com/photo-1541252260730-0412e3e2108e?auto=format&fit=crop&q=80',
      overlayOpacity: 50,
    },
    sections: {
      about: { enabled: true, title: 'Sobre Nós', description: 'Nossa História', content: 'Somos um complexo esportivo dedicado à excelência.', ctaText: 'Saiba Mais' },
      events: { enabled: true, title: 'Torneios & Eventos', description: 'Competição de alto nível', ctaText: 'Ver Todos' },
      booking: { enabled: true, title: 'Reserva Online', description: 'Rápido e Prático', ctaText: 'Reservar Agora' },
      ecommerce: { enabled: true, title: 'Loja & Produtos', description: 'Equipamentos Premium', ctaText: 'Ver Loja' },
      blog: { enabled: true, title: 'Notícias', description: 'Fique por dentro', ctaText: 'Ler Tudo' },
    },
    contact: {
      address: 'Rua do Esporte, 123',
      phone: '(11) 99999-9999',
      email: 'contato@arena.com',
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleHeroFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Imagem muito grande! Máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig({...config, hero: {...config.hero, backgroundImage: reader.result as string}});
      };
      reader.readAsDataURL(file);
    }
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'design' | 'sections' | 'contact'>('general');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    // 1. Fetch Config
    const fetchConfig = async () => {
      try {
        const siteDocRef = doc(db, 'site_config', 'default');
        const siteSnap = await getDoc(siteDocRef);
        
        const settingsDocRef = doc(db, 'settings', 'config');
        const settingsSnap = await getDoc(settingsDocRef);
        const appSettings = settingsSnap.exists() ? settingsSnap.data() as AppSettings : null;

        if (siteSnap.exists()) {
          setConfig(prev => ({
            ...prev,
            ...siteSnap.data() as SiteConfig,
            name: (siteSnap.data().name === 'Minha Arena' && appSettings?.companyName) ? appSettings.companyName : siteSnap.data().name
          }));
        } else if (appSettings?.companyName) {
          setConfig(prev => ({ ...prev, name: appSettings.companyName }));
        }
      } catch (err) {
        handleDataError(err, OperationType.GET, 'multiple');
      } finally {
        setLoading(false);
      }
    };

    // 2. Fetch Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    fetchConfig();
    return () => unsubProducts();
  }, []);

  const toggleProduct = (productId: string) => {
    const current = config.sections.ecommerce.featuredProductIds || [];
    const updated = current.includes(productId) 
      ? current.filter(id => id !== productId)
      : [...current, productId];
    
    setConfig({
      ...config,
      sections: {
        ...config.sections,
        ecommerce: { ...config.sections.ecommerce, featuredProductIds: updated }
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'site_config', 'default'), config);
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      handleDataError(err, OperationType.WRITE, 'site_config/default');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] dark:bg-black overflow-hidden font-sans">
      {/* Top Header */}
      <header className="shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-8 py-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-zinc-900">
            <Globe size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter dark:text-white leading-none">Editor do Site</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Personalize sua vitrine digital</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl flex gap-1">
            <button 
              onClick={() => setViewMode('desktop')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'desktop' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-400")}
            >
              <Monitor size={16} />
            </button>
            <button 
              onClick={() => setViewMode('mobile')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'mobile' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-400")}
            >
              <Smartphone size={16} />
            </button>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-zinc-500/20 disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
            Salvar Alterações
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-96 shrink-0 bg-white dark:bg-zinc-950 border-r border-zinc-100 dark:border-zinc-900 overflow-y-auto no-scrollbar">
          <div className="p-6 space-y-8">
            {/* Navigation Tabs */}
            <nav className="flex flex-col gap-1">
              {[
                { id: 'general', label: 'Geral & Identidade', icon: Settings },
                { id: 'design', label: 'Paleta & Estilo', icon: Palette },
                { id: 'sections', label: 'Módulos da Página', icon: Layout },
                { id: 'contact', label: 'Contato & Canais', icon: Phone },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group text-left",
                    activeTab === tab.id 
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg" 
                      : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  <tab.icon size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="pt-6 border-t border-zinc-50 dark:border-zinc-900">
              {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Nome da Arena</label>
                    <input 
                      value={config.name || ''}
                      onChange={e => setConfig({...config, name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Hero: Título Principal</label>
                    <input 
                      value={config.hero.title || ''}
                      onChange={e => setConfig({...config, hero: {...config.hero, title: e.target.value}})}
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Hero: Descrição</label>
                    <textarea 
                      rows={3}
                      value={config.hero.description || ''}
                      onChange={e => setConfig({...config, hero: {...config.hero, description: e.target.value}})}
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Imagem de Fundo (Hero)</label>
                    <div className="flex gap-3 items-center">
                       <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                          {config.hero.backgroundImage ? (
                            <img src={config.hero.backgroundImage} alt="Hero" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={16} className="text-zinc-300" />
                          )}
                       </div>
                       <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent active:scale-95 group">
                          <Upload size={14} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">Upload</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleHeroFileChange} />
                       </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[9px] font-black uppercase text-zinc-400">Opacidade do Overlay</label>
                      <span className="text-[10px] font-mono font-bold dark:text-white">{config.hero.overlayOpacity ?? 40}%</span>
                    </div>
                    <div className="relative flex items-center gap-3 px-2">
                      <Layers size={14} className="text-zinc-400" />
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={config.hero.overlayOpacity ?? 40}
                        onChange={e => setConfig({...config, hero: {...config.hero, overlayOpacity: parseInt(e.target.value)}})}
                        className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'design' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Paletas Predefinidas</label>
                    <div className="grid grid-cols-1 gap-2">
                       {PALETTES.map(p => (
                         <button
                           key={p.name}
                           onClick={() => setConfig({...config, palette: p})}
                           className={cn(
                             "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group",
                             config.palette.name === p.name ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300"
                           )}
                         >
                            <span className="text-[10px] font-black uppercase tracking-widest">{p.name}</span>
                            <div className="flex gap-3">
                               <div className="flex flex-col items-center gap-1">
                                 <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: p.primary }} />
                                 <span className="text-[6px] font-black uppercase text-zinc-400">Título</span>
                               </div>
                               <div className="flex flex-col items-center gap-1">
                                 <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: p.secondary }} />
                                 <span className="text-[6px] font-black uppercase text-zinc-400">Destaque</span>
                               </div>
                               <div className="flex flex-col items-center gap-1">
                                 <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: p.accent }} />
                                 <span className="text-[6px] font-black uppercase text-zinc-400">Ação</span>
                               </div>
                            </div>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900 space-y-6">
                    <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Customização Manual</label>
                    <div className="grid grid-cols-1 gap-4">
                      {Object.entries(config.palette).filter(([k]) => k !== 'name').map(([key, value]) => {
                        const labels: Record<string, string> = {
                          primary: 'Títulos e Principais',
                          secondary: 'Destaques e Detalhes',
                          accent: 'Elementos de Ação',
                          background: 'Fundo do Site',
                          text: 'Texto Principal e Rodapé'
                        };
                        
                        return (
                          <div key={key} className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">
                              {labels[key] || key}
                            </label>
                            <div className="flex gap-2">
                              <div className="relative">
                                <input 
                                  type="color"
                                  value={value}
                                  onChange={e => setConfig({
                                    ...config, 
                                    palette: { ...config.palette, name: 'Personalizada', [key]: e.target.value }
                                  })}
                                  className="w-10 h-10 rounded-xl cursor-pointer border-none p-0 bg-transparent overflow-hidden"
                                />
                              </div>
                              <input 
                                value={value}
                                onChange={e => setConfig({
                                  ...config, 
                                  palette: { ...config.palette, name: 'Personalizada', [key]: e.target.value }
                                })}
                                className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent outline-none text-[10px] font-mono font-bold dark:text-white"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sections' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                  {(Object.entries(config.sections) as [string, any][]).map(([id, section]) => (
                    <div key={id} className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase italic dark:text-white">{section.title}</span>
                          </div>
                          <button 
                            onClick={() => setConfig({
                              ...config,
                              sections: {
                                ...config.sections,
                                [id]: { ...section, enabled: !section.enabled }
                              }
                            })}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative",
                              section.enabled ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
                            )}
                          >
                             <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", section.enabled ? "right-1" : "left-1")} />
                          </button>
                       </div>
                       {section.enabled && (
                         <div className="space-y-3 pt-2">
                           <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-zinc-400">Título</label>
                             <input 
                               value={section.title || ''}
                               onChange={e => setConfig({
                               ...config,
                               sections: {
                                 ...config.sections,
                                 [id]: { ...section, title: e.target.value }
                               }
                             })}
                             className="w-full px-3 py-2 bg-white dark:bg-zinc-800 rounded-xl outline-none text-[10px] font-bold dark:text-white border border-zinc-100 dark:border-zinc-700"
                           />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-zinc-400">Subtítulo / Descrição</label>
                             <input 
                               value={section.description || ''}
                               onChange={e => setConfig({
                               ...config,
                               sections: {
                                 ...config.sections,
                                 [id]: { ...section, description: e.target.value }
                               }
                             })}
                             className="w-full px-3 py-2 bg-white dark:bg-zinc-800 rounded-xl outline-none text-[10px] font-bold dark:text-zinc-400 border border-zinc-100 dark:border-zinc-700"
                           />
                           </div>
                           {id === 'about' && (
                             <div className="space-y-1">
                               <label className="text-[8px] font-black uppercase text-zinc-400">Conteúdo Principal</label>
                               <textarea 
                                 rows={4}
                                 value={section.content || ''}
                                 onChange={e => setConfig({
                                   ...config,
                                   sections: {
                                     ...config.sections,
                                     [id]: { ...section, content: e.target.value }
                                   }
                                 })}
                                 className="w-full px-3 py-2 bg-white dark:bg-zinc-800 rounded-xl outline-none text-[10px] font-bold dark:text-white border border-zinc-100 dark:border-zinc-700 resize-none"
                               />
                             </div>
                           )}
                           <div className="space-y-1">
                             <label className="text-[8px] font-black uppercase text-zinc-400">Botão (CTA)</label>
                             <input 
                               value={section.ctaText || ''}
                               onChange={e => setConfig({
                               ...config,
                               sections: {
                                 ...config.sections,
                                 [id]: { ...section, ctaText: e.target.value }
                               }
                             })}
                             className="w-full px-3 py-2 bg-white dark:bg-zinc-800 rounded-xl outline-none text-[10px] font-black uppercase tracking-widest dark:text-white border border-zinc-100 dark:border-zinc-700"
                           />
                           </div>

                           {id === 'ecommerce' && (
                              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                 <label className="text-[8px] font-black uppercase text-zinc-400 flex justify-between items-center group">
                                   <span>Selecione Produtos da Loja</span>
                                    <span className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-2 py-0.5 rounded-full text-[6px]">
                                      {(config.sections.ecommerce.featuredProductIds || []).length} Selecionados
                                    </span>
                                 </label>
                                 <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto no-scrollbar pt-2 pr-1">
                                    {products.map(p => {
                                      const isSelected = (config.sections.ecommerce.featuredProductIds || []).includes(p.id);
                                      return (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => toggleProduct(p.id)}
                                          className={cn(
                                            "aspect-square rounded-xl border-2 transition-all p-0.5 flex items-center justify-center overflow-hidden relative group",
                                            isSelected ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300"
                                          )}
                                        >
                                          {p.imageUrl ? (
                                            <img src={p.imageUrl} className="w-full h-full object-cover rounded-lg" alt={p.name} referrerPolicy="no-referrer" />
                                          ) : (
                                            <div className="flex flex-col items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                               <Layout size={10} />
                                               <span className="text-[5px] font-black uppercase tracking-tighter truncate w-14 text-center">{p.name}</span>
                                            </div>
                                          )}
                                          {isSelected && (
                                            <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                                              <Check size={8} />
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                 </div>
                              </div>
                            )}
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'contact' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Endereço Completo</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input 
                        value={config.contact.address || ''}
                        onChange={e => setConfig({...config, contact: {...config.contact, address: e.target.value}})}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">WhatsApp / Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input 
                        value={config.contact.phone || ''}
                        onChange={e => setConfig({...config, contact: {...config.contact, phone: e.target.value}})}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">E-mail de Contato</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input 
                        value={config.contact.email || ''}
                        onChange={e => setConfig({...config, contact: {...config.contact, email: e.target.value}})}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Instagram (@usuario)</label>
                    <div className="relative">
                      <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input 
                        value={config.contact.instagram || ''}
                        onChange={e => setConfig({...config, contact: {...config.contact, instagram: e.target.value}})}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Facebook (URL ou Nome)</label>
                    <div className="relative">
                      <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input 
                        value={config.contact.facebook || ''}
                        onChange={e => setConfig({...config, contact: {...config.contact, facebook: e.target.value}})}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 outline-none text-[11px] font-bold dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 p-4 md:p-8 flex items-center justify-center overflow-hidden">
          <div className={cn(
            "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all duration-500 shadow-2xl relative overflow-hidden",
            viewMode === 'desktop' ? "w-full h-full rounded-2xl" : "w-[375px] h-[667px] rounded-[3rem]"
          )}>
            <div className="h-full w-full overflow-y-auto flex flex-col" style={{ color: config.palette.text, backgroundColor: config.palette.background }}>
              {/* Header Preview */}
              <nav className="p-6 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10 border-b border-zinc-100 dark:border-zinc-800">
                <span className="font-black italic uppercase tracking-tighter text-xl" style={{ color: config.palette.primary }}>{config.name}</span>
                <button className="px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl shadow-zinc-500/10" style={{ backgroundColor: config.palette.primary, color: '#fff' }}>
                  {config.hero.ctaText}
                </button>
              </nav>

              {/* Hero Preview */}
              <div className="px-8 py-20 flex flex-col items-center text-center gap-6">
                <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic leading-none" style={{ color: config.palette.primary }}>{config.hero.title}</h2>
                <p className="max-w-lg opacity-70 text-sm font-medium leading-relaxed">{config.hero.description}</p>
                <button className="mt-4 px-10 py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-105" style={{ backgroundColor: config.palette.primary, color: '#fff' }}>
                  {config.hero.ctaText}
                </button>
              </div>

              {/* Sections Preview List */}
              <div className="p-8 space-y-24">
                {(Object.entries(config.sections) as [string, any][]).filter(([_, s]) => s.enabled).map(([id, section]) => (
                  <div key={id} className="space-y-6">
                     <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 ml-1">{section.description}</span>
                        <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter border-l-8 pl-6 leading-none" style={{ borderColor: config.palette.secondary, color: config.palette.primary }}>{section.title}</h3>
                     </div>
                     <div className="aspect-video bg-zinc-50 dark:bg-zinc-800 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center flex-col gap-4">
                        <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-700 rounded-2xl flex items-center justify-center">
                           <Layout size={24} className="text-zinc-400" />
                        </div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Módulo: {id}</p>
                        {section.ctaText && (
                          <button className="px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest mt-2" style={{ backgroundColor: config.palette.secondary, color: '#fff' }}>
                            {section.ctaText}
                          </button>
                        )}
                     </div>
                  </div>
                ))}
              </div>

              {/* Footer Preview */}
              <footer className="mt-auto p-12 bg-zinc-900 text-white flex flex-col gap-8" style={{ backgroundColor: config.palette.text, color: config.palette.background }}>
                 <div className="flex flex-col md:flex-row justify-between gap-10">
                    <div className="space-y-4">
                      <h4 className="font-black text-3xl uppercase italic tracking-tighter">{config.name}</h4>
                      <div className="space-y-2">
                        <p className="opacity-70 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                          <MapPin size={14} /> {config.contact.address}
                        </p>
                        <p className="opacity-70 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                          <Phone size={14} /> {config.contact.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                       {[Instagram, Facebook, Mail].map((Icon, i) => (
                         <div key={i} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                            <Icon size={20} />
                         </div>
                       ))}
                    </div>
                 </div>
                 <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[8px] opacity-30 font-bold uppercase tracking-[0.4em]">© 2026 {config.name}. Todos os direitos reservados.</p>
                    <p className="text-[8px] opacity-30 font-bold uppercase tracking-[0.4em]">Powered by Arena OS</p>
                 </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
