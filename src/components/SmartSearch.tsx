import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, User } from 'lucide-react';
import { cn, formatPhone } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function SmartSearch<T extends { id: string }>({
  items,
  searchFields,
  displayField,
  onSelect,
  onAddNew,
  placeholder = "Pesquisar...",
  label,
  value,
  compact,
  className
}: {
  items: T[];
  searchFields: (keyof T)[];
  displayField: keyof T;
  onSelect: (item: T) => void;
  onAddNew?: () => void;
  placeholder?: string;
  label?: string;
  value?: string;
  compact?: boolean;
  className?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize display value if value (id) is provided
  useEffect(() => {
    if (value) {
      const selectedItem = items.find(i => i.id === value);
      if (selectedItem) {
        setSearchTerm(String(selectedItem[displayField]));
      }
    } else {
        setSearchTerm('');
    }
  }, [value, items, displayField]);

  const filteredItems = items.filter(item => 
    searchFields.some(field => 
      String(item[field]).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: T) => {
    onSelect(item);
    setSearchTerm(String(item[displayField]));
    setIsOpen(false);
  };

  return (
    <div className={cn("relative w-full overflow-visible", className)} ref={containerRef}>
      {label && (
        <label className={cn(
          "block font-black uppercase tracking-[0.2em] text-zinc-400 ml-2",
          compact ? "text-[8px] mb-1.5" : "text-[10px] mb-3"
        )}>
          {label}
        </label>
      )}
      <div className="relative group">
        <div className={cn(
          "absolute inset-y-0 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-blue-500 transition-colors",
          compact ? "left-4" : "left-6"
        )}>
          <Search size={compact ? 14 : 18} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-zinc-50 dark:bg-zinc-800 border-none outline-none focus:ring-4 ring-blue-500/10 dark:text-white font-bold transition-all truncate",
            compact 
              ? "pl-11 pr-10 py-2.5 rounded-xl text-[10px]" 
              : "pl-16 pr-12 py-5 rounded-3xl"
          )}
        />
        {(searchTerm || onAddNew) && (
          <div className={cn(
            "absolute inset-y-0 flex items-center gap-1.5",
            compact ? "right-2" : "right-4"
          )}>
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(''); onSelect({ id: '' } as T); }}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={compact ? 12 : 16} />
              </button>
            )}
            {onAddNew && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAddNew(); }}
                className={cn(
                  "bg-blue-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center",
                  compact ? "w-7 h-7 rounded-lg" : "p-2 rounded-xl"
                )}
                title="Cadastrar Novo"
              >
                <Plus size={compact ? 14 : 16} strokeWidth={3} />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (searchTerm.length > 0 || filteredItems.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              "absolute z-[100] top-full mt-2 w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden max-h-[300px] overflow-y-auto",
              compact ? "rounded-xl mt-1.5" : "rounded-[2rem] mt-3"
            )}
          >
            {filteredItems.length > 0 ? (
              <div className="p-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "w-full text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-3 transition-colors group",
                      compact ? "px-3 py-2 rounded-lg" : "px-6 py-4 rounded-2xl"
                    )}
                  >
                    <div className={cn(
                      "bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-blue-500 group-hover:text-white transition-all",
                      compact ? "w-7 h-7 rounded-lg" : "w-10 h-10 rounded-xl"
                    )}>
                      <User size={compact ? 14 : 18} />
                    </div>
                    <div>
                      <p className={cn(
                        "font-black dark:text-white uppercase tracking-tight italic leading-tight",
                        compact ? "text-[10px]" : "text-sm"
                      )}>{String(item[displayField])}</p>
                      {/* Subtitle if available */}
                      {searchFields[1] && (
                        <p className={cn(
                          "text-zinc-400 font-bold uppercase tracking-widest",
                          compact ? "text-[7px]" : "text-[10px]"
                        )}>
                          {searchFields[1] === 'phone' ? formatPhone(String(item[searchFields[1]])) : String(item[searchFields[1]])}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-zinc-400 font-serif italic mb-4">Nenhum resultado encontrado...</p>
                {onAddNew && (
                  <button 
                    onClick={onAddNew}
                    className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest"
                  >
                    Cadastrar "{searchTerm}"
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
