import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy, Timestamp } from '@/lib/dataApi';
import { db } from '@/lib/dataApi';
import { Transaction, Client, FixedExpense, Category, PaymentMethod } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Calendar, 
  User, 
  Filter, 
  ChevronRight,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit2
} from 'lucide-react';
import { cn, formatPhone } from '../lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Finance = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'pendencies' | 'fixed' | 'categories'>('overview');
  const [liquidatingClient, setLiquidatingClient] = useState<Client | null>(null);
  const [liquidatePaymentMethodId, setLiquidatePaymentMethodId] = useState<string>('');
  
  // Advanced Transaction Entry
  const [transData, setTransData] = useState<{
    type: 'income' | 'expense', 
    expenseType: 'fixed' | 'avulso',
    amount: number, 
    description: string,
    categoryId: string,
    dueDate?: string,
    installments?: number,
    entityName?: string,
    alertActive?: boolean
  }>({
    type: 'income',
    expenseType: 'avulso',
    amount: 0,
    description: '',
    categoryId: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    installments: 1,
    entityName: '',
    alertActive: false
  });

  // Movement Filters
  const [moveFilter, setMoveFilter] = useState<'today' | '7d' | '15d' | '30d' | 'month' | 'year' | 'all'>('all');
  const [moveDateRange, setMoveDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });

  useEffect(() => {
    const tUnsub = onSnapshot(collection(db, 'transactions'), (s) => 
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)))
    );
    const cUnsub = onSnapshot(collection(db, 'clients'), (s) => 
      setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)))
    );
    const fUnsub = onSnapshot(collection(db, 'fixedExpenses'), (s) => 
      setFixedExpenses(s.docs.map(d => ({ id: d.id, ...d.data() } as FixedExpense)))
    );
    const catUnsub = onSnapshot(collection(db, 'categories'), (s) => 
      setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as Category)))
    );
    const payUnsub = onSnapshot(collection(db, 'paymentMethods'), (s) => {
      const methods = s.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(m => m.isActive);
      setPaymentMethods(methods);
      if (methods.length > 0) setLiquidatePaymentMethodId(methods[0].id);
    });
    const setUnsub = onSnapshot(collection(db, 'settings'), (s) => {
      // Mock or actual settings if needed
    });
    return () => { tUnsub(); cUnsub(); fUnsub(); catUnsub(); payUnsub(); setUnsub(); };
  }, []);

  const handlePendenciesReport = (client: Client) => {
    const doc = new jsPDF();
    const clientDebts = transactions.filter(t => t.clientId === client.id && t.status === 'pending');
    
    doc.setFontSize(22);
    doc.text('ArenaHub - Extrato de Pendências', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Cliente: ${client.name}`, 14, 35);
    doc.text(`Telefone: ${formatPhone(client.phone)}`, 14, 40);
    doc.text(`Saldo Devedor Atual: R$ ${Math.abs(client.balance || 0)}`, 14, 45);

    const tableData = clientDebts.map(t => [
      format(parseISO(t.timestamp), 'dd/MM/yyyy HH:mm'),
      t.description,
      `R$ ${t.amount}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Data/Hora', 'Descricao', 'Valor']],
      body: tableData,
      theme: 'grid'
    });

    doc.save(`extrato-pendencias-${client.name}.pdf`);
  };

  // Stats Logic
  const currentMonthDate = new Date();
  const lastMonthDate = subMonths(currentMonthDate, 1);

  const calculateMonthStats = (date: Date) => {
    const monthTransactions = transactions.filter(t => isSameMonth(parseISO(t.timestamp), date));
    const revenue = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { revenue, expenses, profit: revenue - expenses };
  };

  const currentStats = calculateMonthStats(currentMonthDate);
  const lastStats = calculateMonthStats(lastMonthDate);

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const pendencies = clients.filter(c => (c.balance || 0) < 0);
  const totalPendencies = Math.abs(pendencies.reduce((acc, c) => acc + (c.balance || 0), 0));

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter dark:text-white">Financeiro</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-serif italic text-sm md:text-base">Gestão de fluxo de caixa, pendências e despesas fixas.</p>
        </div>
        <div className="flex overflow-x-auto no-scrollbar bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 w-full xl:w-auto gap-1">
          {(['overview', 'pendencies', 'fixed', 'categories'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xl" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              )}
            >
              {tab === 'overview' ? 'Resumo' : tab === 'pendencies' ? 'Pendências' : tab === 'fixed' ? 'Controle Financeiro' : 'Categorias'}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Main Stats */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {[
              { label: 'Receita Mensal', value: currentStats.revenue, trend: getTrend(currentStats.revenue, lastStats.revenue), color: 'blue' },
              { label: 'Despesas Mensal', value: currentStats.expenses, trend: getTrend(currentStats.expenses, lastStats.expenses), color: 'rose' },
              { label: 'Lucro Líquido', value: currentStats.profit, trend: getTrend(currentStats.profit, lastStats.profit), color: 'emerald' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group"
              >
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">{stat.label}</p>
                  <h3 className="text-4xl font-black dark:text-white mb-4">R$ {stat.value.toLocaleString()}</h3>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                    stat.trend >= 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20"
                  )}>
                    {stat.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(stat.trend).toFixed(1)}% vs mês ant.
                  </div>
                </div>
                <div className={cn("absolute -bottom-10 -right-10 w-40 h-40 bg-zinc-100 dark:bg-zinc-800 rounded-full group-hover:scale-110 transition-transform")} />
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
               <h3 className="text-xl font-black mb-8 dark:text-white flex items-center gap-2">
                 <TrendingUp className="text-zinc-400" size={20} /> Comparativo de Fluxo
               </h3>
               <div className="h-[400px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={[
                     { name: 'Mês Passado', income: lastStats.revenue, expense: lastStats.expenses },
                     { name: 'Este Mês', income: currentStats.revenue, expense: currentStats.expenses },
                   ]}>
                     <defs>
                       <linearGradient id="incomeCol" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="expenseCol" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#A1A1AA', fontWeight: 'bold'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#A1A1AA', fontWeight: 'bold'}} />
                     <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }} />
                     <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} fill="url(#incomeCol)" />
                     <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={4} fill="url(#expenseCol)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="space-y-6">
              <div className="bg-zinc-950 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Contas a Receber</p>
                   <h3 className="text-4xl font-black mb-6">R$ {totalPendencies.toLocaleString()}</h3>
                   <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                     <AlertCircle size={14} /> {pendencies.length} Clientes com pendências
                   </div>
                   <button 
                    onClick={() => setActiveTab('pendencies')}
                    className="mt-8 w-full py-4 bg-white text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                   >
                     Ver Pendências
                   </button>
                </div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-zinc-800 rounded-full blur-3xl opacity-50" />
              </div>

               <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-black mb-6 dark:text-white">Próximas Contas</h3>
                <div className="space-y-4">
                  {fixedExpenses.slice(0, 3).map((exp, i) => (
                    <div key={exp.id} className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                      <div>
                        <p className="font-bold text-sm dark:text-white">{exp.name}</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">Todo dia {exp.dayOfMonth}</p>
                      </div>
                      <span className="font-mono font-black text-rose-500 text-sm">R$ {exp.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pendencies' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <table className="w-full">
               <thead>
                 <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                   <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Cliente</th>
                   <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Dívida Total</th>
                   <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Ações</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                 {pendencies.map(client => (
                   <tr key={client.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/10 transition-colors group">
                     <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 font-bold uppercase">
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold dark:text-white">{client.name}</p>
                        <p className="text-xs text-zinc-500">{formatPhone(client.phone)}</p>
                          </div>
                        </div>
                     </td>
                     <td className="p-6">
                       <span className="font-mono font-black text-rose-600">R$ {Math.abs(client.balance || 0).toLocaleString()}</span>
                     </td>
                     <td className="p-6 text-right space-x-3">
                        <button 
                          onClick={() => handlePendenciesReport(client)}
                          className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl hover:text-zinc-900 dark:hover:text-white transition-all inline-flex items-center"
                          title="Ver Extrato"
                        >
                          <Filter size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setLiquidatingClient(client);
                            if (paymentMethods.length > 0) setLiquidatePaymentMethodId(paymentMethods[0].id);
                          }}
                          className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                        >
                          Pagar
                        </button>
                     </td>
                   </tr>
                 ))}
                 {pendencies.length === 0 && (
                   <tr>
                     <td colSpan={3} className="p-20 text-center text-zinc-400 italic">Nenhuma conta pendente. Excelente!</td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {activeTab === 'fixed' && (
        <div className="space-y-8">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Left: Quick Actions & Forms */}
             <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                   <h3 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tighter italic">Nova Movimentação</h3>
                   <div className="space-y-6">
                      {/* Movement Type Toggle */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                         <button 
                           onClick={() => setTransData({...transData, type: 'income'})}
                           className={cn(
                             "p-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all",
                             transData.type === 'income' ? "bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm" : "text-zinc-400"
                           )}
                         >
                           <TrendingUp size={14} /> Receita
                         </button>
                         <button 
                           onClick={() => setTransData({...transData, type: 'expense'})}
                           className={cn(
                             "p-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all",
                             transData.type === 'expense' ? "bg-white dark:bg-zinc-700 text-rose-600 shadow-sm" : "text-zinc-400"
                           )}
                         >
                           <TrendingDown size={14} /> Despesa
                         </button>
                      </div>

                      {/* Sub-type selection for Expense */}
                      {transData.type === 'expense' && (
                        <div className="grid grid-cols-2 gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                           <button 
                             onClick={() => setTransData({...transData, expenseType: 'avulso'})}
                             className={cn(
                               "py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                               transData.expenseType === 'avulso' ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-50 text-zinc-400"
                             )}
                           >
                             Despesa Avulsa
                           </button>
                           <button 
                             onClick={() => setTransData({...transData, expenseType: 'fixed'})}
                             className={cn(
                               "py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                               transData.expenseType === 'fixed' ? "bg-blue-600 text-white" : "bg-zinc-50 text-zinc-400"
                             )}
                           >
                             Despesa Fixa
                           </button>
                        </div>
                      )}

                      {/* Form Fields */}
                      <div className="space-y-4">
                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Descrição</label>
                           <input 
                             type="text" 
                             placeholder="Ex: Aluguel da Arena, Conta de Luz..." 
                             value={transData.description}
                             onChange={(e) => setTransData({...transData, description: e.target.value})}
                             className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl text-xs outline-none border border-zinc-100 dark:border-zinc-700 focus:ring-4 ring-blue-500/5 transition-all font-bold dark:text-white" 
                           />
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Valor</label>
                               <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-zinc-400">R$</span>
                                  <input 
                                    type="number" 
                                    placeholder="0,00" 
                                    value={transData.amount || ''}
                                    onChange={(e) => setTransData({...transData, amount: Number(e.target.value)})}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 pl-10 rounded-xl text-xs outline-none font-mono font-black border border-zinc-100 dark:border-zinc-700 transition-all dark:text-white" 
                                  />
                               </div>
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Categoria</label>
                               <select 
                                 value={transData.categoryId}
                                 onChange={(e) => setTransData({...transData, categoryId: e.target.value})}
                                 className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl text-xs outline-none border border-zinc-100 dark:border-zinc-700 font-bold dark:text-white"
                               >
                                  <option value="">Geral</option>
                                  {categories.filter(c => c.type === 'transaction').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                               </select>
                            </div>
                         </div>

                         {/* Fixed Expense Specific Fields */}
                         {transData.type === 'expense' && transData.expenseType === 'fixed' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Vencimento</label>
                                    <input 
                                      type="date"
                                      value={transData.dueDate}
                                      onChange={e => setTransData({...transData, dueDate: e.target.value})}
                                      className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl text-[10px] uppercase font-black outline-none border border-zinc-100 dark:border-zinc-700 dark:text-white"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Repetir (Meses)</label>
                                    <input 
                                      type="number"
                                      placeholder="Ex: 12"
                                      value={transData.installments}
                                      onChange={e => setTransData({...transData, installments: Number(e.target.value)})}
                                      className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl text-xs font-bold outline-none border border-zinc-100 dark:border-zinc-700 dark:text-white"
                                    />
                                  </div>
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Nome da Entidade/Fornecedor</label>
                                  <input 
                                    type="text" 
                                    placeholder="Ex: Companhia Elétrica" 
                                    value={transData.entityName}
                                    onChange={(e) => setTransData({...transData, entityName: e.target.value})}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl text-xs outline-none border border-zinc-100 dark:border-zinc-700 focus:ring-4 ring-blue-500/5 transition-all font-bold dark:text-white" 
                                  />
                               </div>
                               <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                  <div className="flex items-center gap-3">
                                     <AlertCircle size={16} className="text-blue-500" />
                                     <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Ativar Alerta de Lembrete</span>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => setTransData({...transData, alertActive: !transData.alertActive})}
                                    className={cn(
                                       "w-12 h-6 rounded-full relative transition-all duration-300",
                                       transData.alertActive ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
                                    )}
                                  >
                                     <div className={cn(
                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                                        transData.alertActive ? "right-1" : "left-1"
                                     )} />
                                  </button>
                               </div>
                            </div>
                         )}

                         <button 
                           onClick={async () => {
                             if (!transData.description || !transData.amount) return alert('Preencha descrição e valor!');
                             try {
                               // Record Transaction
                               await addDoc(collection(db, 'transactions'), {
                                 type: transData.type,
                                 amount: transData.amount,
                                 description: transData.description,
                                 categoryId: transData.categoryId,
                                 timestamp: new Date().toISOString(),
                                 status: transData.type === 'income' ? 'paid' : (transData.expenseType === 'fixed' ? 'pending' : 'paid'),
                                 entityName: transData.entityName || '',
                                 dueDate: transData.dueDate || '',
                                 isFixed: transData.type === 'expense' && transData.expenseType === 'fixed'
                               });

                               // If it's a fixed expense, we might want to also save to fixedExpenses collection for reference
                               if (transData.type === 'expense' && transData.expenseType === 'fixed') {
                                  await addDoc(collection(db, 'fixedExpenses'), {
                                    name: transData.description,
                                    amount: transData.amount,
                                    dayOfMonth: new Date(transData.dueDate!).getDate(),
                                    entity: transData.entityName,
                                    alertActive: transData.alertActive
                                  });
                               }

                               setTransData({ 
                                  type: 'income', 
                                  expenseType: 'avulso', 
                                  amount: 0, 
                                  description: '', 
                                  categoryId: '',
                                  dueDate: format(new Date(), 'yyyy-MM-dd'),
                                  installments: 1,
                                  entityName: '',
                                  alertActive: false
                               });
                               alert('Movimentação registrada com sucesso!');
                             } catch (e) { console.error(e); }
                           }}
                           className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-zinc-900/10"
                         >
                           Registrar no Caixa
                         </button>
                      </div>
                   </div>
                </div>

                <div className="bg-zinc-950 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                   <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Resumo Financeiro Total</p>
                      <h3 className="text-3xl font-black text-white mb-6">R$ {(currentStats.revenue - currentStats.expenses).toLocaleString()}</h3>
                      <div className="flex items-center gap-4">
                         <div className="flex-1 p-3 bg-zinc-900 rounded-2xl">
                            <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Entradas</p>
                            <p className="text-sm font-black text-emerald-400">R$ {currentStats.revenue.toLocaleString()}</p>
                         </div>
                         <div className="flex-1 p-3 bg-zinc-900 rounded-2xl">
                            <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Saídas</p>
                            <p className="text-sm font-black text-rose-400">R$ {currentStats.expenses.toLocaleString()}</p>
                         </div>
                      </div>
                   </div>
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-zinc-800 rounded-full blur-3xl opacity-30" />
                </div>
             </div>

             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                   <div className="p-8 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                         <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter italic flex items-center gap-3">
                           <TrendingUp className="text-zinc-400" /> Movimentação de Caixa
                         </h3>
                         <div className="flex flex-wrap gap-2">
                           {[
                             { id: 'all', label: 'Todos' },
                             { id: 'today', label: 'Hoje' },
                             { id: '7d', label: '7 Dias' },
                             { id: '15d', label: '15 Dias' },
                             { id: '30d', label: '30 Dias' },
                             { id: 'month', label: 'Mensal' },
                             { id: 'year', label: 'Anual' }
                           ].map(f => (
                             <button 
                               key={f.id}
                               onClick={() => setMoveFilter(f.id as any)}
                               className={cn(
                                 "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all", 
                                 moveFilter === f.id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-lg" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                               )}
                             >
                               {f.label}
                             </button>
                           ))}
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-zinc-50 dark:bg-zinc-800/20 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Data Inicial</label>
                            <input 
                              type="date"
                              value={moveDateRange.start}
                              onChange={e => { setMoveDateRange({...moveDateRange, start: e.target.value}); setMoveFilter('all'); }}
                              className="w-full p-4 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl text-[10px] font-black dark:text-white outline-none focus:ring-4 ring-zinc-500/5 transition-all" 
                            />
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Data Final</label>
                             <input 
                               type="date"
                               value={moveDateRange.end}
                               onChange={e => { setMoveDateRange({...moveDateRange, end: e.target.value}); setMoveFilter('all'); }}
                               className="w-full p-4 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl text-[10px] font-black dark:text-white outline-none focus:ring-4 ring-zinc-500/5 transition-all" 
                             />
                         </div>
                         <div className="flex items-end">
                            <button 
                              onClick={() => setMoveDateRange({start: '', end: ''})}
                              className="w-full py-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            >
                               Limpar Filtros Customizados
                            </button>
                         </div>
                      </div>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full">
                         <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/30">
                               <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Data/Hora</th>
                               <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Detalhes</th>
                               <th className="p-6 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Fluxo</th>
                               <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {transactions
                              .filter(t => {
                                const tDate = parseISO(t.timestamp);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                
                                if (moveDateRange.start && moveDateRange.end) {
                                  const start = parseISO(moveDateRange.start);
                                  const end = parseISO(moveDateRange.end);
                                  end.setHours(23, 59, 59, 999);
                                  return tDate >= start && tDate <= end;
                                }

                                if (moveFilter === 'today') return format(tDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                if (moveFilter === '7d') return tDate >= subMonths(new Date(), 0.25);
                                if (moveFilter === '15d') return tDate >= subMonths(new Date(), 0.5);
                                if (moveFilter === '30d') return tDate >= subMonths(new Date(), 1);
                                if (moveFilter === 'month') return isSameMonth(tDate, new Date());
                                if (moveFilter === 'year') return tDate.getFullYear() === new Date().getFullYear();
                                return true;
                              })
                              .sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
                              .slice(0, 50).map(t => (
                              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/5 transition-all group">
                                 <td className="p-6">
                                    <p className="font-mono text-[10px] text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                       {format(parseISO(t.timestamp), 'dd/MM HH:mm')}
                                    </p>
                                 </td>
                                 <td className="p-6">
                                    <p className="font-bold text-xs dark:text-white truncate max-w-[250px] uppercase italic tracking-tight">{t.description}</p>
                                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{t.status === 'paid' ? 'Efetivado' : 'Aguardando'}</p>
                                 </td>
                                 <td className="p-6">
                                    <span className={cn(
                                       "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest",
                                       t.type === 'income' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                                    )}>
                                       {t.type === 'income' ? 'Entrada' : 'Saída'}
                                    </span>
                                 </td>
                                 <td className={cn("p-6 text-right font-mono font-black text-sm", t.type === 'income' ? "text-emerald-500" : "text-rose-500")}>
                                    {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString()}
                                 </td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
           </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="flex bg-zinc-50 dark:bg-zinc-800/50 p-2 border-b border-zinc-100 dark:border-zinc-800">
               {['transaction', 'product'].map((type) => (
                 <button 
                  key={type}
                  onClick={() => setTransData({ ...transData, categoryId: type === 'transaction' ? 'finance' : 'product' })} // Using a temporary state for tab switching here or add a new state
                  className={cn(
                    "px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                    (transData.categoryId === 'finance' && type === 'transaction') || (transData.categoryId === 'product' && type === 'product') ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-md" : "text-zinc-400"
                  )}
                 >
                   {type === 'transaction' ? 'Financeiro' : 'Produtos'}
                 </button>
               ))}
            </div>

            <div className="p-10 space-y-6">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black dark:text-white tracking-tighter uppercase italic">
                  Categorias {transData.categoryId === 'product' ? 'de Produtos' : 'Financeiras'}
                </h3>
                <button className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} /> Nova Categoria
                </button>
              </div>

              <div className="space-y-3">
                {categories
                  .filter(c => transData.categoryId === 'product' ? c.type === 'product' : c.type === 'transaction')
                  .map(c => (
                    <div key={c.id} className="flex justify-between items-center p-6 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-all border-b border-zinc-100 dark:border-zinc-800 last:border-0 group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400">
                          <CheckCircle2 size={18} />
                        </div>
                        <span className="font-bold dark:text-white text-lg">{c.name}</span>
                      </div>
                      <div className="flex gap-2">
                         <button className="p-3 bg-white dark:bg-zinc-900 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-sm"><Edit2 size={16} /></button>
                         <button className="p-3 bg-white dark:bg-zinc-900 rounded-xl text-rose-500 hover:bg-rose-50 shadow-sm"><XIcon size={16} /></button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {liquidatingClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md p-10 rounded-[3rem] shadow-2xl relative"
            >
              <button 
                onClick={() => setLiquidatingClient(null)} 
                className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all p-2 rounded-xl"
              >
                <XIcon size={24} />
              </button>
              
              <div className="mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Liquidar Pendência</p>
                <h3 className="text-3xl font-black dark:text-white tracking-tighter uppercase italic">{liquidatingClient.name}</h3>
              </div>
              
              <div className="space-y-6">
                <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Devedor</p>
                  <p className="text-4xl font-black text-rose-500 font-mono italic">
                    R$ {Math.abs(liquidatingClient.balance || 0).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Forma de Pagamento</label>
                   <div className="grid grid-cols-2 gap-3">
                      {paymentMethods.filter(m => m.type !== 'account').map(method => (
                        <button
                          key={method.id}
                          onClick={() => setLiquidatePaymentMethodId(method.id)}
                          className={cn(
                            "p-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all duration-300",
                            liquidatePaymentMethodId === method.id 
                              ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-xl shadow-zinc-500/10" 
                              : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                          )}
                        >
                          {method.name}
                        </button>
                      ))}
                   </div>
                </div>

                <button 
                  disabled={!liquidatePaymentMethodId}
                  onClick={async () => {
                    const amount = Math.abs(liquidatingClient.balance || 0);
                    const method = paymentMethods.find(m => m.id === liquidatePaymentMethodId);
                    
                    try {
                      await addDoc(collection(db, 'transactions'), {
                        type: 'income',
                        amount: amount,
                        description: `Recebimento de Pendência - ${liquidatingClient.name} (${method?.name})`,
                        timestamp: new Date().toISOString(),
                        status: 'paid',
                        paymentMethodId: liquidatePaymentMethodId,
                        clientId: liquidatingClient.id
                      });

                      await updateDoc(doc(db, 'clients', liquidatingClient.id), {
                        balance: 0
                      });

                      setLiquidatingClient(null);
                      alert('Pagamento registrado com sucesso!');
                    } catch (e) {
                      console.error(e);
                      alert('Erro ao registrar pagamento.');
                    }
                  }}
                  className="w-full py-6 bg-emerald-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);
