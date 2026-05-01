import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, Timestamp, deleteDoc } from '@/lib/dataApi';
import { db, handleDataError, OperationType } from '@/lib/dataApi';
import { Product, Client, CartItem, OpenTab, Transaction, PaymentMethod, Category, Booking, InventoryLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ShoppingCart, 
  Package, 
  Plus, 
  Search, 
  X, 
  Trash2, 
  User, 
  CreditCard,
  Clock,
  ArrowRight,
  Coffee,
  CheckCircle2,
  UserPlus,
  Minus,
  Filter,
  DollarSign,
  Wallet,
  AlertTriangle,
  History,
  TrendingUp,
  LayoutGrid,
  Save,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Check,
  CircleDot,
  Globe
} from 'lucide-react';
import { cn, formatPhone } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmartSearch } from './SmartSearch';
import { WebsiteEditor } from './WebsiteEditor';

export const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'sale' | 'consumption' | 'court-payment' | 'history'>('sale');
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);

  // History Tab State
  const [selectedHistoryClientId, setSelectedHistoryClientId] = useState<string>('');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Top Sellers Logic
  const topSellers = products.map(p => ({
    ...p,
    salesCount: inventoryLogs.filter(l => l.productId === p.id && l.type === 'exit' && l.reason === 'Venda PDV').reduce((acc, l) => acc + l.quantity, 0)
  })).sort((a, b) => b.salesCount - a.salesCount).slice(0, 8);

  // PGTO QUADRA State
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [athletePayments, setAthletePayments] = useState<{name: string, value: number, paymentMethodId: string}[]>([]);
  const [newAthlete, setNewAthlete] = useState({ name: '', value: 0, paymentMethodId: '' });
  
  // Court Share in Direct Sale
  const [courtShareToPay, setCourtShareToPay] = useState<{bookingId: string, amount: number, athleteName: string} | null>(null);
  const [committedCourtShares, setCommittedCourtShares] = useState<{id: string, bookingId: string, amount: number, athleteName: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Current Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tabLabel, setTabLabel] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

  useEffect(() => {
    const pUnsub = onSnapshot(collection(db, 'products'), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const cUnsub = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client))));
    const tUnsub = onSnapshot(query(collection(db, 'openTabs'), orderBy('openedAt', 'desc')), (s) => {
      setOpenTabs(s.docs.map(d => ({ id: d.id, ...d.data() } as OpenTab)).filter(t => t.status === 'open'));
    });
    const payUnsub = onSnapshot(collection(db, 'paymentMethods'), (s) => {
      const methods = s.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)).filter(m => m.isActive);
      setPaymentMethods(methods);
      const defaultMethod = methods.find(m => m.type === 'cash' || m.type === 'pix')?.id || methods[0]?.id;
      setSelectedPaymentMethod(defaultMethod);
      setTabPaymentMethodId(defaultMethod);
      setNewAthlete(prev => ({ ...prev, paymentMethodId: defaultMethod }));
    });
    const catUnsub = onSnapshot(collection(db, 'categories'), (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as Category))));
    const logsUnsub = onSnapshot(collection(db, 'inventoryLogs'), (s) => setInventoryLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog))));
    const bookUnsub = onSnapshot(collection(db, 'bookings'), (s) => setTodayBookings(s.docs.map(d => ({ id: d.id, ...d.data() } as Booking))));
    
    return () => { pUnsub(); cUnsub(); tUnsub(); payUnsub(); catUnsub(); logsUnsub(); bookUnsub(); };
  }, []);

  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', phone: '' });

  // Payment from Tab
  const [payingTabId, setPayingTabId] = useState<string | null>(null);
  const [tabPaymentMethodId, setTabPaymentMethodId] = useState<string>('');

  // History Filters
  const [histDate, setHistDate] = useState('');
  const [histDayOfWeek, setHistDayOfWeek] = useState('');
  const [histClientName, setHistClientName] = useState('');
  const [histAthleteName, setHistAthleteName] = useState('');

  const handleDownloadPDF = (booking: Booking) => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(30, 30, 30);
    doc.text('ArenaHub - Relatorio de Agendamento', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Responsavel: ${booking.customerName}`, 14, 35);
    doc.text(`Data: ${format(new Date(booking.startTime), 'dd/MM/yyyy')}`, 14, 40);
    doc.text(`Horario: ${format(new Date(booking.startTime), 'HH:mm')} - ${format(new Date(booking.endTime), 'HH:mm')}`, 14, 45);
    
    doc.setDrawColor(240, 240, 240);
    doc.line(14, 50, 196, 50);

    const tableData = (booking.payments || []).map(p => [
      format(new Date(p.timestamp), 'dd/MM HH:mm'),
      p.playerName || '---',
      p.method || '---',
      `R$ ${p.amount}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Data/Hora', 'Atleta', 'Forma Pagto', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(`Total Quadra: R$ ${booking.totalPrice}`, 14, finalY);
    doc.text(`Total Pago: R$ ${booking.paidAmount}`, 14, finalY + 7);

    doc.save(`relatorio-${booking.customerName}-${format(new Date(booking.startTime), 'dd-MM-yy')}.pdf`);
  };

  const handlePrintReport = (booking: Booking) => {
    handleDownloadPDF(booking);
    alert('PDF Gerado para impressao.');
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

  const cleanupHistory = async () => {
    // Only keep last 30 days or last 4 weekly occurrences per client
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookingsByClient: { [key: string]: Booking[] } = {};
    todayBookings.forEach(b => {
      if (b.clientId) {
        if (!bookingsByClient[b.clientId]) bookingsByClient[b.clientId] = [];
        bookingsByClient[b.clientId].push(b);
      }
    });

    for (const clientId in bookingsByClient) {
      const clientBookings = bookingsByClient[clientId].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      for (let i = 0; i < clientBookings.length; i++) {
        const b = clientBookings[i];
        const bDate = new Date(b.startTime);
        if (i >= 4 && bDate < thirtyDaysAgo) {
          try {
            await deleteDoc(doc(db, 'bookings', b.id));
          } catch (e) { console.error('Error cleaning up history:', e); }
        }
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'history') cleanupHistory();
  }, [activeTab]);

  const handleCreateClient = async () => {
    if (!newClientData.name) return;
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        ...newClientData,
        email: '',
        address: '',
        createdAt: new Date().toISOString()
      });
      setSelectedClientId(docRef.id);
      setIsNewClientModalOpen(false);
      setNewClientData({ name: '', phone: '' });
    } catch (error) { console.error(error); }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const paymentMethodToName = (id: string) => {
    const method = paymentMethods.find(m => m.id === id);
    return method ? method.name : '---';
  };

  useEffect(() => {
    if (selectedBookingId) {
      const booking = todayBookings.find(b => b.id === selectedBookingId);
      if (booking) {
        setAthletePayments(booking.payments.map(p => ({
          name: p.playerName || 'Anônimo',
          value: p.amount,
          paymentMethodId: p.methodId || ''
        })));
      }
    }
  }, [selectedBookingId, todayBookings]);

  const courtTotal = committedCourtShares.reduce((acc, s) => acc + s.amount, 0);
  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0) + courtTotal;
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort filtered products so top sellers are first
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aSellers = topSellers.find(ts => ts.id === a.id);
    const bSellers = topSellers.find(ts => ts.id === b.id);
    if (aSellers && !bSellers) return -1;
    if (!aSellers && bSellers) return 1;
    return 0;
  });

  const handleCreateTab = async () => {
    if (cart.length === 0 || (!selectedClientId && !tabLabel)) return;
    try {
      await addDoc(collection(db, 'openTabs'), {
        label: tabLabel || clients.find(c => c.id === selectedClientId)?.name || 'Mesa avulsa',
        clientId: selectedClientId || null,
        items: cart,
        openedAt: new Date().toISOString(),
        status: 'open'
      });
      setCart([]);
      setSelectedClientId('');
      setTabLabel('');
      setActiveTab('consumption');
    } catch (error) { console.error(error); }
  };

  const handleCheckout = async (isFiado: boolean = false, fromTab?: OpenTab, paymentIdOverride?: string) => {
    const itemsToProcess = fromTab ? fromTab.items : cart;
    const itemsTotal = fromTab ? fromTab.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0) : cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const finalTotal = fromTab ? itemsTotal : total;
    const clientId = fromTab ? fromTab.clientId : selectedClientId;
    const usePaymentId = paymentIdOverride || selectedPaymentMethod;
    const paymentMethod = paymentMethods.find(m => m.id === usePaymentId);

    try {
      // 1. Record Transaction
      await addDoc(collection(db, 'transactions'), {
        type: 'income',
        amount: finalTotal,
        description: `Venda PDV - ${isFiado ? 'Conta Corrente' : paymentMethod?.name || 'Venda'} ${fromTab ? `(Fechamento Comanda: ${fromTab.label})` : ''} ${committedCourtShares.length > 0 ? `(Inclui ${committedCourtShares.length} Rateios de Quadra)` : ''}`,
        timestamp: new Date().toISOString(),
        status: isFiado ? 'pending' : 'paid',
        clientId: clientId || null,
        paymentMethodId: isFiado ? paymentMethods.find(m => m.type === 'account')?.id : usePaymentId
      });

      // 2. Process Court Shares if any
      if (committedCourtShares.length > 0 && !fromTab) {
        for (const share of committedCourtShares) {
          const booking = todayBookings.find(b => b.id === share.bookingId);
          if (booking) {
            const newPayment = {
              id: crypto.randomUUID(),
              amount: share.amount,
              timestamp: new Date().toISOString(),
              playerName: share.athleteName || 'Atleta não identificado',
              methodId: isFiado ? 'account' : selectedPaymentMethod,
              method: isFiado ? 'Conta Corrente' : (paymentMethod?.name || 'Outro')
            };
            await updateDoc(doc(db, 'bookings', booking.id), {
              payments: [...(booking.payments || []), newPayment],
              paidAmount: (booking.paidAmount || 0) + share.amount,
              status: (booking.totalPrice - ((booking.paidAmount || 0) + share.amount)) <= 0 ? 'confirmed' : 'pending'
            });
          }
        }
      }

      // 3. Update Stock & Logs
      for (const item of itemsToProcess) {
        const prodRef = doc(db, 'products', item.product.id);
        const currentProd = products.find(p => p.id === item.product.id);
        if (currentProd) {
          await updateDoc(prodRef, { stock: currentProd.stock - item.quantity });
        }
        await addDoc(collection(db, 'inventoryLogs'), {
          productId: item.product.id,
          type: 'exit',
          quantity: item.quantity,
          timestamp: new Date().toISOString(),
          reason: 'Venda PDV'
        });
      }

      // 3. Update Client Balance & Total Spent
      if (clientId) {
        const client = clients.find(c => c.id === clientId);
        if (client) {
          await updateDoc(doc(db, 'clients', clientId), {
            balance: isFiado ? (client.balance || 0) - finalTotal : (client.balance || 0),
            totalSpent: (client.totalSpent || 0) + finalTotal
          });
        }
      }

      // 4. Close Tab if applicable
      if (fromTab) {
        await updateDoc(doc(db, 'openTabs', fromTab.id), { status: 'closed' });
        setPayingTabId(null);
      }

      if (!fromTab) {
        setCart([]);
        setCommittedCourtShares([]);
        setCourtShareToPay(null);
        setSelectedClientId('');
        setTabLabel('');
      }
      alert('Venda finalizada com sucesso!');
    } catch (error) { console.error(error); }
  };

  const handleSaveCourtProgress = async () => {
    const booking = todayBookings.find(b => b.id === selectedBookingId);
    if (!booking) return;

    try {
      const formattedPayments = athletePayments.map(p => {
        const method = paymentMethods.find(m => m.id === p.paymentMethodId);
        return {
          id: crypto.randomUUID(),
          amount: p.value,
          timestamp: new Date().toISOString(),
          playerName: p.name,
          methodId: p.paymentMethodId,
          method: method?.name || 'Outro'
        };
      });

      await updateDoc(doc(db, 'bookings', booking.id), {
        payments: formattedPayments,
        paidAmount: formattedPayments.reduce((acc, p) => acc + p.amount, 0)
      });
      alert('Progresso salvo com sucesso!');
    } catch (error) { console.error(error); }
  };

  const handleFinishCourtPayment = async () => {
    const booking = todayBookings.find(b => b.id === selectedBookingId);
    if (!booking) return;

    const paidByAthletes = athletePayments.reduce((acc, p) => acc + p.value, 0);
    const remaining = booking.totalPrice - paidByAthletes;
    
    try {
      // Record athlete payments as transactions
      for (const p of athletePayments) {
        const method = paymentMethods.find(m => m.id === p.paymentMethodId);
        if (p.value > 0) {
          await addDoc(collection(db, 'transactions'), {
            type: 'income',
            amount: p.value,
            description: `Pagto Atleta: ${p.name} (${method?.name || 'Venda'}) (Ref. Quadra - Resp: ${booking.customerName})`,
            timestamp: new Date().toISOString(),
            status: 'paid',
            paymentMethodId: p.paymentMethodId
          });
        }
      }

      // If there's a remaining balance, create an Open Tab
      if (remaining !== 0) {
        await addDoc(collection(db, 'openTabs'), {
          label: `Saldo Quadra: ${booking.customerName}`,
          clientId: booking.clientId || null,
          items: [{
            product: {
              id: 'court_balance',
              name: remaining > 0 ? 'Débito Restante Quadra' : 'Crédito Excedente Quadra',
              price: remaining, // Positive for debt, negative for credit
              cost: 0,
              stock: 999,
              minStock: 0
            },
            quantity: 1
          }],
          openedAt: new Date().toISOString(),
          status: 'open'
        });
      }

      // Update booking status
      const allPayments = [
        ...(booking.payments || []),
        ...athletePayments.map(p => {
          const method = paymentMethods.find(m => m.id === p.paymentMethodId);
          return {
            id: crypto.randomUUID(),
            amount: p.value,
            timestamp: new Date().toISOString(),
            playerName: p.name,
            methodId: p.paymentMethodId,
            method: method?.name || 'Outro'
          };
        })
      ];

      await updateDoc(doc(db, 'bookings', booking.id), {
        paidAmount: (booking.paidAmount || 0) + paidByAthletes,
        status: (booking.totalPrice - ((booking.paidAmount || 0) + paidByAthletes)) <= 0 ? 'confirmed' : 'pending',
        payments: allPayments
      });

      alert('Pagamento de quadra finalizado! ' + (remaining !== 0 ? 'O saldo foi gerado em "Em Consumo".' : ''));
      setSelectedBookingId('');
      setAthletePayments([]);
      if (remaining !== 0) setActiveTab('consumption');
    } catch (error) { console.error(error); }
  };

  const [isSessionInfoExpanded, setIsSessionInfoExpanded] = useState(false);

  return (
    <div className="h-full w-full max-w-none 2xl:max-w-[2100px] mx-auto min-h-0 flex-1 flex bg-[#FAFAFA] dark:bg-black lg:overflow-hidden lg:h-[calc(100vh-80px)] text-sm">
      {/* Sidebar PDV - Left Navigation */}
      <aside className="hidden lg:flex w-16 xl:w-20 flex-col items-center py-6 gap-6 border-r border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 shrink-0">
        <div className="flex flex-col gap-3 w-full px-2">
          {[
            { id: 'sale', icon: ShoppingCart, label: 'VENDA' },
            { id: 'consumption', icon: Coffee, label: 'COMANDAS', count: openTabs.length },
            { id: 'court-payment', icon: Calendar, label: 'QUADRA' },
            { id: 'history', icon: History, label: 'HISTÓRICO' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex flex-col items-center justify-center py-3 rounded-xl transition-all gap-1.5 relative group",
                activeTab === item.id 
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg scale-105" 
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900"
              )}
            >
              <item.icon size={20} className={cn("transition-transform duration-500", activeTab === item.id && "scale-110")} />
              <span className="text-[7px] font-black tracking-widest uppercase">{item.label}</span>
              {item.count ? (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-black animate-pulse shadow-md">
                  {item.count}
                </span>
              ) : null}
              
              {/* Active Indicator Dot */}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-nav-dot"
                  className="absolute -right-1.5 w-0.5 h-6 bg-zinc-900 dark:bg-white rounded-l-full"
                />
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative h-full">
        {/* Sticky Header Section */}
        <div className="shrink-0 bg-[#FAFAFA] dark:bg-black z-20 px-4 md:px-6 pt-2 md:pt-3 pb-1 space-y-2">
          {/* Mobile Navigation Tabs (Only visible on mobile) */}
          <div className="lg:hidden flex overflow-x-auto no-scrollbar bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 w-full gap-1 shadow-sm">
            <button 
              onClick={() => setActiveTab('sale')}
              className={cn(
                "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
                activeTab === 'sale' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "text-zinc-400"
              )}
            >
              <ShoppingCart size={16} /> VENDA
            </button>
            <button 
              onClick={() => setActiveTab('consumption')}
              className={cn(
                "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
                activeTab === 'consumption' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "text-zinc-400"
              )}
            >
              <Coffee size={16} /> COMANDAS
              {openTabs.length > 0 && <span className="bg-rose-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px]">{openTabs.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('court-payment')}
              className={cn(
                "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
                activeTab === 'court-payment' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "text-zinc-400"
              )}
            >
              <Calendar size={16} /> QUADRA
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
                activeTab === 'history' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "text-zinc-400"
              )}
            >
              <History size={16} /> HISTÓRICO
            </button>
          </div>

          {activeTab === 'sale' && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
               <SmartSearch<Client> 
                  label="Identificar Cliente"
                  items={clients}
                  searchFields={['name', 'phone']}
                  displayField="name"
                  value={selectedClientId}
                  onSelect={(client) => setSelectedClientId(client.id)}
                  onAddNew={() => setIsNewClientModalOpen(true)}
                  placeholder="Consumidor Balcão..."
                  compact
               />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar no cardápio..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 h-10 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 outline-none focus:ring-1 ring-zinc-500/10 dark:text-white text-[11px] font-bold uppercase tracking-tight"
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 h-10 px-4 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <Filter size={12} className="text-zinc-400 shrink-0" />
                    <select 
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest dark:text-white cursor-pointer w-full leading-none appearance-none"
                    >
                      <option value="all">TODAS CATEGORIAS</option>
                      {categories.filter(c => c.type === 'product').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    <ChevronDown size={10} className="text-zinc-400 shrink-0" />
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 md:px-6 pb-24">
          {activeTab === 'sale' ? (
            <div className="flex flex-col gap-2.5 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                {sortedProducts.map((product) => {
                  const isTopSeller = topSellers.some(ts => ts.id === product.id);
                  return (
                    <motion.div 
                      key={product.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addToCart(product)}
                      className="bg-white dark:bg-zinc-900 p-2 rounded-xl shadow-sm border border-zinc-50 dark:border-zinc-800 cursor-pointer hover:shadow-md transition-all group overflow-hidden relative"
                    >
                      {isTopSeller && (
                        <div className="absolute top-1 right-1 z-10 bg-emerald-500 text-white p-0.5 rounded shadow-sm" title="Mais vendido do mês">
                          <TrendingUp size={7} />
                        </div>
                      )}
                      <div className="aspect-square bg-zinc-50 dark:bg-zinc-800 rounded-lg mb-1 flex items-center justify-center text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-900 transition-all duration-500">
                        <Package size={14} />
                      </div>
                      <h3 className="font-black dark:text-white truncate uppercase text-[7px] tracking-tight italic leading-tight">{product.name}</h3>
                      <div className="flex flex-col mt-0.5">
                        <span className={cn("text-[5px] font-black uppercase tracking-widest px-1 py-0.5 rounded-sm w-fit mb-0.5", product.stock < 5 ? "bg-rose-100 text-rose-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>Stk: {product.stock}</span>
                        <span className="text-blue-600 dark:text-blue-400 font-mono font-black text-[9px]">R$ {product.price}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'consumption' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {openTabs.map((tab) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={tab.id}
                    className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all relative group overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-900 transition-all duration-500">
                          <Coffee size={18} />
                        </div>
                        <div>
                          <h4 className="text-base font-black dark:text-white uppercase tracking-tighter italic leading-none">{tab.label}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">
                            <Clock size={10} /> {format(new Date(tab.openedAt), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto no-scrollbar">
                      {tab.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] dark:text-white">
                          <span className="font-bold opacity-60 uppercase italic tracking-tight">{item.quantity}x {item.product.name}</span>
                          <span className="font-mono font-black">R$ {item.product.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-zinc-50 dark:border-zinc-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest italic">Total</span>
                        <span className="text-2xl font-black dark:text-white text-blue-600 italic">R$ {tab.items.reduce((acc, i) => acc + (i.product.price * i.quantity), 0)}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        {payingTabId === tab.id ? (
                          <div className="flex-1 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-1.5">
                               {paymentMethods.map(m => (
                                 <motion.button 
                                   key={m.id}
                                   whileHover={{ scale: 1.02 }}
                                   whileTap={{ scale: 0.98 }}
                                   onClick={() => handleCheckout(false, tab, m.id)}
                                   className="py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md"
                                 >
                                   {m.name}
                                 </motion.button>
                               ))}
                            </div>
                            <button 
                              onClick={() => setPayingTabId(null)}
                              className="w-full text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors py-1"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => setPayingTabId(tab.id)}
                              className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              Pagar
                            </button>
                            {tab.clientId && (
                              <button 
                                onClick={() => handleCheckout(true, tab)}
                                className="px-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-100 transition-all"
                                title="Lançar na Conta Corrente"
                              >
                                CC
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : activeTab === 'court-payment' ? (
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-sm font-black mb-4 dark:text-white flex items-center gap-2">
                    <Calendar className="text-zinc-400" size={16} /> Aluguéis de Hoje
                  </h3>
                  <div className="space-y-2">
                    {todayBookings.filter(b => b.status !== 'cancelled').map(booking => (
                      <button 
                        key={booking.id}
                        onClick={() => {
                          setSelectedBookingId(booking.id);
                          setAthletePayments([]);
                        }}
                        className={cn(
                          "w-full p-3 rounded-xl border text-left transition-all group",
                          selectedBookingId === booking.id
                            ? "bg-zinc-900 border-zinc-900 shadow-lg dark:bg-white"
                            : "bg-zinc-50 border-zinc-100 hover:border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                        )}
                      >
                         <div className="flex justify-between items-center">
                            <div>
                               <p className={cn("text-[10px] font-black uppercase tracking-tighter italic leading-none", selectedBookingId === booking.id ? "text-white dark:text-zinc-900" : "dark:text-white")}>{booking.customerName}</p>
                               <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-1", selectedBookingId === booking.id ? "text-zinc-400" : "text-zinc-500")}>
                                 {format(new Date(booking.startTime), 'HH:mm')} - {format(new Date(booking.endTime), 'HH:mm')}
                               </p>
                            </div>
                            <span className={cn("font-mono font-black text-xs", selectedBookingId === booking.id ? "text-white dark:text-zinc-900" : "text-blue-600")}>R$ {booking.totalPrice}</span>
                         </div>
                      </button>
                    ))}
                    {todayBookings.length === 0 && <p className="text-center text-zinc-400 italic py-6 text-[10px]">Nenhum agendamento para hoje.</p>}
                  </div>
                </div>
              </div>

              {selectedBookingId && (
                <div className="space-y-4 animate-in slide-in-from-right-10 duration-500">
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-lg">
                    {(() => {
                      const booking = todayBookings.find(b => b.id === selectedBookingId);
                      const paidByAthletes = athletePayments.reduce((acc, p) => acc + p.value, 0);
                      const remaining = (booking?.totalPrice || 0) - paidByAthletes;

                      return (
                        <>
                           <header className="mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-end">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Responsável</p>
                                <h3 className="text-2xl font-black dark:text-white italic tracking-tighter uppercase">{booking?.customerName}</h3>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</p>
                                <p className="text-3xl font-black text-blue-600 italic leading-none">R$ {booking?.totalPrice}</p>
                              </div>
                           </header>

                           <div className="space-y-6">
                             <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 ml-1">Pagamento por Atleta</h4>
                                <div className="space-y-3">
                                   <div className="flex gap-2">
                                      <input 
                                        placeholder="Nome do Atleta"
                                        value={newAthlete.name}
                                        onChange={e => setNewAthlete({...newAthlete, name: e.target.value})}
                                        className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none dark:text-white text-[11px] font-bold"
                                      />
                                      <input 
                                        type="number"
                                        placeholder="R$"
                                        value={newAthlete.value || ''}
                                        onChange={e => setNewAthlete({...newAthlete, value: Number(e.target.value)})}
                                        className="w-24 px-3 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none dark:text-white text-[12px] font-mono font-bold"
                                      />
                                   </div>
                                   <div className="flex gap-2">
                                      <select 
                                        value={newAthlete.paymentMethodId}
                                        onChange={e => setNewAthlete({...newAthlete, paymentMethodId: e.target.value})}
                                        className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none dark:text-white text-[10px] font-black uppercase tracking-widest"
                                      >
                                         {paymentMethods.map(m => <option key={m.id} value={m.id} className="text-[12px]">{m.name}</option>)}
                                      </select>
                                      <button 
                                        onClick={() => {
                                          if (newAthlete.name && newAthlete.value > 0) {
                                            setAthletePayments([...athletePayments, newAthlete]);
                                            setNewAthlete({ ...newAthlete, name: '', value: 0 });
                                          }
                                        }}
                                        className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 rounded-xl hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest shadow-md"
                                      >
                                        Add
                                      </button>
                                   </div>
                                </div>
                             </div>
     </div>

                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                              {athletePayments.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                   <div>
                                      <span className="font-black dark:text-white uppercase text-[9px] italic tracking-tight">{p.name}</span>
                                      <p className="text-[6px] font-black uppercase tracking-widest text-zinc-400">
                                        {paymentMethodToName(p.paymentMethodId)}
                                      </p>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="font-mono font-black text-emerald-600 text-[10px]">R$ {p.value}</span>
                                      <button onClick={() => setAthletePayments(athletePayments.filter((_, i) => i !== idx))} className="text-zinc-300 hover:text-rose-500 transition-colors"><X size={10} /></button>
                                   </div>
                                </div>
                              ))}
                            </div>

                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                               <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest italic">Restante</span>
                                  <span className={cn("text-2xl font-black italic", remaining > 0 ? "text-rose-600" : "text-emerald-500")}>R$ {remaining}</span>
                               </div>

                               <div className="grid grid-cols-3 gap-1.5">
                                  <button 
                                    onClick={handleSaveCourtProgress}
                                    className="py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[7px] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <Save size={14} /> Salvar
                                  </button>
                                  <button 
                                    onClick={() => handleCancelBooking(booking)}
                                    className="py-3.5 bg-rose-50 text-rose-500 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <X size={14} /> Cancelar
                                  </button>
                                  <button 
                                    onClick={handleFinishCourtPayment}
                                    className="py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <CheckCircle2 size={14} /> Finalizar
                                  </button>
                               </div>
                            </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
             <div className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 block">Data do Evento</label>
                      <input 
                        type="date"
                        value={histDate}
                        onChange={e => setHistDate(e.target.value)}
                        className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-all text-sm font-bold dark:text-white"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 block">Dia da Semana</label>
                      <select 
                        value={histDayOfWeek}
                        onChange={e => setHistDayOfWeek(e.target.value)}
                        className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-all text-[10px] font-black uppercase tracking-widest dark:text-white"
                      >
                        <option value="">Todos</option>
                        <option value="segunda-feira">Segunda</option>
                        <option value="terça-feira">Terça</option>
                        <option value="quarta-feira">Quarta</option>
                        <option value="quinta-feira">Quinta</option>
                        <option value="sexta-feira">Sexta</option>
                        <option value="sábado">Sábado</option>
                        <option value="domingo">Domingo</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 block">Responsável</label>
                      <input 
                        type="text"
                        placeholder="Buscar..."
                        value={histClientName}
                        onChange={e => setHistClientName(e.target.value)}
                        className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-all text-sm font-bold dark:text-white"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 block">Atleta</label>
                      <input 
                        type="text"
                        placeholder="Buscar..."
                        value={histAthleteName}
                        onChange={e => setHistAthleteName(e.target.value)}
                        className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-all text-sm font-bold dark:text-white"
                      />
                   </div>
                </div>
                <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/10 p-3 md:p-4 rounded-2xl">
                   <div className="flex gap-3 items-center w-full">
                      <div className="flex-1 max-w-sm">
                         <SmartSearch<Client> 
                           label="Cliente do Sistema"
                           items={clients}
                           searchFields={['name']}
                           displayField="name"
                           value={selectedHistoryClientId}
                           onSelect={(c) => setSelectedHistoryClientId(c.id)}
                           onAddNew={() => {}}
                           placeholder="Todos"
                           compact
                         />
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedHistoryClientId('');
                          setHistDate('');
                          setHistDayOfWeek('');
                          setHistClientName('');
                          setHistAthleteName('');
                        }}
                        className="p-3 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all mt-4"
                       >
                        Limpar Filtros
                      </button>
                   </div>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 no-scrollbar">
                {todayBookings
                  .filter(b => {
                    const matchesClient = !selectedHistoryClientId || b.clientId === selectedHistoryClientId;
                    const matchesDate = !histDate || format(new Date(b.startTime), 'yyyy-MM-dd') === histDate;
                    const matchesDay = !histDayOfWeek || format(new Date(b.startTime), 'EEEE', { locale: ptBR }).toLowerCase() === histDayOfWeek;
                    const matchesClientName = !histClientName || b.customerName.toLowerCase().includes(histClientName.toLowerCase());
                    const matchesAthlete = !histAthleteName || (b.payments || []).some(p => p.playerName?.toLowerCase().includes(histAthleteName.toLowerCase()));
                    return matchesClient && matchesDate && matchesDay && matchesClientName && matchesAthlete;
                  })
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                  .map((booking) => {
                    const isExpanded = expandedBookingId === booking.id;
                    return (
                      <div key={booking.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                         <div className="p-3 flex justify-between items-center group cursor-pointer" onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}>
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                  <Calendar size={18} />
                               </div>
                               <div>
                                  <h4 className="text-base font-black dark:text-white uppercase tracking-tighter italic leading-none">{booking.customerName}</h4>
                                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mt-1.5">
                                    {format(new Date(booking.startTime), 'EEEE, dd/MM/yyyy', { locale: ptBR })} • {format(new Date(booking.startTime), 'HH:mm')}
                                  </p>
                               </div>
                            </div>
                            <div className="flex items-center gap-6">
                               <div className="text-right flex items-center gap-4">
                                  {booking.status === 'cancelled' && (
                                    <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                                      Cancelado
                                    </span>
                                  )}
                                  <div>
                                     <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Total</p>
                                     <p className="font-mono font-black text-sm dark:text-white">R$ {booking.totalPrice}</p>
                                  </div>
                               </div>
                               {isExpanded ? <ChevronUp size={14} className="text-zinc-300" /> : <ChevronDown size={14} className="text-zinc-300" />}
                            </div>
                         </div>

                         <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden border-t border-zinc-50 dark:border-zinc-800"
                              >
                                 <div className="p-8 space-y-6">
                                    <div className="flex justify-between items-center">
                                       <h5 className="text-[12px] font-black uppercase tracking-[0.2em] text-zinc-400">Detalhamento dos Pagamentos</h5>
                                       <div className="flex gap-2">
                                          {booking.status !== 'cancelled' && (
                                            <button 
                                              onClick={() => handleCancelBooking(booking)}
                                              className="px-4 py-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all mr-2"
                                            >
                                              <X size={14} /> Cancelar Reserva
                                            </button>
                                          )}
                                          <button 
                                            onClick={() => handleDownloadPDF(booking)}
                                            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                          >
                                            <Download size={14} /> Baixar PDF
                                          </button>
                                          <button 
                                            onClick={() => handlePrintReport(booking)}
                                            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                                          >
                                            <Printer size={14} /> Imprimir
                                          </button>
                                       </div>
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-zinc-800/20 rounded-xl overflow-hidden">
                                       <table className="w-full text-left text-[9px]">
                                          <thead>
                                             <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                                <th className="p-1.5 font-black uppercase text-[7px] tracking-widest text-zinc-400">Data/Hora</th>
                                                <th className="p-1.5 font-black uppercase text-[7px] tracking-widest text-zinc-400">Atleta</th>
                                                <th className="p-1.5 font-black uppercase text-[7px] tracking-widest text-zinc-400">Forma Pagto</th>
                                                <th className="p-1.5 font-black uppercase text-[7px] tracking-widest text-zinc-400 text-right">Valor</th>
                                             </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                             {(booking.payments || []).map(p => (
                                               <tr key={p.id}>
                                                  <td className="p-1.5 font-medium dark:text-zinc-400">{format(new Date(p.timestamp), 'dd/MM HH:mm')}</td>
                                                  <td className="p-1.5 font-black dark:text-white uppercase italic">{p.playerName || '---'}</td>
                                                  <td className="p-1.5">
                                                     <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-700">
                                                        {p.method}
                                                     </span>
                                                  </td>
                                                  <td className="p-1.5 text-right font-mono font-black text-emerald-600">R$ {p.amount}</td>
                                               </tr>
                                             ))}
                                          </tbody>
                                       </table>
                                    </div>
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
        </div>
      </div>

      {/* Right Column: Shopping Cart (Integrated Checkout) */}
      <div className={cn(
        "hidden w-[260px] xl:w-[300px] bg-white dark:bg-zinc-950 border-l border-zinc-100 dark:border-zinc-900 flex-col min-h-0 shrink-0 transition-all duration-700 animate-in slide-in-from-right-full backdrop-blur-3xl",
        activeTab === 'sale' ? "lg:flex" : "lg:hidden"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Cart Header */}
          <header className="p-3 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-900 shrink-0">
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-zinc-900 dark:bg-white rounded-md flex items-center justify-center text-white dark:text-zinc-900 shadow-lg">
                    <ShoppingCart size={10} />
                  </div>
                  <h3 className="text-[9px] font-black dark:text-white uppercase tracking-[0.15em] italic">Checkout</h3>
                </div>
                <div className="bg-rose-500 text-white px-1.5 py-0.5 rounded-md text-[6px] font-black italic animate-pulse">
                  AO VIVO
                </div>
             </div>

             <div className="space-y-1.5">
                <div 
                  onClick={() => setIsSessionInfoExpanded(!isSessionInfoExpanded)}
                  className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-200"
                >
                   <div className="flex justify-between items-center">
                      <p className="text-[7px] font-black uppercase text-zinc-400 tracking-widest italic">Ponto de Venda</p>
                      <div className="text-zinc-300">
                        {isSessionInfoExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </div>
                   </div>
                   <p className="font-black text-[10px] dark:text-white mt-0.5 uppercase italic leading-none">{tabLabel || 'BALCÃO'}</p>
                </div>

                <AnimatePresence>
                  {isSessionInfoExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                       <input 
                         type="text" 
                         placeholder="Ex: Mesa 04..."
                         value={tabLabel}
                         onChange={(e) => setTabLabel(e.target.value)}
                         className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 p-2 rounded-lg text-[9px] font-black uppercase tracking-tight italic outline-none focus:ring-1 ring-blue-500/20 dark:text-white mb-2"
                       />
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </header>

          {/* Cart Body (Items) */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
             {cart.map((item, i) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className="flex justify-between items-center bg-white dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-50 dark:border-zinc-900 shadow-sm group hover:border-zinc-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-700">
                       <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 px-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900"><Plus size={8} /></button>
                       <span className="font-black text-[10px] px-2 py-0.5 bg-white dark:bg-zinc-900 dark:text-white leading-none">{item.quantity}</span>
                       <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 px-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900"><Minus size={8} /></button>
                    </div>
                    <div>
                      <p className="font-black text-[10px] dark:text-white uppercase tracking-tight italic leading-tight truncate max-w-[100px]">{item.product.name}</p>
                      <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">R$ {item.product.price}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black dark:text-white text-[12px] text-blue-600 italic">R$ {item.product.price * item.quantity}</span>
                    <button 
                      onClick={() => setCart(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
             ))}
 
             {committedCourtShares.map((share) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={share.id} 
                  className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/5 p-1.5 rounded-lg border border-blue-100/50 dark:border-blue-900/10 shadow-sm group"
                >
                   <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center text-blue-600 shadow-sm">
                         <Calendar size={10} />
                      </div>
                      <div>
                         <p className="font-black text-[8px] dark:text-white uppercase italic leading-tight truncate max-w-[80px]">Rateio: {share.athleteName || 'Final'}</p>
                         <p className="text-[6px] text-blue-500 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[80px]">Ref: {todayBookings.find(b => b.id === share.bookingId)?.customerName}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-blue-600 text-[10px]">R$ {share.amount}</span>
                      <button onClick={() => setCommittedCourtShares(prev => prev.filter(s => s.id !== share.id))} className="opacity-0 group-hover:opacity-100 p-0.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-all"><Trash2 size={10} /></button>
                   </div>
                </motion.div>
             ))}
 
             {(cart.length === 0 && committedCourtShares.length === 0) && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-200 dark:text-zinc-800 opacity-50 space-y-2 py-10 grayscale">
                  <ShoppingCart size={40} strokeWidth={1} />
                  <p className="font-black text-[8px] uppercase tracking-[0.3em] text-zinc-400">Vazio</p>
                </div>
             )}
          </div>

               <footer className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900 space-y-3 shrink-0">
             <div className="space-y-2">
                <header className="flex justify-between items-center px-1">
                   <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest italic">Pagamento</p>
                </header>
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                   {paymentMethods.map(method => (
                     <button 
                       key={method.id}
                       onClick={() => setSelectedPaymentMethod(method.id)}
                       className={cn(
                         "px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all truncate",
                         selectedPaymentMethod === method.id 
                           ? "bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md" 
                           : "bg-white border-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800"
                       )}
                     >
                       {method.name}
                     </button>
                   ))}
                </div>
             </div>

             <div className="pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50">
               <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-zinc-400 font-black uppercase tracking-widest text-[10px] italic leading-none">Total</span>
                  <span className="font-mono text-2xl font-black dark:text-white text-zinc-900 italic tracking-tighter leading-none">R$ {total}</span>
               </div>
               
               <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                      <button 
                        disabled={cart.length === 0 && committedCourtShares.length === 0}
                        onClick={() => handleCreateTab()}
                        className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-300 transition-all disabled:opacity-20 active:scale-95 shadow-sm"
                      >
                        <Coffee size={14} /> COMANDA
                      </button>
                      <button 
                         disabled={cart.length === 0 && committedCourtShares.length === 0}
                         onClick={() => handleCheckout(false)}
                         className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-20"
                      >
                        <CheckCircle2 size={14} /> PAGAR
                      </button>
                  </div>
                  <button 
                    disabled={!selectedClientId || (cart.length === 0 && committedCourtShares.length === 0)}
                    onClick={() => handleCheckout(true)}
                    className="w-full text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 dark:hover:text-white transition-all disabled:opacity-0 py-1 flex items-center justify-center gap-1.5"
                  >
                    <CircleDot size={8} className="text-emerald-500 animate-pulse" />
                    Lançar Conta Corrente
                  </button>
               </div>
            </div>
          </footer>
        </div>
      </div>

       <AnimatePresence>
        {isNewClientModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800"
              >
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-2xl font-black dark:text-white uppercase tracking-tighter italic">Novo Cliente</h4>
                  <button onClick={() => setIsNewClientModalOpen(false)} className="text-zinc-400 hover:text-rose-500"><X size={24}/></button>
                </div>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nome Completo</label>
                    <input 
                      autoFocus
                      placeholder="Ex: João Silva" 
                      value={newClientData.name} onChange={e => setNewClientData({...newClientData, name: e.target.value})}
                      className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none dark:text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Telefone</label>
                    <input 
                      placeholder="(00) 00000-0000" 
                      value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: e.target.value})}
                      className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl outline-none dark:text-white text-sm"
                    />
                  </div>
                  <button 
                    onClick={handleCreateClient}
                    className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                  >
                    Cadastrar e Selecionar
                  </button>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
