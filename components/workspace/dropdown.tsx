'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export function Dropdown<T extends string>({ value, onChange, options, className, width }: {
  value: T;
  onChange: (val: T) => void;
  options: readonly { readonly id: T; readonly label: string }[];
  className?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedHeight = Math.min(options.length * 36 + 16, window.innerHeight * 0.5);
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        top: openUp ? rect.top - estimatedHeight : rect.bottom,
        minWidth: Math.max(rect.width, 180),
        zIndex: 9999,
      });
    }
    setOpen(!open);
  };

  const menu = open && (
    <motion.div
      onMouseDown={(e) => e.stopPropagation()}
      initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{ transformOrigin: 'top', ...menuStyle }}
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f14] shadow-2xl">
      <div className="max-h-[50vh] overflow-y-auto">
        {options.map(opt => (
          <button key={opt.id} type="button" onClick={() => { onChange(opt.id); setOpen(false); }}
            className={`w-full px-3 py-2 text-left text-sm transition-colors duration-150 whitespace-nowrap ${value === opt.id ? 'bg-orange-500/15 text-orange-300' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div ref={ref} className="relative" style={width ? { width, minWidth: width } : undefined}>
      <button ref={btnRef} type="button" onClick={toggle} style={width ? { width, minWidth: width } : undefined}
        className={`flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-all duration-200 hover:border-orange-400/40 hover:bg-white/[0.07] hover:shadow-[0_0_12px_-4px_rgba(249,115,22,0.2)] ${className ?? 'w-full h-9'}`}>
        <span className="truncate">{options.find(o => o.id === value)?.label || value}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </motion.div>
      </button>
      {typeof window !== 'undefined' && open && createPortal(menu, document.body)}
    </div>
  );
}
