import React, { useState, useEffect } from 'react';
import { ExchangeData } from '../types';

interface ConverterProps {
  data: ExchangeData;
  className?: string;
  hideTitle?: boolean;
}

type RateType = 'bcv' | 'binance';

export const Converter: React.FC<ConverterProps> = ({ data, className, hideTitle = false }) => {
  const [rateType, setRateType] = useState<RateType>('bcv');
  const [amountUSD, setAmountUSD] = useState<string>('1');
  
  // Determine active rate safely
  const activeRate = rateType === 'bcv' ? data.rate : (data.binanceRate || data.rate);
  
  // Initialize VES based on default rate
  const [amountVES, setAmountVES] = useState<string>(activeRate.toFixed(2));

  // When activeRate changes (user switches tab), update VES based on current USD
  useEffect(() => {
    if (activeRate > 0) {
      const usdVal = parseFloat(amountUSD) || 0;
      setAmountVES((usdVal * activeRate).toFixed(2));
    }
  }, [activeRate]);

  const handleUSDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountUSD(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setAmountVES((num * activeRate).toFixed(2));
    } else {
      setAmountVES('');
    }
  };

  const handleVESChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountVES(val);
    const num = parseFloat(val);
    if (!isNaN(num) && activeRate > 0) {
      setAmountUSD((num / activeRate).toFixed(2));
    } else {
      setAmountUSD('');
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-colors duration-200 ${className || 'mt-6'}`}>
      {!hideTitle && (
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            Calculadora
        </h3>
      )}

      {/* Rate Selector Toggles */}
      <div className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl mb-6 flex relative">
        <button
            onClick={() => setRateType('bcv')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5 ${
                rateType === 'bcv' 
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
            <span>Tasa BCV</span>
            <span className="text-[10px] opacity-70 font-medium">Bs {data.rate.toFixed(2)}</span>
        </button>
        <button
            onClick={() => setRateType('binance')}
            disabled={!data.binanceRate}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5 ${
                rateType === 'binance' 
                ? 'bg-white dark:bg-slate-700 text-[#FCD535] shadow-sm' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            } ${!data.binanceRate ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span>Tasa Binance</span>
            <span className="text-[10px] opacity-70 font-medium">{data.binanceRate ? `Bs ${data.binanceRate.toFixed(2)}` : 'N/A'}</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4 items-center">
        {/* USD Input */}
        <div className="relative group">
          <label htmlFor="usd" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">Dólares (USD)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-400 dark:text-slate-500 font-semibold">$</span>
            </div>
            <input
              type="number"
              id="usd"
              value={amountUSD}
              onChange={handleUSDChange}
              className="block w-full pl-8 pr-12 py-3 bg-slate-50 dark:bg-slate-700 border-transparent rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 transition-all text-slate-900 dark:text-white font-medium text-lg placeholder-slate-300 dark:placeholder-slate-500"
              placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">USD</span>
            </div>
          </div>
        </div>

        {/* Swap Icon */}
        <div className="flex justify-center text-slate-300 dark:text-slate-600 -my-2 relative z-10">
           <div className="bg-white dark:bg-slate-800 rounded-full p-1 border border-slate-100 dark:border-slate-700">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10h14l-4-4" />
                <path d="M17 14H3l4 4" />
             </svg>
           </div>
        </div>

        {/* VES Input */}
        <div className="relative group">
          <label htmlFor="ves" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">Bolívares (VES)</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-400 dark:text-slate-500 font-semibold">Bs</span>
            </div>
            <input
              type="number"
              id="ves"
              value={amountVES}
              onChange={handleVESChange}
              className="block w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-700 border-transparent rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 transition-all text-slate-900 dark:text-white font-medium text-lg placeholder-slate-300 dark:placeholder-slate-500"
              placeholder="0.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">VES</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};