import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, setDoc, doc, deleteDoc, query, where, getDocs } from '@/lib/dataApi';
import { db } from '@/lib/dataApi';
import { Settings, Court, PaymentMethod } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  FileText, 
  Printer, 
  Plus, 
  Save, 
  Trash2, 
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Hash,
  Wallet,
  CheckCircle2,
  Circle,
  Upload,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

export const SettingsPanel = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [activeTab, setActiveTab] = useState<'business' | 'courts' | 'fiscal' | 'printers' | 'payments' | 'hours'>('business');

  const DAYS_OF_WEEK = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  useEffect(() => {
    const sUnsub = onSnapshot(doc(db, 'settings', 'config'), (d) => {
      if (d.exists()) {
        const data = d.data() as Settings;
        // Initialize business hours if missing
        if (!data.businessHours) {
          data.businessHours = {};
          DAYS_OF_WEEK.forEach((_, index) => {
            data.businessHours![index.toString()] = { open: '08:00', close: '22:00', isOpen: true };
          });
        }
        setSettings(data);
      } else {
        const initialSettings: Settings = {
          companyName: 'Arena SportHub',
          cnpj: '',
          address: '',
          logo: '',
          googleMapsUrl: '',
          googleRating: 4.9,
          businessHours: {}
        };
        DAYS_OF_WEEK.forEach((_, index) => {
          initialSettings.businessHours![index.toString()] = { open: '08:00', close: '22:00', isOpen: true };
        });
        setSettings(initialSettings);
      }
    });
    const cUnsub = onSnapshot(collection(db, 'courts'), (s) => setCourts(s.docs.map(d => ({ id: d.id, ...d.data() } as Court))));
    const pUnsub = onSnapshot(collection(db, 'paymentMethods'), (s) => {
      const methods = s.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      setPaymentMethods(methods);
      
      // Initialize system methods if empty
      if (methods.length === 0) {
        initPaymentMethods();
      }
    });

    return () => { sUnsub(); cUnsub(); pUnsub(); };
  }, []);

  const initPaymentMethods = async () => {
    const systemMethods: Omit<PaymentMethod, 'id'>[] = [
      { name: 'Dinheiro', type: 'cash', isActive: true },
      { name: 'PIX', type: 'pix', isActive: true },
      { name: 'Cartão de Débito', type: 'card_debit', isActive: true },
      { name: 'Cartão de Crédito', type: 'card_credit', isActive: true },
      { name: 'Conta-corrente', type: 'account', isActive: true, isSystem: true },
    ];
    for (const m of systemMethods) {
      await addDoc(collection(db, 'paymentMethods'), m);
    }
  };

  const handleTogglePaymentMethod = async (method: PaymentMethod) => {
    await updateDoc(doc(db, 'paymentMethods', method.id), {
      isActive: !method.isActive
    });
  };

  const handleAddPaymentMethod = async () => {
    const name = prompt('Nome da Forma de Pagamento:');
    if (!name) return;
    await addDoc(collection(db, 'paymentMethods'), {
      name,
      type: 'other',
      isActive: true
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        alert('Imagem muito grande para o banco de dados! Máximo 800KB. Reduza as dimensões da imagem ou use um formato mais leve como WEBP.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (base64String.length > 1000000) {
           alert('O arquivo processado é muito grande. Tente uma imagem com menos de 800KB.');
           return;
        }
        setSettings({...settings!, logo: base64String});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await setDoc(doc(db, 'settings', 'config'), settings);
      alert('Configurações salvas!');
    } catch (error) { console.error(error); }
  };

  const handleAddCourt = async () => {
    const name = prompt('Nome da Quadra:');
    const sport = prompt('Esporte:');
    const price = Number(prompt('Preço por Hora (R$):'));
    if (!name || !sport || !price) return;
    
    await addDoc(collection(db, 'courts'), {
      arenaId: 'default', // Single arena context for now
      name,
      sport,
      pricePerHour: price
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-12">
      <header>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter dark:text-white">Configurações</h1>
        <p className="text-zinc-500 dark:text-zinc-400 font-serif italic text-sm md:text-base">Personalize sua arena, dados fiscais e periféricos.</p>
      </header>

      <div className="flex flex-col xl:flex-row gap-8">
        <aside className="xl:w-72 flex overflow-x-auto no-scrollbar xl:block xl:space-y-2 bg-zinc-50 dark:bg-zinc-800/50 p-2 xl:p-0 rounded-2xl xl:rounded-none">
           {[
             { id: 'business', label: 'Empresa', icon: Building2 },
             { id: 'hours', label: 'Horários', icon: Clock },
             { id: 'courts', label: 'Quadras', icon: MapPin },
             { id: 'payments', label: 'Pagamentos', icon: CreditCard },
             { id: 'fiscal', label: 'Fiscal', icon: FileText },
             { id: 'printers', label: 'Impressoras', icon: Printer },
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                 "flex-1 xl:w-full flex items-center justify-center xl:justify-start gap-4 px-4 xl:px-6 py-3 xl:py-4 rounded-xl xl:rounded-2xl text-[10px] xl:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap",
                 activeTab === tab.id 
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl" 
                  : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
               )}
             >
               <tab.icon size={18} />
               <span className="hidden sm:inline">{tab.label}</span>
             </button>
           ))}
        </aside>

        <main className="flex-1 bg-white dark:bg-zinc-900 rounded-[2rem] md:rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 md:p-10">
           {activeTab === 'business' && (
              <form onSubmit={handleSaveSettings} className="space-y-8 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block ml-2">Nome Fantasia</label>
                      <input 
                        value={settings?.companyName || ''}
                        onChange={e => setSettings({...settings!, companyName: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-bold"
                        placeholder="Arena SportHub"
                      />
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block ml-2">CNPJ / CPF</label>
                      <input 
                        value={settings?.cnpj || ''}
                        onChange={e => setSettings({...settings!, cnpj: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-bold"
                        placeholder="00.000.000/0001-00"
                      />
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block ml-2">Endereço Completo</label>
                    <input 
                      value={settings?.address || ''}
                      onChange={e => setSettings({...settings!, address: e.target.value})}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-bold"
                      placeholder="Rua das Arenas, 123 - Centro"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block ml-2">Logo da Empresa</label>
                    <div className="flex gap-4 items-center">
                       <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                          {settings?.logo ? (
                            <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Building2 size={24} className="text-zinc-300" />
                          )}
                       </div>
                       <div className="flex-1 space-y-2">
                          <label className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-transparent active:scale-95 group">
                            <Upload size={18} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">Fazer Upload Logo</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileChange} 
                              className="hidden" 
                            />
                          </label>
                          <p className="text-[8px] text-zinc-400 font-bold uppercase italic ml-2">Formatos: PNG, JPG, WEBP • Max: 800KB</p>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-8">
                  <header>
                    <h3 className="text-lg font-black dark:text-white flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                        <MapPin size={18} />
                      </div>
                      Presença Online (Google Maps)
                    </h3>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block ml-2">Link do Perfil Google Maps</label>
                      <input 
                        value={settings?.googleMapsUrl || ''}
                        onChange={e => setSettings({...settings!, googleMapsUrl: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-bold text-xs"
                        placeholder="https://maps.app.goo.gl/..."
                      />
                      <p className="text-[8px] text-zinc-400 font-bold uppercase italic ml-2">Usado para o selo de avaliações no site.</p>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block ml-2">Avaliação Google (Estrelas)</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={settings?.googleRating || 4.9}
                          onChange={e => setSettings({...settings!, googleRating: parseFloat(e.target.value)})}
                          className="w-24 px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-4 ring-zinc-500/10 dark:text-white font-black text-center"
                        />
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Circle key={i} size={12} className={i <= (settings?.googleRating || 4.9) ? "fill-amber-400 text-amber-400" : "text-zinc-200"} />
                          ))}
                        </div>
                      </div>
                      <p className="text-[8px] text-zinc-400 font-bold uppercase italic ml-2">Exibido dinamicamente na página pública.</p>
                    </div>
                  </div>
                </div>
                <button type="submit" className="px-10 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-zinc-500/10 hover:scale-105 active:scale-95 transition-all">
                  Salvar Alterações
                </button>
              </form>
           )}

           {activeTab === 'hours' && (
              <form onSubmit={handleSaveSettings} className="space-y-8 max-w-4xl">
                 <header>
                    <h3 className="text-xl font-black dark:text-white">Horário de Funcionamento</h3>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1 italic">Defina as janelas de agendamento permitidas para cada dia.</p>
                 </header>

                 <div className="space-y-4">
                    {DAYS_OF_WEEK.map((day, index) => {
                      const dayKey = index.toString();
                      const hours = settings?.businessHours?.[dayKey] || { open: '08:00', close: '22:00', isOpen: true };
                      
                      return (
                        <div key={dayKey} className={cn(
                          "p-6 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6",
                          hours.isOpen 
                            ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700" 
                            : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 opacity-60"
                        )}>
                          <div className="flex items-center gap-6 min-w-[200px]">
                            <button 
                              type="button"
                              onClick={() => {
                                const newHours = { ...settings?.businessHours };
                                newHours[dayKey] = { ...hours, isOpen: !hours.isOpen };
                                setSettings({ ...settings!, businessHours: newHours });
                              }}
                              className={cn(
                                "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                                hours.isOpen ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full bg-white shadow-sm transition-transform",
                                hours.isOpen ? "translate-x-6" : "translate-x-0"
                              )} />
                            </button>
                            <div>
                               <p className="font-bold dark:text-white leading-none">{day}</p>
                               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                                 {hours.isOpen ? 'Aberto para Reservas' : 'Fechado / Sem Expediente'}
                               </p>
                            </div>
                          </div>

                          {hours.isOpen && (
                            <div className="flex items-center gap-4 flex-1 justify-end animate-in fade-in slide-in-from-right-4 duration-300">
                               <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-zinc-400 ml-2">Abertura</label>
                                  <input 
                                    type="time"
                                    value={hours.open}
                                    onChange={e => {
                                      const newHours = { ...settings?.businessHours };
                                      newHours[dayKey] = { ...hours, open: e.target.value };
                                      setSettings({ ...settings!, businessHours: newHours });
                                    }}
                                    className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-xl border border-zinc-100 dark:border-zinc-700 font-bold outline-none focus:ring-2 ring-emerald-500/20 dark:text-white"
                                  />
                               </div>
                               <div className="w-4 h-[1px] bg-zinc-200 dark:bg-zinc-700 mt-5" />
                               <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-zinc-400 ml-2">Fechamento</label>
                                  <input 
                                    type="time"
                                    value={hours.close}
                                    onChange={e => {
                                      const newHours = { ...settings?.businessHours };
                                      newHours[dayKey] = { ...hours, close: e.target.value };
                                      setSettings({ ...settings!, businessHours: newHours });
                                    }}
                                    className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-xl border border-zinc-100 dark:border-zinc-700 font-bold outline-none focus:ring-2 ring-emerald-500/20 dark:text-white"
                                  />
                               </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                 </div>

                 <button type="submit" className="px-10 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-zinc-500/10 hover:scale-105 active:scale-95 transition-all">
                    Salvar Horários
                 </button>
              </form>
           )}

           {activeTab === 'courts' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white">Suas Quadras</h3>
                    <button 
                      onClick={handleAddCourt}
                      className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl hover:scale-110 transition-all font-bold"
                    >
                      <Plus size={24} />
                    </button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courts.map(court => (
                      <div key={court.id} className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 flex justify-between items-center">
                        <div>
                          <p className="font-bold dark:text-white">{court.name}</p>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{court.sport} • R$ {court.pricePerHour}/h</p>
                        </div>
                        <button onClick={() => deleteDoc(doc(db, 'courts', court.id))} className="text-zinc-400 hover:text-rose-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                 </div>
              </div>
           )}

           {activeTab === 'payments' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-black dark:text-white">Formas de Pagamento</h3>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1 italic">Ative ou crie novas modalidades de recebimento.</p>
                    </div>
                    <button 
                      onClick={handleAddPaymentMethod}
                      className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl hover:scale-110 transition-all font-bold"
                    >
                      <Plus size={24} />
                    </button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentMethods.map(method => (
                      <div 
                        key={method.id} 
                        onClick={() => handleTogglePaymentMethod(method)}
                        className={cn(
                          "p-6 rounded-[2rem] border transition-all cursor-pointer flex items-center justify-between group",
                          method.isActive 
                            ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-800 dark:border-zinc-700" 
                            : "bg-white border-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                            method.isActive ? "bg-white/10" : "bg-zinc-100 dark:bg-zinc-800"
                          )}>
                            <Wallet size={24} className={method.isActive ? "text-white" : "text-zinc-400"} />
                          </div>
                          <div>
                            <p className="font-bold">{method.name}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                              {method.isSystem ? 'Padrão do Sistema' : 'Modalidade Custom'}
                            </p>
                          </div>
                        </div>
                        {method.isActive ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                      </div>
                    ))}
                 </div>
              </div>
           )}

           {activeTab === 'fiscal' && (
              <div className="space-y-8">
                 <div className="p-10 bg-amber-50 dark:bg-amber-900/10 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/20 text-amber-700 dark:text-amber-400 flex gap-6">
                    <ShieldCheck size={48} className="shrink-0" />
                    <div>
                      <h4 className="font-black text-lg mb-2">Ambiente de Homologação</h4>
                      <p className="text-sm opacity-80 leading-relaxed font-medium">As emissões de nota fiscal estão em ambiente de testes. Verifique suas chaves de API tributária no menu avançado.</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Regime Tributário</label>
                       <select className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none dark:text-white">
                         <option>Simples Nacional</option>
                         <option>Lucro Presumido</option>
                         <option>MEI</option>
                       </select>
                    </div>
                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Inscrição Municipal</label>
                       <input className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl outline-none dark:text-white" placeholder="000.000-0" />
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'printers' && (
              <div className="space-y-8">
                 <div className="bg-zinc-50 dark:bg-zinc-800 p-8 rounded-3xl border border-zinc-100 dark:border-zinc-700 flex flex-col items-center justify-center gap-6 py-16 text-center">
                    <Printer size={64} className="text-zinc-300" />
                    <div>
                      <h4 className="font-black dark:text-white text-lg">Impressora Térmica não detectada</h4>
                      <p className="text-zinc-500 text-sm italic font-serif mt-2">Conecte sua impressora 58mm ou 80mm via USB ou Rede.</p>
                    </div>
                    <button className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-zinc-500/10">
                      Escalear Periféricos
                    </button>
                 </div>
              </div>
           )}
        </main>
      </div>
    </div>
  );
};
