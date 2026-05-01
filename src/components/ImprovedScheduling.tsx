import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from '@/lib/dataApi';
import { db } from '@/lib/dataApi';
import { Booking, Court, Client } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Search, 
  Filter, 
  AlertCircle,
  X,
  PlusCircle,
  MinusCircle,
  Save,
  Trash2,
  Play,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays, getDay, isToday, parseISO, startOfDay, endOfDay, addHours, subHours, differenceInMinutes, isBefore, getYear, setYear, setMonth, setHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmartSearch } from './SmartSearch';

export const ImprovedScheduling = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeCourtTab, setActiveCourtTab] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTab, setViewTab] = useState<'today' | 'calendar'>('calendar');
  
  // New Booking State
  const [newBooking, setNewBooking] = useState<{
    clientId: string;
    courtId: string;
    startTime: string;
    duration: number;
    isWeekly: boolean;
  }>({
    clientId: '',
    courtId: '',
    startTime: '',
    duration: 60,
    isWeekly: false,
  });

  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', phone: '' });

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentYearVal = getYear(new Date());
  const years = Array.from({ length: 11 }, (_, i) => currentYearVal - 5 + i);

  useEffect(() => {
    const bookingsUnsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    });
    const courtsUnsub = onSnapshot(collection(db, 'courts'), (snapshot) => {
      const courtsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court));
      setCourts(courtsData);
    });
    const clientsUnsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => { bookingsUnsub(); courtsUnsub(); clientsUnsub(); };
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = currentTime;
  const [soundedWhistles, setSoundedWhistles] = useState<Set<string>>(new Set());

  const playWhistle = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1.2);

      // Second blast
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
        gain2.gain.setValueAtTime(0, audioCtx.currentTime);
        gain2.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gain2.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.8);
      }, 1500);
    } catch (e) {
      console.error('Audio alert failed:', e);
    }
  };

  const liveBookings = bookings.filter(b => {
    const start = parseISO(b.startTime);
    const end = parseISO(b.endTime);
    
    // We show all today's bookings that are either:
    // 1. Not started yet (Standby)
    // 2. In progress (Started)
    const isTodayMatch = isToday(start);
    const isNotFinished = b.actualEndTime ? now < parseISO(b.actualEndTime) : now < end;
    
    // Apply court filter if one is selected
    const matchesCourt = activeCourtTab === 'all' || b.courtId === activeCourtTab;
    
    // Filter out cancelled bookings
    const isCancelled = b.status === 'cancelled';
    
    return isTodayMatch && isNotFinished && matchesCourt && !isCancelled;
  }).map(b => {
    const start = b.actualStartTime ? parseISO(b.actualStartTime) : parseISO(b.startTime);
    const end = b.actualEndTime ? parseISO(b.actualEndTime) : parseISO(b.endTime);
    
    const totalMinutes = Math.max(1, differenceInMinutes(end, start));
    const elapsedMinutes = b.actualStartTime ? differenceInMinutes(now, start) : 0;
    
    const progress = b.actualStartTime ? Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100)) : 0;
    const remaining = b.actualStartTime ? Math.max(0, differenceInMinutes(end, now)) : totalMinutes;
    
    return { ...b, progress, remaining, isStarted: !!b.actualStartTime };
  });

  useEffect(() => {
    liveBookings.forEach(b => {
      if (b.progress >= 100 && b.isStarted && !soundedWhistles.has(b.id)) {
        playWhistle();
        setSoundedWhistles(prev => {
          const next = new Set(prev);
          next.add(b.id);
          return next;
        });
      }
    });
  }, [liveBookings, soundedWhistles]);

  const handleStartBooking = async (booking: Booking) => {
    const startTime = new Date();
    const duration = differenceInMinutes(parseISO(booking.endTime), parseISO(booking.startTime));
    const endTime = addHours(startTime, duration / 60);

    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        actualStartTime: startTime.toISOString(),
        actualEndTime: endTime.toISOString()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'cancelled'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const dailyBookings = bookings.filter(b => 
    isSameDay(parseISO(b.startTime), selectedDate) && 
    (activeCourtTab === 'all' || b.courtId === activeCourtTab) &&
    b.status !== 'cancelled'
  );

  const handleCreateClient = async () => {
    if (!newClientData.name) return;
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        ...newClientData,
        email: '',
        address: '',
        createdAt: new Date().toISOString()
      });
      setNewBooking(prev => ({ ...prev, clientId: docRef.id }));
      setIsNewClientModalOpen(false);
      setNewClientData({ name: '', phone: '' });
    } catch (error) { console.error(error); }
  };

  const handleCreateBooking = async () => {
    if (!newBooking.clientId || !newBooking.courtId || !newBooking.startTime) {
      alert('Preencha cliente, quadra e horário.');
      return;
    }
    const client = clients.find(c => c.id === newBooking.clientId);
    const court = courts.find(c => c.id === newBooking.courtId);
    if (!client || !court) return;

    const start = parseISO(newBooking.startTime);
    const end = addHours(start, newBooking.duration / 60);

    try {
      if (newBooking.isWeekly) {
        await addDoc(collection(db, 'recurringBookings'), {
          courtId: court.id,
          clientId: client.id,
          dayOfWeek: getDay(start),
          startTime: format(start, 'HH:mm'),
          duration: newBooking.duration
        });
      }

      await addDoc(collection(db, 'bookings'), {
        clientId: client.id,
        customerName: client.name,
        customerPhone: client.phone,
        courtId: court.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'confirmed',
        type: newBooking.isWeekly ? 'recurring' : 'single',
        totalPrice: (court.pricePerHour * newBooking.duration) / 60,
        paidAmount: 0,
        payments: []
      });
      setIsModalOpen(false);
      setNewBooking({
        clientId: '',
        courtId: '',
        startTime: '',
        duration: 60,
        isWeekly: false,
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateBookingDuration = async (booking: Booking, minutes: number) => {
    const court = courts.find(c => c.id === booking.courtId);
    if (!court) return;

    const baseEnd = booking.actualEndTime ? parseISO(booking.actualEndTime) : parseISO(booking.endTime);
    const baseStart = booking.actualStartTime ? parseISO(booking.actualStartTime) : parseISO(booking.startTime);
    const updatedEnd = addHours(baseEnd, minutes / 60);
    const duration = differenceInMinutes(updatedEnd, baseStart);
    if (duration < 30) return;

    try {
      const payload: Record<string, any> = {
        totalPrice: (court.pricePerHour * duration) / 60
      };

      if (booking.actualEndTime) {
        payload.actualEndTime = updatedEnd.toISOString();
      }

      payload.endTime = updatedEnd.toISOString();

      await updateDoc(doc(db, 'bookings', booking.id), payload);
    } catch (error) { console.error(error); }
  };

  const handleCellClick = (day: Date) => {
    setSelectedDate(day);
    setNewBooking(prev => ({
      ...prev,
      startTime: format(day, "yyyy-MM-dd'T'18:00") // Default to 18:00
    }));
    setIsModalOpen(true);
  };

  const startDay = getDay(startOfMonth(currentDate));
  const paddingDays = Array.from({ length: startDay }, (_, i) => i);
  const calendarDays = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex bg-white dark:bg-zinc-900 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-zinc-100 dark:border-zinc-800 w-full md:w-fit shrink-0">
          <button 
            onClick={() => setViewTab('today')}
            className={cn(
              "flex-1 px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] transition-all flex items-center justify-center gap-2 md:gap-3 whitespace-nowrap",
              viewTab === 'today' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            Agenda <span className="hidden xs:inline">de Hoje</span>
          </button>
          <button 
            onClick={() => setViewTab('calendar')}
            className={cn(
              "flex-1 px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] transition-all flex items-center justify-center gap-2 md:gap-3 whitespace-nowrap",
              viewTab === 'calendar' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            Calendário
          </button>
        </div>
      </div>

      {/* Live Header */}
      <div className="bg-zinc-950 text-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden transition-all duration-1000">
        <div className="relative z-10 flex flex-col gap-8 md:gap-10">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/80">Ocupação em tempo real</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">Arena Central</h2>
            </div>
            
            <div className="flex flex-col items-start xl:items-end gap-3 w-full xl:w-auto">
               <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 md:mr-2">Filtro de Quadras</span>
               <div className="flex overflow-x-auto no-scrollbar bg-white/5 backdrop-blur-3xl p-1.5 rounded-2xl border border-white/10 w-full xl:w-auto gap-1">
                 <button 
                   onClick={() => setActiveCourtTab('all')}
                   className={cn(
                     "px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                     activeCourtTab === 'all' ? "bg-white text-zinc-900 shadow-xl" : "text-zinc-500 hover:text-white"
                   )}
                 >
                   Todas
                 </button>
                 {courts.map(court => (
                   <button 
                     key={court.id}
                     onClick={() => setActiveCourtTab(court.id)}
                     className={cn(
                       "px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                       activeCourtTab === court.id ? "bg-white text-zinc-900 shadow-xl" : "text-zinc-500 hover:text-white"
                     )}
                   >
                     {court.name}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {liveBookings.length === 0 ? (
              <div className="col-span-full py-8 md:py-12 flex flex-col items-center justify-center bg-white/5 rounded-3xl md:rounded-[2.5rem] border border-white/5 border-dashed">
                <Clock className="text-zinc-700 mb-4" size={40} md:size={48} strokeWidth={1} />
                <p className="text-zinc-500 font-serif italic text-lg text-center">
                  {activeCourtTab === 'all' 
                    ? "Nenhuma partida em andamento no momento." 
                    : `Nenhuma partida em andamento na ${courts.find(c => c.id === activeCourtTab)?.name || 'quadra'} agora.`
                  }
                </p>
              </div>
            ) : (
              liveBookings.map(b => (
                <motion.div 
                  key={b.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900/50 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 group hover:border-emerald-500/30 transition-all duration-500 shadow-xl"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">
                        {b.isStarted ? 'Sessão Atual' : 'Em Standby'}
                      </p>
                      <h3 className="text-xl md:text-2xl font-black text-white italic tracking-tighter uppercase transition-all">
                        {courts.find(c => c.id === b.courtId)?.name || 'Quadra'}
                      </h3>
                    </div>
                    <div className={cn(
                      "px-3 md:px-4 py-1 md:py-1.5 rounded-full border flex items-center gap-2 transition-all",
                      b.isStarted ? "border-emerald-500/20" : "border-zinc-700/50"
                    )}>
                       <div className={cn(
                         "w-1 md:w-1.5 h-1 md:h-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]",
                         b.isStarted ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                       )} />
                       <span className={cn(
                         "text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em]",
                         b.isStarted ? "text-emerald-500" : "text-zinc-500"
                       )}>
                         {b.isStarted ? 'Live' : 'Pronto'}
                       </span>
                    </div>
                  </div>

                  {!b.isStarted ? (
                    <div className="py-6 md:py-10 flex flex-col items-center justify-center space-y-6">
                       <div className="flex gap-4 items-center">
                         <button 
                           onClick={() => handleCancelBooking(b as any)}
                           className="w-10 h-10 md:w-12 md:h-12 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center transition-all"
                           title="Cancelar Horário"
                         >
                            <X size={20} md:size={24} />
                         </button>
                         <button 
                           onClick={() => handleStartBooking(b as any)}
                           className="group/play relative w-20 h-20 md:w-24 md:h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] hover:scale-110 active:scale-95 transition-all duration-500"
                         >
                            <Play size={32} md:size={40} className="text-white ml-1.5 md:ml-2 fill-white group-hover/play:scale-125 transition-transform" />
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping" />
                         </button>
                         <div className="w-10 h-10 md:w-12 md:h-12" /> {/* Spacer */}
                       </div>
                       <div className="text-center">
                          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/60 mb-1">Aguardando Início</p>
                          <p className="text-lg md:text-xl font-black text-white italic tracking-tighter uppercase">
                             Agenda: {format(parseISO(b.startTime), 'HH:mm')}
                          </p>
                       </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 md:gap-3">
                           <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                              <Clock size={16} md:size={18} />
                           </div>
                           <div>
                              <p className="text-[9px] md:text-[10px] font-black text-emerald-500 font-mono tracking-tighter italic uppercase">
                                Em Andamento
                              </p>
                              <p className="text-[7px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                                Fim previsto: {format(b.actualEndTime ? parseISO(b.actualEndTime) : parseISO(b.endTime), 'HH:mm')}
                              </p>
                           </div>
                        </div>
                        <button 
                          onClick={() => {
                            // Edit logic or open modal
                            setIsModalOpen(true);
                          }}
                          className="px-3 md:px-4 py-1.5 md:py-2 bg-white/5 hover:bg-white/10 rounded-lg md:rounded-xl text-[7px] md:text-[8px] font-black uppercase tracking-widest text-zinc-400 transition-all"
                        >
                          Editar Sessão
                        </button>
                      </div>

                      <div className="relative h-3 md:h-4 bg-white/5 rounded-full overflow-hidden mb-6">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${b.progress}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 20 }}
                          className={cn(
                            "absolute h-full rounded-full transition-all duration-500",
                            b.progress >= 90 ? "bg-gradient-to-r from-rose-600 to-rose-400" : "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                          )}
                        />
                      </div>
                    </>
                  )}

                    <div className="flex justify-between items-center bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2 md:gap-3">
                         <div className={cn(
                           "w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all",
                           b.isStarted ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                         )}>
                            <User size={16} md:size={18} />
                         </div>
                         <div>
                            <p className="text-[7px] md:text-[8px] font-black uppercase text-zinc-500 tracking-widest">Responsável</p>
                            <p className="text-[10px] md:text-xs font-black text-white uppercase italic truncate max-w-[100px] md:max-w-[120px]">{b.customerName}</p>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-right">
                           <p className="text-[7px] md:text-[8px] font-black uppercase text-zinc-500 tracking-widest">Valor</p>
                           <p className="text-[10px] md:text-xs font-black text-emerald-500 italic">R$ {b.totalPrice}</p>
                        </div>
                        <button 
                          onClick={() => {
                            const newTotal = prompt('Novo valor total:', b.totalPrice.toString());
                            if (newTotal && !isNaN(Number(newTotal))) {
                              updateDoc(doc(db, 'bookings', b.id), { totalPrice: Number(newTotal) });
                            }
                          }}
                          className="text-[7px] md:text-[8px] font-black text-zinc-500 hover:text-white uppercase tracking-tighter"
                        >
                          Editar Valor
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-between items-center">
                      <div className="flex flex-col gap-2">
                        <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                           <Clock size={12} /> {b.isStarted ? 'INÍCIO REAL' : 'AGENDADO'}: <span className="text-white">{format(b.isStarted ? parseISO(b.actualStartTime!) : parseISO(b.startTime), 'HH:mm')}</span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateBookingDuration(b as any, -30)}
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all"
                          >
                            -30min
                          </button>
                          <button
                            onClick={() => updateBookingDuration(b as any, 30)}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all"
                          >
                            +30min
                          </button>
                        </div>
                      </div>
                      {b.isStarted && (
                      <p className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        b.progress >= 100 ? "text-rose-500" : "text-emerald-500 animate-pulse"
                      )}>
                        {b.progress >= 100 ? 'TEMPO ESGOTADO' : `${b.remaining} MINUTOS RESTANTES`}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        
        {/* Background Accents */}
        <div className="absolute -right-40 -top-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -left-40 -bottom-40 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Daily Sidebar / View */}
        {(viewTab === 'today' || viewTab === 'calendar') && (
           <div className={cn("space-y-6", viewTab === 'today' ? "lg:col-span-12" : "lg:col-span-4")}>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 dark:text-white">
                  <CalendarIcon className="text-zinc-400" size={18} />
                  {viewTab === 'today' ? 'Agenda Detalhada' : 'Agenda do Dia'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-8 h-8 flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full hover:scale-110 transition-all shadow-lg"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              <div className="p-4 space-y-4 max-h-[700px] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                {dailyBookings.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((booking) => (
                  <motion.div 
                    key={booking.id}
                    layout
                    className="p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:shadow-xl transition-all group overflow-hidden"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-mono font-black py-1.5 px-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl">
                        {format(parseISO(booking.startTime), 'HH:mm')} - {format(parseISO(booking.endTime), 'HH:mm')}
                      </span>
                      <button onClick={() => deleteDoc(doc(db, 'bookings', booking.id))} className="text-zinc-400 hover:text-rose-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <h4 className="text-lg font-black dark:text-white leading-tight mb-1">{booking.customerName}</h4>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-4">{courts.find(c => c.id === booking.courtId)?.name}</p>
                    
                    <div className="flex gap-2">
                      <button onClick={() => updateBookingDuration(booking, -30)} className="flex-1 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase text-zinc-500">
                        <MinusCircle size={16} /> -30m
                      </button>
                      <button onClick={() => updateBookingDuration(booking, 30)} className="flex-1 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase text-zinc-500">
                        <PlusCircle size={16} /> +30m
                      </button>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
                {dailyBookings.length === 0 && (
                  <div className="p-8 text-center text-zinc-400 font-serif italic">Nenhum agendamento para hoje.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Calendar Grid */}
        {viewTab === 'calendar' && (
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] md:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 md:p-8 overflow-x-auto no-scrollbar">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 min-w-[600px] md:min-w-0">
                <div className="flex items-center gap-4">
                  <select 
                    value={currentDate.getMonth()} 
                    onChange={(e) => setCurrentDate(setMonth(currentDate, parseInt(e.target.value)))}
                    className="bg-transparent border-none text-xl md:text-2xl font-black capitalize dark:text-white appearance-none cursor-pointer outline-none"
                  >
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select 
                    value={currentDate.getFullYear()} 
                    onChange={(e) => setCurrentDate(setYear(currentDate, parseInt(e.target.value)))}
                    className="bg-transparent border-none text-xl md:text-2xl font-black dark:text-white appearance-none cursor-pointer outline-none"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 md:p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl md:rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600">
                    <ChevronLeft size={20} md:size={24} />
                  </button>
                  <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 md:p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl md:rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600">
                    <ChevronRight size={20} md:size={24} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 md:gap-4 min-w-[500px] md:min-w-0">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={`${d}-${i}`} className="text-center text-[10px] font-black text-zinc-300 mb-2 uppercase">{d}</div>)}
                
                {paddingDays.map(p => <div key={`p-${p}`} className="aspect-[4/5]" />)}

                {calendarDays.map((day) => {
                  const dayBookings = bookings.filter(b => isSameDay(parseISO(b.startTime), day) && b.status !== 'cancelled');
                  const active = isSameDay(day, selectedDate);
                  const isOtherMonth = !isSameMonth(day, currentDate);
                  const isPast = isBefore(startOfDay(day), startOfDay(new Date()));

                  return (
                       <motion.div 
                          key={day.toISOString()}
                          whileHover={!isPast ? { scale: 1.05, y: -5 } : {}}
                          onClick={() => !isPast && handleCellClick(day)}
                          className={cn(
                            "aspect-[4/5] rounded-[1.5rem] md:rounded-[2rem] flex flex-col p-2 md:p-4 cursor-pointer transition-all relative overflow-hidden group border-2",
                            active 
                              ? "bg-zinc-950 text-white border-emerald-500 shadow-[0_20px_50px_rgba(0,0,0,0.3)] scale-110 z-10" 
                              : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-emerald-500/30",
                            isOtherMonth && "opacity-20",
                            isPast && "cursor-not-allowed opacity-30 grayscale border-transparent bg-zinc-50 dark:bg-zinc-800/10"
                          )}
                        >
                          <div className="flex justify-between items-start mb-1 md:mb-2 text-xs md:text-sm">
                            <span className={cn("text-sm md:text-lg font-black italic tracking-tighter", active ? "text-emerald-400" : "dark:text-white")}>
                              {day.getDate()}
                            </span>
                            {isToday(day) && (
                              <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1 overflow-hidden">
                            {dayBookings.slice(0, 2).map((b, idx) => (
                              <div key={idx} className={cn(
                                "text-[5px] md:text-[7px] font-black uppercase tracking-widest truncate px-1 md:px-2 py-0.5 md:py-1 rounded-sm md:rounded-lg", 
                                active ? "bg-white/10 text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                              )}>
                                {b.customerName}
                              </div>
                            ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[5px] md:text-[7px] text-zinc-400 font-black uppercase tracking-widest pl-1">
                                +{dayBookings.length - 2} mais
                              </div>
                            )}
                          </div>

                      {dayBookings.length > 0 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day);
                            setViewTab('today');
                          }}
                          className="absolute bottom-2 left-2 right-2 py-1 bg-blue-500 text-white text-[7px] font-black uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Ver Agenda
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Hourly View (when in 'today' tab or opened via 'Ver Agenda') */}
      {viewTab === 'today' && (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
           <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter mb-8 italic flex items-center gap-4">
             <CalendarIcon className="text-blue-500" /> Detalhes: {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
              {courts.map(court => (
                <div key={court.id} className="space-y-6">
                   <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                      <h4 className="font-black text-sm uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" /> {court.name}
                      </h4>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800 px-3 py-1 rounded-full">{court.sport}</span>
                   </div>
                   <div className="space-y-3">
                     {Array.from({ length: 15 }, (_, i) => 8 + i).map(hour => {
                       const booking = bookings.find(b => 
                         b.courtId === court.id && 
                         isSameDay(parseISO(b.startTime), selectedDate) &&
                         parseISO(b.startTime).getHours() === hour &&
                         b.status !== 'cancelled'
                       );

                       return (
                         <div key={hour} className={cn(
                           "flex justify-between items-center p-2.5 md:p-5 rounded-xl md:rounded-3xl border transition-all relative overflow-hidden",
                           booking 
                             ? "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30" 
                             : "bg-zinc-50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                         )}>
                            <div className="flex items-center gap-6">
                               <div className="text-center">
                                 <p className="font-mono text-[10px] md:text-xs font-black dark:text-white">{hour}:00</p>
                                 <p className="text-[6px] md:text-[8px] font-black text-zinc-400 uppercase tracking-widest -mt-1">Início</p>
                               </div>
                               <div className="w-px h-6 md:h-8 bg-zinc-200 dark:bg-zinc-700 mx-1 md:mx-2" />
                               <div>
                                 {booking ? (
                                   <>
                                     <p className="font-black text-[9px] md:text-sm dark:text-white uppercase tracking-tight italic">{booking.customerName}</p>
                                     <p className="text-[7px] md:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                        {format(parseISO(booking.startTime), 'HH:mm')} - {format(parseISO(booking.endTime), 'HH:mm')}
                                     </p>
                                   </>
                                 ) : (
                                   <p className="text-[8px] md:text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] italic">Livre</p>
                                 )}
                               </div>
                            </div>
                            {!booking && (
                              <button 
                                onClick={() => {
                                  const d = setHours(startOfDay(selectedDate), hour);
                                  setNewBooking(prev => ({ ...prev, startTime: format(d, "yyyy-MM-dd'T'HH:mm"), courtId: court.id }));
                                  setIsModalOpen(true);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm text-zinc-400 hover:text-blue-500 hover:scale-110 transition-all"
                              >
                                <Plus size={18} strokeWidth={3} />
                              </button>
                            )}
                         </div>
                       );
                     })}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-[3rem] p-10 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black dark:text-white uppercase tracking-tighter italic">Marcar Horário</h2>
                <button onClick={() => setIsModalOpen(false)} className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-2xl text-zinc-500 hover:text-rose-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                 <div className="flex p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-8">
                   <button 
                     onClick={() => setNewBooking({...newBooking, isWeekly: false})}
                     className={cn("flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all", !newBooking.isWeekly ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400")}
                   >
                     Avulsa
                   </button>
                   <button 
                     onClick={() => setNewBooking({...newBooking, isWeekly: true})}
                     className={cn("flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all", newBooking.isWeekly ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400")}
                   >
                     Semanal (Recorrente)
                   </button>
                 </div>

                <div className="space-y-6">
                  <SmartSearch<Client> 
                    label="Cliente"
                    items={clients}
                    searchFields={['name', 'phone']}
                    displayField="name"
                    value={newBooking.clientId}
                    onSelect={(client) => setNewBooking({...newBooking, clientId: client.id})}
                    onAddNew={() => setIsNewClientModalOpen(true)}
                    placeholder="Pesquisar cliente..."
                  />

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Quadra</label>
                    <select 
                      value={newBooking.courtId}
                      onChange={(e) => setNewBooking({...newBooking, courtId: e.target.value})}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl dark:text-white outline-none focus:ring-4 ring-zinc-500/10 transition-all"
                    >
                      <option value="">Selecionar Quadra</option>
                      {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Data e Horário</label>
                      <input 
                        type="datetime-local" 
                        value={newBooking.startTime}
                        onChange={(e) => setNewBooking({...newBooking, startTime: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Duração (Min)</label>
                      <select 
                        value={newBooking.duration}
                        onChange={(e) => setNewBooking({...newBooking, duration: Number(e.target.value)})}
                        className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl dark:text-white"
                      >
                        <option value={30}>30 min</option>
                        <option value={60}>1h 00m</option>
                        <option value={90}>1h 30m</option>
                        <option value={120}>2h 00m</option>
                        <option value={180}>3h 00m</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={handleCreateBooking}
                    className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-500/10 mt-4"
                  >
                    <Save size={24} />
                    Confirmar {newBooking.isWeekly ? 'Plano Semanal' : 'Reserva'}
                  </button>
                </div>
              </div>

              {/* Nested New Client Modal */}
              <AnimatePresence>
                {isNewClientModalOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-x-8 top-20 bottom-8 bg-zinc-50 dark:bg-zinc-800 rounded-[2.5rem] p-8 shadow-2xl z-[60] flex flex-col"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-black text-xs uppercase tracking-widest text-zinc-500 italic">Novo Cadastro Rápido</h4>
                      <button onClick={() => setIsNewClientModalOpen(false)} className="text-zinc-400 hover:text-rose-500"><X size={20}/></button>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Nome Completo</label>
                        <input 
                          autoFocus
                          placeholder="Ex: João Silva" 
                          value={newClientData.name} onChange={e => setNewClientData({...newClientData, name: e.target.value})}
                          className="w-full px-6 py-4 bg-white dark:bg-zinc-900 rounded-2xl outline-none dark:text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Telefone (WhatsApp)</label>
                        <input 
                          placeholder="(00) 00000-0000" 
                          value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: e.target.value})}
                          className="w-full px-6 py-4 bg-white dark:bg-zinc-900 rounded-2xl outline-none dark:text-white"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleCreateClient}
                      className="w-full py-5 bg-blue-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all mt-4"
                    >
                      Cadastrar e Selecionar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
