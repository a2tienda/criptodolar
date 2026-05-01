import React, { useState, useEffect, useRef } from 'react';
import { ExchangeData } from '../types';

interface RateDisplayProps {
  data: ExchangeData;
  loading: boolean;
  onRefresh: () => void;
}

export const RateDisplay: React.FC<RateDisplayProps> = ({ data, loading, onRefresh }) => {
  const [isBouncing, setIsBouncing] = useState(false);
  const prevLoadingRef = useRef(loading);

  useEffect(() => {
    // Detect when loading finishes (transition from true to false)
    if (prevLoadingRef.current && !loading) {
      setIsBouncing(true);
      // Stop bouncing after 1 second
      const timer = setTimeout(() => setIsBouncing(false), 1000);
      return () => clearTimeout(timer);
    }
    prevLoadingRef.current = loading;
  }, [loading]);
  
  // Helper to calculate gap vs BCV for individual cards
  const getGap = (currentRate: number, bcvRate: number) => {
    const diff = currentRate - bcvRate;
    const percent = (diff / bcvRate) * 100;
    const sign = diff > 0 ? '+' : '';
    return {
      diffStr: `${sign}${diff.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      percentStr: `${sign}${percent.toFixed(2)}%`,
      isPositive: diff > 0
    };
  };

  // Logic for the Main Brecha (Exchange Gap) Indicator
  // 1. Define sources (Only Binance now, but extensible)
  const rates = [
    { name: 'Binance', value: data.binanceRate }
  ];

  // 2. Find the highest rate and its source name
  let maxParallel = 0;
  let maxSource = '';

  rates.forEach(item => {
    if (typeof item.value === 'number' && item.value > maxParallel) {
      maxParallel = item.value;
      maxSource = item.name;
    }
  });
  
  // 3. Calculate Gap
  const hasGapData = maxParallel > 0;
  const gapAmount = maxParallel - data.rate;
  const gapPercent = (gapAmount / data.rate) * 100;
  // 4. Calculate Coverage Factor (Highest Parallel / BCV)
  const coverageFactor = data.rate > 0 ? maxParallel / data.rate : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Main BCV Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 md:p-8 relative overflow-hidden transition-colors duration-200">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasa Oficial BCV</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Banco Central de Venezuela</p>
            </div>
            <button 
              onClick={onRefresh} 
              disabled={loading}
              className={`p-2 rounded-full hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors 
                ${loading ? 'animate-spin text-slate-400' : ''}
                ${!loading && isBouncing ? 'animate-bounce text-purple-600 dark:text-purple-400' : ''}
                ${!loading && !isBouncing ? 'text-purple-600 dark:text-purple-400' : ''}
              `}
              title="Actualizar todas las tasas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </button>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
              {data.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            <span className="text-xl text-slate-500 dark:text-slate-400 font-medium">VES/USD</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-6">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Fecha valor: <span className="font-semibold text-slate-900 dark:text-white">{data.date}</span></span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-900/30 transition-colors">
               <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
               <span>Actualizado: <span className="font-semibold text-slate-900 dark:text-white">{data.lastUpdate}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* BRECHA CAMBIARIA HIGHLIGHT CARD */}
      {hasGapData && (
        <div className="relative overflow-visible bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 shadow-lg text-white transition-colors duration-200">
          {/* Decorative glow - contained inside for better layout but visual effect is global */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-rose-500 rounded-full blur-3xl opacity-20 pointer-events-none overflow-hidden"></div>
          
          <div className="relative z-10 flex flex-col gap-4">
            
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="bg-rose-500/20 p-2.5 rounded-lg text-rose-400 border border-rose-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">Brecha Cambiaria</h3>
                <p className="text-slate-400 text-xs">Diferencia Máxima vs BCV</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-4 bg-white/5 rounded-xl px-5 py-3 border border-white/10 backdrop-blur-sm">
              
              <div className="flex-1 min-w-[100px]">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Variación</p>
                <div className="flex items-baseline gap-1">
                    <p className={`text-2xl font-bold leading-tight ${gapPercent > 10 ? 'text-rose-400' : 'text-yellow-400'}`}>
                    {gapPercent.toFixed(2)}%
                    </p>
                </div>
                 <p className="text-[10px] text-slate-500 font-medium truncate">Ref: {maxSource}</p>
              </div>

              <div className="w-px h-10 bg-white/10 hidden sm:block"></div>

              <div className="flex-1 min-w-[100px]">
                 <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Diferencia</p>
                 <p className="text-xl font-bold text-white">
                    {gapAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-slate-400">Bs</span>
                 </p>
              </div>

              <div className="w-px h-10 bg-white/10 hidden sm:block"></div>

              <div className="flex-1 min-w-[120px] group relative">
                 <div className="flex items-center gap-1 cursor-help w-fit">
                    <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-bold border-b border-dashed border-emerald-400/30">Factor Cobertura</p>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/60">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                 </div>
                 
                 {/* Tooltip Content */}
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950 text-slate-200 text-[10px] leading-tight rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-slate-800 text-center">
                    Su "precio base" debe ser multiplicado por el Factor de Cobertura para considerar o trasladar el valor de la brecha cambiaria
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-950"></div>
                 </div>

                 <p className="text-2xl font-bold text-emerald-400">
                    {coverageFactor.toFixed(4)}
                 </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Secondary Rates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Binance P2P Rate Card */}
        {data.binanceRate && (
          <div className="bg-[#1E2329] dark:bg-[#15191E] text-[#FCD535] rounded-2xl shadow-lg p-6 relative overflow-hidden flex flex-col justify-between group transition-colors">
            <div className="absolute -right-4 -bottom-4 opacity-10 text-[#FCD535] group-hover:opacity-20 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 24C5.373 24 0 18.627 0 12S5.373 0 12 0s12 5.373 12 12-5.373 12-12 12z" opacity="0.1"/>
                <path d="M16.5 12l-2.25 2.25-2.25-2.25 2.25-2.25 2.25 2.25zm-6.75 0l-2.25 2.25-2.25-2.25 2.25-2.25 2.25 2.25zm4.5-4.5l-2.25 2.25-2.25-2.25 2.25-2.25 2.25 2.25zm0 9l-2.25 2.25-2.25-2.25 2.25-2.25 2.25 2.25z" fill="currentColor"/>
              </svg>
            </div>

            <div className="relative z-10 flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#FCD535]/20 p-2 rounded-lg backdrop-blur-sm text-[#FCD535]">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5" />
                     <path d="M3 12h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" />
                     <path d="M12 12v9" />
                     <line x1="7" y1="16" x2="7.01" y2="16" />
                     <line x1="17" y1="16" x2="17.01" y2="16" />
                   </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight text-white">Binance P2P</h3>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">USDT/VES</p>
                </div>
              </div>
              
              {/* Trend Indicator */}
              {data.binanceVariation !== undefined && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                  data.binanceTrend === 'up' ? 'bg-red-500/20 text-red-400' : 
                  data.binanceTrend === 'down' ? 'bg-emerald-500/20 text-emerald-400' : 
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {data.binanceTrend === 'up' && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m19 12-7-7-7 7"/><path d="M12 19V5"/></svg>}
                  {data.binanceTrend === 'down' && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>}
                  {data.binanceTrend === 'stable' && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>}
                  {Math.abs(data.binanceVariation).toFixed(2)}%
                </div>
              )}
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-bold text-[#FCD535]">
                    {data.binanceRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-gray-400 font-medium text-sm">Bs</span>
                </div>

                {/* Variation Badge */}
                {data.binanceVariation !== undefined && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                    data.binanceTrend === 'up' ? 'bg-red-500/20 text-red-400' : 
                    data.binanceTrend === 'down' ? 'bg-green-500/20 text-green-400' : 
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {data.binanceTrend === 'up' && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m19 12-7-7-7 7M12 19V5"/>
                      </svg>
                    )}
                    {data.binanceTrend === 'down' && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 7 7 7-7M12 5v14"/>
                      </svg>
                    )}
                    {data.binanceTrend === 'stable' && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/>
                      </svg>
                    )}
                    <span>{Math.abs(data.binanceVariation).toFixed(2)}%</span>
                  </div>
                )}
              </div>

              {/* Gap vs BCV */}
              {(() => {
                const gap = getGap(data.binanceRate, data.rate);
                return (
                  <div className="mt-2 flex items-center gap-2 text-xs font-medium bg-white/10 w-fit px-2 py-1 rounded backdrop-blur-sm text-gray-300">
                    <span>vs BCV:</span>
                    <span className="font-bold text-[#FCD535]">{gap.diffStr} Bs</span>
                    <span className="opacity-80">({gap.percentStr})</span>
                  </div>
                );
              })()}

              <div className="mt-4 pt-3 border-t border-white/10 text-xs text-gray-400">
                <div className="flex items-center justify-between mb-2">
                    <span>Actualizado:</span>
                    <span className="font-semibold text-[#FCD535]">{data.lastUpdate}</span>
                </div>
                
                <a 
                    href="https://lucamoney.com/app?ref=CRPANA" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-[#FCD535]/10 hover:bg-[#FCD535]/20 text-[#FCD535] transition-colors font-semibold mt-2"
                >
                    Genera ingresos pasivos
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                    </svg>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bitcoin Rate Card */}
        {data.bitcoinRate && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden flex flex-col justify-between group transition-colors">
            <div className="absolute -right-4 -bottom-4 opacity-10 text-white group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.767 19.089c4.924.868 6.14-6.302 2.767-8.774 1.85-2.003-.54-5.59-3.794-5.263"></path>
                  <path d="M7 8h5.5a2.5 2.5 0 1 1 0 5H7"></path>
                  <path d="M7 13h6.5a2.5 2.5 0 1 1 0 5H7"></path>
                  <path d="M9 5v14"></path>
              </svg>
            </div>
            
            <div className="relative z-10 flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M11.767 19.089c4.924.868 6.14-6.302 2.767-8.774 1.85-2.003-.54-5.59-3.794-5.263"></path>
                     <path d="M7 8h5.5a2.5 2.5 0 1 1 0 5H7"></path>
                     <path d="M7 13h6.5a2.5 2.5 0 1 1 0 5H7"></path>
                     <line x1="9" y1="5" x2="9" y2="19"></line>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight text-white">Bitcoin</h3>
                  <p className="text-orange-100 text-xs uppercase tracking-wider">USD/BTC</p>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-bold text-white">
                  {data.bitcoinRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-orange-100 font-medium text-sm">$</span>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/10 text-xs text-orange-100 flex items-center justify-between">
                <span>Actualizado:</span>
                <span className="font-semibold text-white">{data.lastUpdate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Gold Rate Card */}
        {data.goldRate && (
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden flex flex-col justify-between group transition-colors">
            <div className="absolute -right-4 -bottom-4 opacity-10 text-white group-hover:opacity-20 transition-opacity">
               <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 10h12v11H6z"></path>
                  <path d="M6 10l6-7 6 7"></path>
              </svg>
            </div>
            
            <div className="relative z-10 flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                    <line x1="12" y1="18" x2="12" y2="6"></line>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight text-white">Oro</h3>
                  <p className="text-yellow-100 text-xs uppercase tracking-wider">USD/Onza</p>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-bold text-white">
                  {data.goldRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-yellow-100 font-medium text-sm">$</span>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/10 text-xs text-yellow-100 flex items-center justify-between">
                <span>Actualizado:</span>
                <span className="font-semibold text-white">{data.lastUpdate}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};