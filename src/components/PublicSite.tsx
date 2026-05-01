import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Instagram, 
  Facebook, 
  ArrowRight,
  ChevronRight,
  Star,
  Users,
  Trophy,
  ShoppingBag,
  Info,
  Megaphone,
  ChevronLeft,
  Search,
  MessageSquare,
  ArrowUpRight,
  Zap,
  Shield,
  Check,
  X
} from 'lucide-react';
import { SiteConfig, Booking, Product, Court, Settings as AppSettings } from '../types';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, orderBy, setDoc, increment } from '@/lib/dataApi';
import { db, handleDataError, OperationType } from '@/lib/dataApi';
import { cn } from '../lib/utils';
import { format, addHours, startOfDay, endOfDay, isWithinInterval, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const PublicSite = () => {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{ courtId: string, time: string } | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [bookingFormData, setBookingFormData] = useState<{ name: string, phone: string, type: 'single' | 'recurring' }>({ 
    name: '', 
    phone: '', 
    type: 'single' 
  });
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  const defaultConfig: SiteConfig = {
    id: 'default',
    name: 'Minha Arena',
    palette: {
      primary: '#000000',
      secondary: '#10b981',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#000000',
    },
    hero: {
      title: 'A Melhor Experiência Esportiva',
      description: 'Reserve sua quadra agora e venha viver o esporte no mais alto nível.',
      backgroundImage: 'https://images.unsplash.com/photo-1541252260730-0412e3e2108e?auto=format&fit=crop&q=80',
      overlayOpacity: 50,
      ctaText: 'Agendar Agora',
    },
    sections: {
      about: { enabled: true, title: 'Sobre Nós', description: 'Nossa História', content: 'Somos um complexo esportivo dedicado à excelência.', ctaText: 'Conhecer' },
      events: { enabled: true, title: 'Torneios & Eventos', description: 'Competição de alto nível' },
      booking: { enabled: true, title: 'Reserva Online', description: 'Rápido e Prático' },
      ecommerce: { enabled: true, title: 'Loja & Produtos', description: 'Equipamentos Premium' },
      blog: { enabled: true, title: 'Notícias', description: 'Fique por dentro' },
    },
    contact: {
      address: 'Rua do Esporte, 123',
      phone: '(11) 99999-9999',
      email: 'contato@arena.com',
    }
  };

  useEffect(() => {
    // 0. Fetch App Settings for Logo
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const s = snap.data() as AppSettings;
        setSettings(s);
        if (s.companyName) document.title = s.companyName;
      }
    });

    // Unique Visit Counter
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const lastVisitDate = localStorage.getItem('arena_last_visit');
    
    if (lastVisitDate !== todayStr) {
      const statsRef = doc(db, 'site_stats', todayStr);
      setDoc(statsRef, {
        uniqueVisits: increment(1),
        date: todayStr
      }, { merge: true }).catch(console.error);
      localStorage.setItem('arena_last_visit', todayStr);
    }

    // 1. Fetch Site Config
    const siteDocRef = doc(db, 'site_config', 'default');
    const unsubConfig = onSnapshot(siteDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SiteConfig;
        setConfig(data);
        document.title = data.name;
      } else {
        setConfig(defaultConfig);
        document.title = defaultConfig.name;
      }
      setLoading(false);
    }, (err) => {
      handleDataError(err, OperationType.GET, 'site_config/default');
      setConfig(defaultConfig);
      setLoading(false);
    });

    // 2. Fetch Courts
    const unsubCourts = onSnapshot(collection(db, 'courts'), (snap) => {
      setCourts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court)));
    });

    // 3. Fetch Products
    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      const allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(allProducts);
    }, (err) => {
      console.error("Error fetching products:", err);
      // Fallback if query fails (e.g. index not ready)
      const unsubFallback = onSnapshot(collection(db, 'products'), (s) => {
        setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      });
    });

    // 4. Fetch News
    const qNews = query(collection(db, 'news'), where('status', '==', 'published'), orderBy('date', 'desc'));
    const unsubNews = onSnapshot(qNews, (snap) => {
      setNews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).slice(0, 3));
    });

    return () => {
      unsubConfig();
      unsubSettings();
      unsubCourts();
      unsubProducts();
      unsubNews();
    };
  }, []);

  // Fetch Bookings for active date
  useEffect(() => {
    const start = startOfDay(activeDate).toISOString();
    const end = endOfDay(activeDate).toISOString();
    
    const q = query(
      collection(db, 'bookings'),
      where('startTime', '>=', start),
      where('startTime', '<=', end)
    );

    const unsubBookings = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    });

    return () => unsubBookings();
  }, [activeDate]);

  if (loading || !config) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
      <div className="w-12 h-12 border-4 border-zinc-100 dark:border-zinc-800 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
    </div>
  );

  const colors = config.palette;

  // Helper to determine contrast text color
  const getContrastColor = (hexcolor: string) => {
    if (!hexcolor || hexcolor.length < 7) return "#ffffff";
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? "#000000" : "#ffffff";
  };

  const primaryContrast = getContrastColor(colors.primary);
  const secondaryContrast = getContrastColor(colors.secondary);
  const accentContrast = getContrastColor(colors.accent);

  const getAvailableTimes = (courtId: string) => {
    const times = [];
    const now = new Date();
    
    // Default hours if not defined in court (future: fetch from court config)
    const startHour = 7;
    const endHour = 23;
    
    for (let h = startHour; h <= endHour; h++) {
      const time = new Date(activeDate);
      time.setHours(h, 0, 0, 0);
      
      // If it's today, don't show past times
      const isToday = time.toDateString() === now.toDateString();
      if (isToday && time < now) continue;

      const isBooked = bookings.some(b => {
        if (b.courtId !== courtId || b.status === 'cancelled') return false;
        const bStart = parseISO(b.startTime);
        const bEnd = parseISO(b.endTime);
        
        // A slot starting at 'time' is booked if:
        // bStart <= time < bEnd
        return time >= bStart && time < bEnd;
      });

      if (!isBooked) {
        times.push(format(time, 'HH:mm'));
      }
    }
    return times.slice(0, 12); // Show more slots for better UX
  };

  const handleSlotClick = (courtId: string, time: string) => {
    setSelectedSlot({ courtId, time });
    setIsBookingModalOpen(true);
    setBookingStatus('idle');
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !config) return;

    setBookingStatus('saving');
    
    try {
      const court = courts.find(c => c.id === selectedSlot.courtId);
      if (!court) throw new Error('Quadra não encontrada');

      const [hours, minutes] = selectedSlot.time.split(':').map(Number);
      const startTime = new Date(activeDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = addHours(startTime, 1); // 1 hour duration by default

      const newBooking: Booking = {
        id: crypto.randomUUID(),
        courtId: selectedSlot.courtId,
        customerName: bookingFormData.name,
        customerPhone: bookingFormData.phone,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: 'confirmed', // From public site, we confirm it directly for now
        type: bookingFormData.type,
        totalPrice: court.pricePerHour,
        paidAmount: 0,
        payments: []
      };

      await setDoc(doc(db, 'bookings', newBooking.id), newBooking);
      setConfirmedBookingId(newBooking.id);
      setBookingStatus('success');
      setBookingFormData({ name: '', phone: '', type: 'single' });
    } catch (error) {
      console.error('Error creating booking:', error);
      handleDataError(error, OperationType.WRITE, 'bookings');
      setBookingStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-zinc-900 selection:text-white overflow-x-hidden overflow-y-auto" style={{ backgroundColor: colors.background, color: colors.text }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-900">
        <div className="container mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white overflow-hidden shadow-lg border border-zinc-100 dark:border-zinc-800" style={{ backgroundColor: settings?.logo && settings.logo.length > 20 ? 'transparent' : colors.primary }}>
              {settings?.logo && settings.logo.length > 20 ? (
                <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Trophy size={24} />
              )}
            </div>
            <span className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: colors.primary }}>{settings?.companyName || config.name}</span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-8 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {config.sections.booking.enabled && <a href="#booking" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Agendamento</a>}
            {config.sections.events.enabled && <a href="#events" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Eventos</a>}
            {config.sections.ecommerce.enabled && <a href="#store" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Loja</a>}
            {config.sections.blog.enabled && <a href="#blog" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Notícias</a>}
            <a href="#contact" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Contato</a>
          </nav>

          <div className="flex items-center gap-4">
             <button className="hidden sm:flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <Search size={16} /> Buscar
             </button>
             <button className="px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: colors.primary, color: primaryContrast }}>
                Área do Atleta
             </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={cn(
        "relative pt-16 pb-24 overflow-hidden min-h-[70vh] flex items-center",
        config.hero.backgroundImage ? "bg-zinc-950" : ""
      )}>
        {config.hero.backgroundImage && (
          <div className="absolute inset-0 z-0">
             <img 
              src={config.hero.backgroundImage} 
              className="w-full h-full object-cover" 
              alt="" 
              referrerPolicy="no-referrer"
             />
             <div 
              className="absolute inset-0 bg-black" 
              style={{ opacity: (config.hero.overlayOpacity ?? 40) / 100 }} 
             />
          </div>
        )}

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className={cn(
                "inline-flex items-center gap-3 px-4 py-2 rounded-full",
                config.hero.backgroundImage ? "bg-white/10 backdrop-blur-md" : "bg-zinc-100 dark:bg-zinc-800"
              )}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  config.hero.backgroundImage ? "text-white" : "text-zinc-600 dark:text-zinc-400"
                )}>Aberto Agora • Venha Treinar</span>
              </div>
              <h1 
                className="text-5xl md:text-[6rem] font-black uppercase tracking-tighter italic leading-[0.85]" 
                style={{ color: config.hero.backgroundImage ? '#fff' : colors.primary }}
              >
                {config.hero.title}
              </h1>
              <p className={cn(
                "text-xl md:text-2xl font-medium max-w-3xl mx-auto leading-relaxed",
                config.hero.backgroundImage ? "text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              )}>
                {config.hero.description}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
            >
              <button 
                onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.25em] shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: colors.primary, color: primaryContrast }}
              >
                {config.hero.ctaText}
              </button>
              <button 
                onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
                className={cn(
                  "w-full sm:w-auto px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 active:scale-95",
                  config.hero.backgroundImage 
                    ? "bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20" 
                    : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                )}
              >
                Explorar Arena <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>
        </div>

        {/* Huge Background Text */}
        {!config.hero.backgroundImage && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5 pointer-events-none select-none overflow-hidden flex items-center justify-center -z-10">
             <span className="text-[25rem] font-black italic uppercase tracking-tighter leading-none opacity-10 select-none">ARENA</span>
          </div>
        )}
      </section>

      {/* Booking Section */}
      {config.sections.booking.enabled && (
        <section id="booking" className="py-32 container mx-auto px-6 space-y-16">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-8">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: colors.secondary }}>{config.sections.booking.description}</span>
              <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none" style={{ color: colors.primary }}>
                {config.sections.booking.title}
              </h2>
            </div>
            
            <div className="flex bg-zinc-50 dark:bg-zinc-900 p-2 rounded-3xl border border-zinc-100 dark:border-zinc-800 items-center">
              <button onClick={() => setActiveDate(addDays(activeDate, -1))} className="p-3 text-zinc-400 hover:text-zinc-900 transition-colors"><ChevronLeft size={20} /></button>
              <div className="flex gap-2 mx-2">
                {[0, 1, 2, 3].map(offset => {
                  const date = addDays(new Date(), offset);
                  const isSelected = date.toDateString() === activeDate.toDateString();
                  return (
                    <button 
                      key={offset}
                      onClick={() => setActiveDate(date)}
                      className={cn(
                        "flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all",
                        isSelected ? "bg-zinc-900 text-white shadow-2xl scale-105" : "text-zinc-400 hover:bg-white dark:hover:bg-zinc-800"
                      )}
                    >
                      <span className="text-[8px] font-black uppercase tracking-widest">{format(date, 'EEE', { locale: ptBR })}</span>
                      <span className="text-xl font-black">{format(date, 'dd')}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setActiveDate(addDays(activeDate, 1))} className="p-3 text-zinc-400 hover:text-zinc-900 transition-colors"><ArrowRight size={20} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {courts.length > 0 ? courts.map((court, i) => {
              const availability = getAvailableTimes(court.id);
              return (
                <motion.div 
                  key={court.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-zinc-950 rounded-[3rem] border border-zinc-100 dark:border-zinc-900 overflow-hidden shadow-sm hover:shadow-2xl transition-all group border-b-[8px]"
                  style={{ borderBottomColor: colors.secondary }}
                >
                  <div className="p-8 space-y-8">
                     <div className="flex justify-between items-start">
                        <div className="space-y-1">
                           <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{court.sport}</span>
                           <h4 className="text-2xl font-black uppercase italic tracking-tighter leading-none" style={{ color: colors.primary }}>{court.name}</h4>
                        </div>
                        <div className="text-right">
                           <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Hora</span>
                           <p className="text-2xl font-black italic" style={{ color: colors.secondary }}>R$ {court.pricePerHour}</p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Slots Disponíveis</p>
                        <div className="grid grid-cols-3 gap-2">
                           {availability.length > 0 ? availability.map(time => (
                             <button 
                               key={time} 
                               onClick={() => handleSlotClick(court.id, time)}
                               className="py-3 px-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-[10px] font-black text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all border border-zinc-100 dark:border-zinc-800"
                             >
                               {time}
                             </button>
                           )) : (
                             <div className="col-span-2 py-4 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center text-red-500 text-[9px] font-black uppercase tracking-widest">
                                {format(activeDate, 'dd/MM') === format(new Date(), 'dd/MM') ? 'Esgotado' : 'Sem horários'}
                             </div>
                           )}
                        </div>
                     </div>

                     <button 
                        onClick={() => {
                          const element = document.getElementById(`booking`);
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full py-5 rounded-2xl font-black text-[9px] uppercase tracking-[0.3em] transition-all hover:scale-[1.02] shadow-xl" 
                        style={{ backgroundColor: colors.primary, color: primaryContrast }}
                      >
                         {config.sections.booking.ctaText || 'Ver Calendário'}
                      </button>
                  </div>
                </motion.div>
              )
            }) : (
              <div className="col-span-full py-20 bg-zinc-50 dark:bg-zinc-950 rounded-[4rem] text-center border-2 border-dashed border-zinc-100 dark:border-zinc-900">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Nenhuma quadra disponível para reserva online no momento.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Events Section */}
      {config.sections.events.enabled && (
        <section id="events" className="py-32 container mx-auto px-6">
           <div className="bg-zinc-950 rounded-[4rem] text-white p-12 md:p-24 overflow-hidden relative shadow-2xl border-4 border-white/5">
              <div className="relative z-10 flex flex-col lg:flex-row gap-20 items-center">
                 <div className="lg:w-1/2 space-y-10">
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                       <Trophy className="text-emerald-400" size={14} />
                       <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Torneios Oficiais & Rankings</span>
                    </div>
                    <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85]">
                      {config.sections.events.title}. <span className="text-zinc-500">Mostre seu talento.</span>
                    </h2>
                    <p className="text-xl text-zinc-400 max-w-md font-medium leading-relaxed italic">
                       {config.sections.events.description}
                    </p>
                    <button className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.3em] group">
                       {config.sections.events.ctaText || 'Inscrições Abertas'}
                       <div className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center group-hover:translate-x-4 transition-transform duration-500">
                         <ArrowRight size={24} />
                       </div>
                    </button>
                 </div>
                 <div className="lg:w-1/2 grid grid-cols-1 gap-6 w-full">
                    {[
                      { date: '15 MAI', title: 'Open Beach Tennis Pro', type: 'Arena Open', status: 'Inscrições Abertas' },
                      { date: '22 MAI', title: 'Copa Regional de Futsal', type: 'Futebol', status: 'Últimas Vagas' },
                      { date: '04 JUN', title: 'Beach & Bier Night', type: 'Social', status: 'Agendado' },
                    ].map((evt, idx) => (
                      <motion.div 
                        key={idx}
                        whileHover={{ x: 20 }}
                        className="p-8 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 flex justify-between items-center group cursor-pointer hover:bg-white/10 transition-all duration-500"
                      >
                         <div className="flex items-center gap-10">
                            <div className="flex flex-col items-center bg-white/5 p-4 rounded-2xl w-20">
                               <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{evt.date.split(' ')[1]}</span>
                               <span className="text-3xl font-black italic">{evt.date.split(' ')[0]}</span>
                            </div>
                            <div>
                               <h4 className="text-2xl font-black uppercase tracking-tighter italic leading-none">{evt.title}</h4>
                               <div className="mt-3 flex gap-3 items-center">
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{evt.type}</span>
                                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{evt.status}</span>
                               </div>
                            </div>
                         </div>
                         <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowUpRight size={24} />
                         </div>
                      </motion.div>
                    ))}
                 </div>
              </div>
              <div className="absolute -bottom-20 rotate-12 -right-20 text-[20rem] font-black italic uppercase text-white/5 pointer-events-none select-none tracking-tighter leading-none -z-0">SPORT</div>
           </div>
        </section>
      )}

      {/* Store Section */}
      {config.sections.ecommerce.enabled && (
        <section id="store" className="py-32 container mx-auto px-6 space-y-16">
           <div className="text-center space-y-6">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] italic" style={{ color: colors.secondary }}>{config.sections.ecommerce.description}</span>
              <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none" style={{ color: colors.primary }}>
                {config.sections.ecommerce.title}
              </h2>
           </div>
           
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {(() => {
                const featuredIds = config.sections.ecommerce.featuredProductIds || [];
                
                let displayedProducts: Product[] = [];
                
                if (featuredIds.length > 0) {
                  displayedProducts = products.filter(p => featuredIds.includes(p.id));
                } else {
                  // Prioritize products with images for the shop display
                  const withImage = products.filter(p => p.imageUrl).slice(0, 8);
                  if (withImage.length > 0) {
                    displayedProducts = withImage;
                  } else {
                    displayedProducts = products.slice(0, 8);
                  }
                }

                if (displayedProducts.length === 0) {
                  return (
                    <div className="col-span-full py-20 bg-zinc-50 dark:bg-zinc-950 rounded-[4rem] text-center border-2 border-dashed border-zinc-100 dark:border-zinc-900">
                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Nenhum produto selecionado para a vitrine.</p>
                    </div>
                  );
                }

                return displayedProducts.map((product, i) => (
                  <motion.div 
                    key={product.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col group"
                  >
                     <div className="aspect-[4/5] bg-zinc-50 dark:bg-zinc-950 rounded-[3rem] p-4 flex items-center justify-center relative overflow-hidden transition-all duration-700 border border-zinc-100 dark:border-zinc-900 group-hover:shadow-3xl group-hover:-translate-y-2">
                        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] flex items-center justify-center overflow-hidden">
                           {product.imageUrl ? (
                             <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" referrerPolicy="no-referrer" />
                           ) : (
                             <ShoppingBag size={48} className="text-zinc-200 dark:text-zinc-800" />
                           )}
                        </div>
                        
                        <div className="absolute top-8 right-8">
                           <span className="px-4 py-2 bg-white/90 backdrop-blur-md dark:bg-zinc-900/90 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                              {product.stock > 0 ? `Disp: ${product.stock}` : 'Esgotado'}
                           </span>
                        </div>

                        <div className="absolute inset-x-4 bottom-4 translate-y-20 group-hover:translate-y-0 transition-all duration-500 opacity-0 group-hover:opacity-100">
                          <button 
                            className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] shadow-2xl"
                          >
                             Adicionar ao Carrinho
                          </button>
                        </div>
                     </div>

                     <div className="pt-8 px-4 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                           <h3 className="font-black italic uppercase tracking-tighter text-2xl leading-none">{product.name}</h3>
                           <span className="font-mono font-black text-xl" style={{ color: colors.accent }}>R${product.price}</span>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium line-clamp-2 italic leading-relaxed">
                          {product.description || 'Produto de alta qualidade para sua performance na arena.'}
                        </p>
                        <button className="flex lg:hidden w-full py-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl font-black text-[9px] uppercase tracking-widest">
                           Ver Detalhes
                        </button>
                     </div>
                  </motion.div>
                ));
              })()}
           </div>
        </section>
      )}

      {/* News / Blog Section */}
      {config.sections.blog.enabled && (
        <section id="blog" className="py-32 bg-zinc-50 dark:bg-zinc-950">
           <div className="container mx-auto px-6 space-y-16">
              <div className="flex justify-between items-end">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: colors.secondary }}>{config.sections.blog.description}</span>
                    <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter leading-none" style={{ color: colors.primary }}>
                      {config.sections.blog.title}
                    </h2>
                 </div>
                 <button className="hidden md:flex items-center gap-3 text-[10px] font-black uppercase tracking-widest group">
                    {config.sections.blog.ctaText || 'Ver Todas'} <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                 {news.length > 0 ? news.map((item, i) => (
                   <motion.article 
                     key={item.id}
                     whileHover={{ y: -10 }}
                     className="bg-white dark:bg-zinc-900 p-8 rounded-[3.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-2xl transition-all space-y-8 flex flex-col h-full"
                   >
                      <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 rounded-[2.5rem] overflow-hidden">
                         {item.imageUrl ? (
                            <img src={item.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={item.title} />
                         ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300">
                               <Megaphone size={48} />
                            </div>
                         )}
                      </div>
                      <div className="space-y-4 flex-1">
                         <div className="flex gap-4">
                            <span className="px-3 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-[8px] font-black uppercase tracking-widest text-zinc-500">{item.category}</span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 ml-auto">{format(new Date(item.date), 'dd MMM yyyy', { locale: ptBR })}</span>
                         </div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-tight">{item.title}</h3>
                      </div>
                      <button className="w-14 h-14 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl flex items-center justify-center hover:scale-110 transition-all self-end">
                         <ArrowUpRight size={24} />
                      </button>
                   </motion.article>
                 )) : (
                   [1, 2, 3].map(i => (
                     <div key={i} className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-900/50 rounded-[3.5rem] border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-300 text-[10px] font-black uppercase tracking-widest">Aguardando Post</div>
                   ))
                 )}
              </div>
           </div>
        </section>
      )}

      {/* About Section */}
      {config.sections.about.enabled && (
        <section id="about" className="py-40 container mx-auto px-6 overflow-hidden">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
              <div className="space-y-10">
                 <div className="space-y-4">
                   <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.8] mb-4" style={{ color: colors.primary }}>
                     {config.sections.about.title}
                   </h2>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: colors.secondary }}>{config.sections.about.description}</p>
                 </div>
                 <p className="text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium italic border-l-8 pl-8 border-emerald-500 py-4 max-w-xl">
                   {config.sections.about.content}
                 </p>

                 <div className="grid grid-cols-2 gap-8 pt-4">
                   {[
                     { icon: <Zap className="text-emerald-500" />, title: "Luz Profissional", desc: "Iluminação LED de última geração" },
                     { icon: <ShoppingBag className="text-emerald-500" />, title: "Bar & Grill", desc: "Melhor happy hour da região" },
                     { icon: <Check className="text-emerald-500" />, title: "Vestiários", desc: "Infraestrutura completa e limpa" },
                     { icon: <Shield className="text-emerald-500" />, title: "Segurança", desc: "Ambiente monitorado 24h" }
                   ].map((item, idx) => (
                     <div key={idx} className="space-y-2">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                           {item.icon}
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest">{item.title}</h4>
                        <p className="text-[10px] text-zinc-400 font-medium leading-tight">{item.desc}</p>
                     </div>
                   ))}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 pt-10 border-t border-zinc-100 dark:border-zinc-900">
                    <div>
                       <p className="text-5xl font-black italic mb-2 text-emerald-500">3.5k+</p>
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Atletas mensais</p>
                    </div>
                    <div>
                       <p className="text-5xl font-black italic mb-2 text-emerald-500">06</p>
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Anos de Arena</p>
                    </div>
                    <div>
                       <p className="text-5xl font-black italic mb-2 text-emerald-500">100%</p>
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Padrão Match</p>
                    </div>
                 </div>
                 
                 <button className="px-12 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-105 active:scale-95 text-white" style={{ backgroundColor: colors.primary }}>
                    {config.sections.about.ctaText || 'Nossa Trajetória'}
                 </button>
              </div>
              <div className="relative group lg:justify-self-end">
                 <div className="w-[350px] md:w-[600px] aspect-[4/5] bg-zinc-100 dark:bg-zinc-900 rounded-[5rem] overflow-hidden rotate-6 group-hover:rotate-0 transition-all duration-1000 shadow-3xl">
                    <img 
                      src="https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?q=80&w=2600&auto=format&fit=crop" 
                      className="w-full h-full object-cover grayscale transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-110"
                      alt="About"
                    />
                 </div>
                 <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    className="absolute -bottom-10 -left-10 w-64 bg-white dark:bg-zinc-900 rounded-[3rem] shadow-3xl z-10 p-8 text-center border-4 border-zinc-50 dark:border-zinc-800 -rotate-6 hover:rotate-0 transition-all cursor-pointer"
                    onClick={() => settings?.googleMapsUrl && window.open(settings.googleMapsUrl, '_blank')}
                  >
                    <div className="flex flex-col items-center gap-2">
                       <div className="flex items-center gap-2 mb-2">
                          <img src="https://www.gstatic.com/images/branding/product/2x/maps_96dp.png" className="w-8 h-8 object-contain" alt="G" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Avaliações no Google</span>
                       </div>
                       <div className="flex gap-1 text-amber-400 mb-1">
                          {[1,2,3,4,5].map(i => {
                            const rating = settings?.googleRating || 4.9;
                            const isFull = i <= Math.floor(rating);
                            const isHalf = !isFull && i <= Math.ceil(rating) && (rating % 1 >= 0.3);
                            
                            return (
                              <div key={i} className="relative">
                                <Star size={16} className="text-zinc-200" />
                                <div 
                                  className="absolute inset-0 overflow-hidden text-amber-400"
                                  style={{ width: isFull ? '100%' : isHalf ? '50%' : '0%' }}
                                >
                                  <Star size={16} fill="currentColor" />
                                </div>
                              </div>
                            );
                          })}
                       </div>
                       <span className="text-2xl font-black italic">{settings?.googleRating?.toFixed(1) || "4.9"}<span className="text-zinc-400 dark:text-zinc-500 text-sm italic font-medium ml-1">/5</span></span>
                       <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Nota Máxima no Google Maps</span>
                    </div>
                  </motion.div>
              </div>
           </div>
        </section>
      )}

      {/* Footer */}
      <footer id="contact" className="bg-zinc-950 text-white pt-40 pb-20 overflow-hidden relative mt-20">
         <div className="container mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-24">
               {/* Brand Col */}
               <div className="lg:col-span-2 space-y-16">
                  <div className="flex items-center gap-4 group">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-black group-hover:rotate-12 transition-transform duration-500 shadow-2xl overflow-hidden">
                      {settings?.logo && settings.logo.length > 20 ? (
                        <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Trophy size={32} />
                      )}
                    </div>
                    <span className="text-6xl font-black italic uppercase tracking-tighter">{settings?.companyName || config.name}</span>
                  </div>
                  <h3 className="text-6xl md:text-8xl font-black uppercase italic leading-[0.8] tracking-tighter text-zinc-800 max-w-2xl">
                    Sua Arena. <br/><span className="text-white">Suas Regras.</span>
                  </h3>
                  <div className="flex flex-wrap gap-10 opacity-30">
                     {[1, 2, 3, 4].map(i => (
                       <div key={i} className="flex items-center gap-2 grayscale brightness-200">
                          <Star size={16} fill="white" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Patrocinador Platinum</span>
                       </div>
                     ))}
                  </div>
               </div>
               
               {/* Info Col */}
               <div className="space-y-12">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">Localização & Contato</h4>
                  <div className="space-y-10 group">
                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">Onde treinar</label>
                        <p className="flex items-start gap-4 text-lg italic font-bold text-zinc-400 group-hover:text-white transition-colors">
                           <MapPin size={24} className="shrink-0 text-zinc-800" />
                           {config.contact.address}
                        </p>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">Central de Atendimento</label>
                        <p className="flex items-center gap-4 text-lg italic font-bold text-zinc-400 group-hover:text-white transition-colors">
                           <Phone size={24} className="shrink-0 text-zinc-800" />
                           {config.contact.phone}
                        </p>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">E-mail</label>
                        <p className="flex items-center gap-4 text-lg italic font-bold text-zinc-400 group-hover:text-white transition-colors">
                           <Mail size={24} className="shrink-0 text-zinc-800" />
                           {config.contact.email}
                        </p>
                     </div>
                  </div>
               </div>

               {/* Social Col */}
               <div className="space-y-12">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">Canais & Redes</h4>
                  <div className="flex flex-wrap gap-4">
                     {[
                       { icon: Instagram, label: 'Instagram', url: config.contact.instagram ? `https://instagram.com/${config.contact.instagram.replace('@', '')}` : null },
                       { icon: Facebook, label: 'Facebook', url: config.contact.facebook ? (config.contact.facebook.startsWith('http') ? config.contact.facebook : `https://facebook.com/${config.contact.facebook}`) : null },
                       { icon: MessageSquare, label: 'WhatsApp', url: config.contact.phone ? `https://wa.me/${config.contact.phone.replace(/\D/g, '')}` : null },
                     ].map((social, i) => (
                       <button 
                        key={i} 
                        onClick={() => social.url && window.open(social.url, '_blank')}
                        className={cn(
                          "w-20 h-20 bg-zinc-900 border-2 border-zinc-900 hover:border-zinc-700 rounded-3xl flex items-center justify-center hover:bg-white hover:text-black hover:scale-110 transition-all duration-500 shadow-2xl",
                          !social.url && "opacity-20 cursor-not-allowed"
                        )}
                      >
                          <social.icon size={32} />
                       </button>
                     ))}
                  </div>
                  <div className="pt-12 space-y-6">
                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Arena App — Download Now</p>
                     <div className="flex gap-4">
                        <div className="h-14 w-40 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center px-4 gap-3 cursor-not-allowed opacity-40">
                           <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
                           <div className="space-y-1">
                              <p className="text-[6px] font-bold text-zinc-600">Download on the</p>
                              <p className="text-[10px] font-black">App Store</p>
                           </div>
                        </div>
                        <div className="h-14 w-40 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center px-4 gap-3 cursor-not-allowed opacity-40">
                           <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
                           <div className="space-y-1">
                              <p className="text-[6px] font-bold text-zinc-600">Get it on</p>
                              <p className="text-[10px] font-black">Google Play</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-40 pt-16 border-t border-zinc-900/50 flex flex-col md:flex-row justify-between items-center gap-10">
               <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-700 italic">
                  <p>© 2026 {config.name}. Proprietary System.</p>
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                  <p>Design by AI Studio Build</p>
               </div>
               <nav className="flex flex-wrap justify-center gap-12 text-[10px] font-black uppercase tracking-widest text-zinc-700">
                  <a href="#" className="hover:text-zinc-400 transition-colors underline decoration-2 underline-offset-8">Regulamento Int.</a>
                  <a href="#" className="hover:text-zinc-400 transition-colors">Compliance</a>
                  <a href="#" className="hover:text-zinc-400 transition-colors">LGPD</a>
               </nav>
            </div>
         </div>
         {/* Huge Decorative Text */}
         <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-[45rem] font-black italic uppercase text-white/[0.02] pointer-events-none select-none tracking-tighter leading-none -z-0 select-none">ARENA</div>
      </footer>

      {/* Booking Modal */}
      {isBookingModalOpen && selectedSlot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            onClick={() => setIsBookingModalOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md" 
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-950 rounded-[2.5rem] overflow-y-auto shadow-3xl border border-zinc-100 dark:border-zinc-900 border-b-[10px]"
            style={{ borderBottomColor: colors.primary }}
          >
            {bookingStatus === 'success' ? (
              <div className="p-6 md:p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-2xl">
                  <Check size={40} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Reserva Confirmada!</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium italic">Seu horário foi agendado com sucesso para {format(activeDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedSlot.time}.</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-3xl p-5 text-left border border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    <span>Protocolo</span>
                    <span className="text-zinc-900 dark:text-white">#{confirmedBookingId?.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    <span>Quadra</span>
                    <span className="text-zinc-900 dark:text-white capitalize">{courts.find(c => c.id === selectedSlot.courtId)?.name}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBookingModalOpen(false)}
                  className="w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95"
                  style={{ backgroundColor: colors.primary, color: primaryContrast }}
                >
                  OK, Entendido
                </button>
              </div>
            ) : (
              <>
                <div className="p-6 md:p-12 space-y-6 md:space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                       <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-200">Reserva de Quadra</span>
                       <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Finalizar Agendamento</h3>
                    </div>
                    <button 
                      onClick={() => setIsBookingModalOpen(false)}
                      className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-900 dark:text-white shadow-sm"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900/80 rounded-2xl p-4 md:p-6 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between shadow-inner">
                     <div className="flex items-center gap-3 md:gap-5">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-white dark:bg-zinc-800 rounded-xl flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-700 shadow-xl">
                           <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{format(activeDate, 'MMM', { locale: ptBR })}</span>
                           <span className="text-lg md:text-xl font-black italic leading-none text-zinc-900 dark:text-white">{format(activeDate, 'dd')}</span>
                        </div>
                        <div className="space-y-0.5">
                           <p className="text-xl md:text-2xl font-black italic leading-none text-zinc-900 dark:text-white">{selectedSlot.time}</p>
                           <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-200">Horário Escolhido</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xl md:text-2xl font-black italic" style={{ color: colors.secondary }}>R$ {courts.find(c => c.id === selectedSlot.courtId)?.pricePerHour}</p>
                        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-200">Valor da Hora</p>
                     </div>
                  </div>

                  <form onSubmit={handleBookingSubmit} className="space-y-5 md:space-y-6">
                     <div className="space-y-2 md:space-y-3">
                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-200 ml-4">Tipo de Reserva</label>
                        <div className="grid grid-cols-2 gap-3">
                           <button
                             type="button"
                             onClick={() => setBookingFormData({...bookingFormData, type: 'single'})}
                             className={cn(
                               "py-3 md:py-4 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest border transition-all duration-300",
                               bookingFormData.type === 'single' 
                                 ? "bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent shadow-lg scale-105" 
                                 : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                             )}
                           >
                              Reserva Avulsa
                           </button>
                           <button
                             type="button"
                             onClick={() => setBookingFormData({...bookingFormData, type: 'recurring'})}
                             className={cn(
                               "py-3 md:py-4 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest border transition-all duration-300",
                               bookingFormData.type === 'recurring' 
                                 ? "bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent shadow-lg scale-105" 
                                 : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                             )}
                           >
                              Mensalista
                           </button>
                        </div>
                     </div>

                     <div className="space-y-1.5 md:space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-200 ml-4">Nome Completo</label>
                        <input 
                          type="text" 
                          required
                          value={bookingFormData.name}
                          onChange={(e) => setBookingFormData({...bookingFormData, name: e.target.value})}
                          placeholder="Ex: João Silva" 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/80 p-4 md:p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold italic text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm"
                        />
                     </div>
                     <div className="space-y-1.5 md:space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-200 ml-4">WhatsApp para Contato</label>
                        <input 
                          type="tel" 
                          required
                          value={bookingFormData.phone}
                          onChange={(e) => setBookingFormData({...bookingFormData, phone: e.target.value})}
                          placeholder="(00) 00000-0000" 
                          className="w-full bg-zinc-50 dark:bg-zinc-900/80 p-4 md:p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold italic text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm"
                        />
                     </div>

                     <div className="pt-2 flex flex-col gap-3">
                        <p className="text-[8px] md:text-[9px] text-zinc-400 text-center font-bold px-8 leading-relaxed">
                          Ao confirmar, você concorda com o regulamento da arena. O pagamento será realizado diretamente na recepção.
                        </p>
                        <button 
                          disabled={bookingStatus === 'saving'}
                          type="submit"
                          className={cn(
                            "w-full py-4 md:py-5 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 disabled:opacity-50",
                            bookingStatus === 'saving' ? "animate-pulse" : ""
                          )}
                          style={{ backgroundColor: colors.primary, color: primaryContrast }}
                        >
                          {bookingStatus === 'saving' ? 'Agendando...' : 'Confirmar Reserva'}
                        </button>
                     </div>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};
