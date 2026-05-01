import React, { useState, useEffect } from 'react';
import { fetchDollarRate } from './services/geminiService';
import { ExchangeData } from './types';
import { RateDisplay } from './components/RateDisplay';
import { PriceCalculatorModal } from './components/PriceCalculatorModal';
import { ConverterModal } from './components/ConverterModal';
import { DiagnosisModal } from './components/DiagnosisModal';
import { SourceList } from './components/SourceList';

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExchangeData | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [isPriceModalOpen, setIsPriceModalOpen] = useState<boolean>(false);
  const [isConverterModalOpen, setIsConverterModalOpen] = useState<boolean>(false);
  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState<boolean>(false);
  const [logoError, setLogoError] = useState<boolean>(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDollarRate();
      if (result.data) {
        setData(result.data);
        setSources(result.sources);
        setRawText(result.rawText || "");
      }
    } catch (err: any) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleShare = async () => {
    try {
      const url = window.location.href;
      const isValidProtocol = url.startsWith('http://') || url.startsWith('https://');
      if (navigator.share && isValidProtocol) {
        await navigator.share({ title: 'CriptoDolar Venezuela', text: "Consulta la brecha cambiaria...By CriptoPana", url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('¡Enlace copiado!');
      }
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-12 transition-colors duration-200">
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {!logoError ? (
              <img src="/logo.png" alt="Logo" className="h-9 w-9 sm:h-12 sm:w-12 rounded-full shadow-md object-cover hover:rotate-6 transition-transform duration-300 border border-slate-200 dark:border-slate-600 bg-white" onError={() => setLogoError(true)} />
            ) : (
              <div className="bg-orange-500 text-white p-1.5 rounded-full shrink-0 shadow-sm h-9 w-9 sm:h-12 sm:w-12 flex items-center justify-center border border-orange-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            )}
            <div className="flex flex-col">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tighter leading-none">
                <span className="text-orange-500">Cripto</span><span className="text-purple-600 dark:text-purple-400">Dolar</span>
              </h1>
              <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">By CriptoPana</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
            <button onClick={() => setIsConverterModalOpen(true)} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 p-2 sm:p-2.5 rounded-lg transition-colors shadow-sm" title="Conversor">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                <path d="M7 10h14l-4-4" /><path d="M17 14H3l4 4" />
              </svg>
            </button>
            <button onClick={() => setIsPriceModalOpen(true)} className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white p-2 sm:p-2.5 rounded-lg transition-colors shadow-sm border border-transparent dark:border-slate-600" title="Calculadora">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zm14.25 6a.75.75 0 0 1-.22.53l-2.25 2.25a.75.75 0 1 1-1.06-1.06L15.44 12l-1.72-1.72a.75.75 0 1 1 1.06-1.06l2.25 2.25c.141.14.22.331.22.53zm-10.28-.53a.75.75 0 0 0 0 1.06l2.25 2.25a.75.75 0 1 0 1.06-1.06L8.56 12l1.72-1.72a.75.75 0 0 0-1.06-1.06l-2.25 2.25z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={() => setIsDiagnosisModalOpen(true)} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 p-2 sm:p-2.5 rounded-lg transition-colors shadow-sm" title="Diagnóstico">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <rect width="20" height="16" x="2" y="6" rx="2" /><path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" /><path d="M12 11v4" /><path d="M14 13h-4" />
              </svg>
            </button>
            <button onClick={toggleDarkMode} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" aria-label="Toggle Dark Mode">
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
                  <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <button onClick={handleShare} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Compartir">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl mb-6"></div>
            <div className="h-48 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <p className="mt-6 text-slate-500 dark:text-slate-400 font-medium">Consultando...</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400 p-6 rounded-2xl mb-6 transition-colors">
            <h3 className="font-bold text-lg mb-2">Error</h3>
            <p>{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">Reintentar</button>
          </div>
        )}
        {data && (
          <>
            <RateDisplay data={data} loading={loading} onRefresh={loadData} />
            <SourceList sources={sources} />
            <PriceCalculatorModal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} data={data} />
            <ConverterModal isOpen={isConverterModalOpen} onClose={() => setIsConverterModalOpen(false)} data={data} />
            <DiagnosisModal isOpen={isDiagnosisModalOpen} onClose={() => setIsDiagnosisModalOpen(false)} />
          </>
        )}
        <footer className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500 max-w-lg mx-auto transition-colors pb-safe">
          <p>Los datos son obtenidos mediante APIs públicas. Verifique siempre.</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
