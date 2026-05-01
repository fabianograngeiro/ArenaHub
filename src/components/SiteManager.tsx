import React, { useState } from 'react';
import { WebsiteEditor } from './WebsiteEditor';
import { PublicSite } from './PublicSite';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Edit3, Eye, ArrowLeft, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

export const SiteManager = () => {
  const [view, setView] = useState<'select' | 'editor' | 'preview'>('select');

  if (view === 'editor') {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white dark:bg-zinc-950 px-6 py-2 border-b border-zinc-100 dark:border-zinc-900 flex justify-between items-center shrink-0">
          <button 
            onClick={() => setView('select')}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao Gerenciamento
          </button>
          <div className="flex items-center gap-4">
             <a 
               href="/site" 
               target="_blank" 
               rel="noopener noreferrer"
               className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors"
             >
                Ver Site Público <ExternalLink size={12} />
             </a>
          </div>
        </div>
        <WebsiteEditor />
      </div>
    );
  }

  if (view === 'preview') {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white dark:bg-zinc-950 px-6 py-2 border-b border-zinc-100 dark:border-zinc-900 flex justify-between items-center shrink-0">
          <button 
            onClick={() => setView('select')}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao Gerenciamento
          </button>
          <button 
            onClick={() => setView('editor')}
            className="flex items-center gap-2 px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-[9px] font-black uppercase tracking-widest"
          >
            <Edit3 size={12} /> Editar Agora
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
           <PublicSite />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 md:p-12 bg-[#FAFAFA] dark:bg-black flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-12 text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-4"
        >
          <div className="inline-flex w-20 h-20 bg-zinc-900 dark:bg-white rounded-3xl items-center justify-center text-white dark:text-zinc-900 shadow-2xl mb-4">
             <Globe size={40} />
          </div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter dark:text-white">Gerenciador do Site</h1>
          <p className="text-zinc-400 font-medium uppercase text-[10px] tracking-[0.3em] max-w-sm mx-auto">
            Escolha como deseja interagir com sua vitrine digital esportiva
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <motion.button
             whileHover={{ scale: 1.02, y: -10 }}
             whileTap={{ scale: 0.98 }}
             onClick={() => setView('editor')}
             className="bg-white dark:bg-zinc-900 p-12 rounded-[3.5rem] border border-zinc-100 dark:border-zinc-800 shadow-xl hover:shadow-2xl transition-all group text-left space-y-8"
           >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                 <Edit3 size={32} />
              </div>
              <div className="space-y-2">
                 <h3 className="text-3xl font-black uppercase italic tracking-tighter dark:text-white">Editor do Site</h3>
                 <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                   Personalize cores, textos, módulos e fotos para deixar sua arena com a sua cara.
                 </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white group-hover:translate-x-2 transition-transform">
                 Abrir Editor <ArrowLeft className="rotate-180" size={16} />
              </div>
           </motion.button>

           <motion.button
             whileHover={{ scale: 1.02, y: -10 }}
             whileTap={{ scale: 0.98 }}
             onClick={() => setView('preview')}
             className="bg-zinc-900 dark:bg-white p-12 rounded-[3.5rem] shadow-xl hover:shadow-2xl transition-all group text-left space-y-8"
           >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-100 rounded-2xl flex items-center justify-center text-white dark:text-zinc-900 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                 <Eye size={32} />
              </div>
              <div className="space-y-2">
                 <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white dark:text-zinc-900">Visualizar Site</h3>
                 <p className="text-zinc-400 dark:text-zinc-500 text-sm font-medium leading-relaxed">
                   Veja como os atletas e clientes enxergam seu complexo esportivo na internet.
                 </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white dark:text-zinc-900 group-hover:translate-x-2 transition-transform">
                 Ver Preview <ArrowLeft className="rotate-180" size={16} />
              </div>
           </motion.button>
        </div>

        <div className="pt-12 border-t border-zinc-100 dark:border-zinc-900">
           <a 
             href="/site" 
             target="_blank" 
             rel="noopener noreferrer"
             className="inline-flex items-center gap-3 px-8 py-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
           >
             <Globe size={16} /> Ver Versão Publicada (Nova Guia)
           </a>
        </div>
      </div>
    </div>
  );
};
