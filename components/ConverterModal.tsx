import React, { useEffect } from 'react';
import { Converter } from './Converter';
import { ExchangeData } from '../types';

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExchangeData;
}

export const ConverterModal: React.FC<ConverterModalProps> = ({ isOpen, onClose, data }) => {
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] transition-colors">
        
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 flex items-center justify-between shrink-0 transition-colors">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              Conversor
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-2">
           {/* Reuse Converter Component without default margins/shadows, passing full data object */}
           <Converter data={data} className="mt-0 shadow-none border-none bg-transparent dark:bg-transparent" hideTitle={true} />
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
             <button 
            onClick={onClose}
            className="w-full bg-slate-900 dark:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-[0.98] transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};