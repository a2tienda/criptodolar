import React, { useState, useEffect } from 'react';
import { ExchangeData } from '../types';

interface PriceCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExchangeData;
}

export const PriceCalculatorModal: React.FC<PriceCalculatorModalProps> = ({ isOpen, onClose, data }) => {
  const [costoReposicion, setCostoReposicion] = useState<string>('');
  const [gastosOperativos, setGastosOperativos] = useState<string>('0');
  const [margenGanancia, setMargenGanancia] = useState<string>('30');
  const [descuento, setDescuento] = useState<string>('0');
  
  // Calculated values
  const [montoGastos, setMontoGastos] = useState<number>(0);
  const [montoGanancia, setMontoGanancia] = useState<number>(0);
  const [costoTotal, setCostoTotal] = useState<number>(0); // New State for Total Cost
  const [precioBase, setPrecioBase] = useState<number>(0);
  const [montoDescuento, setMontoDescuento] = useState<number>(0);
  const [precioFinal, setPrecioFinal] = useState<number>(0); // New intermediate state
  const [gananciaReal, setGananciaReal] = useState<number>(0); // Real profit after discount
  const [gananciaRealPct, setGananciaRealPct] = useState<number>(0); // Real margin %
  const [precioPublicacion, setPrecioPublicacion] = useState<number>(0);
  const [factor, setFactor] = useState<number>(1);
  const [maxParallelRate, setMaxParallelRate] = useState<number>(0);
  const [maxDiscount, setMaxDiscount] = useState<number>(0);

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

  useEffect(() => {
    // 1. Identify Highest Parallel Rate
    const rates = [data.binanceRate].filter((r): r is number => typeof r === 'number' && r > 0);
    const maxParallel = rates.length > 0 ? Math.max(...rates) : data.rate; 
    setMaxParallelRate(maxParallel);

    // 2. Parse Inputs
    const costo = parseFloat(costoReposicion) || 0;
    const gastosPct = parseFloat(gastosOperativos) || 0;
    const margen = parseFloat(margenGanancia) || 0;
    let descPct = parseFloat(descuento) || 0;

    // VALIDATION: Prevent Negative Profit
    if (descPct > margen) {
        descPct = margen;
        setDescuento(margen.toString());
    }

    // 3. Calculate Formula: PRECIO BASE = COSTO / (1 - (%GASTOS + %MARGEN))
    const gastosDecimal = gastosPct / 100;
    const margenDecimal = margen / 100;
    const totalDeductions = gastosDecimal + margenDecimal;

    let base = 0;
    if (totalDeductions < 1) {
        base = costo / (1 - totalDeductions);
    }
    setPrecioBase(base);

    // 4. Calculate Derived Amounts (Expenses and Profit are % of Base Price in this formula model)
    const gastosAmount = base * gastosDecimal;
    setMontoGastos(gastosAmount);

    const gananciaAmount = base * margenDecimal;
    setMontoGanancia(gananciaAmount);

    // 5. Calculate Discount Amount (Based on Price Base)
    const descDecimal = descPct / 100;
    const discountAmount = base * descDecimal;
    setMontoDescuento(discountAmount);

    // 6. Calculate Final Price (Base - Discount)
    const final = Math.max(0, base - discountAmount);
    setPrecioFinal(final);

    // 7. Calculate Real Profit (Final Price - Total Cost)
    const costoTotalCalc = costo + gastosAmount; // Cost + Expenses
    setCostoTotal(costoTotalCalc);

    const realProfit = final - costoTotalCalc;
    setGananciaReal(realProfit);

    // Calculate Real Margin Percentage based on Final Price
    if (final > 0) {
        setGananciaRealPct((realProfit / final) * 100);
    } else {
        setGananciaRealPct(0);
    }

    // 8. Calculate Publication Price (Shielded Final Price)
    // (Precio Final * Tasa Mas Alta) / Tasa BCV
    if (data.rate > 0) {
      const calculatedFactor = maxParallel / data.rate;
      setFactor(calculatedFactor);
      
      const publicacion = (final * maxParallel) / data.rate;
      setPrecioPublicacion(publicacion);

      // 9. Calculate Max Discount (Currency Gap)
      // Difference between Tag Price (Publicacion) and USD Cash Price (Final)
      if (publicacion > 0) {
        const discountGap = (1 - (final / publicacion)) * 100;
        setMaxDiscount(discountGap);
      } else {
        setMaxDiscount(0);
      }
    }
  }, [costoReposicion, gastosOperativos, margenGanancia, descuento, data]);

  const handleReset = () => {
    setCostoReposicion('');
    setGastosOperativos('0');
    setMargenGanancia('30');
    setDescuento('0');
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const numVal = parseFloat(val);
    const maxLimit = parseFloat(margenGanancia) || 0;

    if (val === '') {
      setDescuento('');
      return;
    }

    // Prevent typing a value higher than the current margin
    if (!isNaN(numVal) && numVal > maxLimit) {
       setDescuento(maxLimit.toString());
    } else {
       setDescuento(val);
    }
  };

  // Helper to determine gauge visuals and managerial advice
  const getGaugeMetrics = (pct: number) => {
    // Map 0-50% to the full gauge (100% of the arc)
    const normalized = Math.min(Math.max(pct, 0), 50);
    const percentageOfGauge = normalized / 50; 
    
    // SVG Config
    const circumference = 88;
    const dashOffset = circumference * (1 - percentageOfGauge);
    
    // Default: Critical (< 6%)
    let color = '#ef4444'; // red-500
    let label = 'Crítica';
    let textClass = 'text-red-500 dark:text-red-400';
    let bgClass = 'bg-red-500';
    let borderColor = 'border-red-200 dark:border-red-900';
    let title = "Alerta de Supervivencia";
    let advice = "Tu negocio está operando en la zona de riesgo. Actualmente, cualquier imprevisto (un equipo dañado o una baja en ventas) se convertirá en deuda inmediatamente.";
    let action = "Revisa tus Gastos Fijos urgentemente. No busques vender más todavía; primero detén la fuga de efectivo y evalúa si tus precios están muy por debajo de la competencia.";

    if (pct >= 6) { // 6-15% (Low/Medium)
        color = '#eab308'; // yellow-500
        label = 'Baja/Media';
        textClass = 'text-yellow-600 dark:text-yellow-400';
        bgClass = 'bg-yellow-500';
        borderColor = 'border-yellow-200 dark:border-yellow-900';
        title = "Zona de Estabilidad";
        advice = `Tienes un negocio operativo y estable (estás en ${pct.toFixed(2)}%, ¡vas por buen camino!). Sin embargo, tu capacidad de ahorro para reinversión es limitada.`;
        action = "Intenta optimizar tus procesos. Un pequeño ajuste del 2% en tu Margen Bruto (negociando con proveedores o reduciendo desperdicios) disparará tu utilidad neta sin necesidad de captar nuevos clientes.";
    }
    if (pct >= 16) { // 16-35% (Good)
        color = '#10b981'; // emerald-500
        label = 'Buena';
        textClass = 'text-emerald-600 dark:text-emerald-400';
        bgClass = 'bg-emerald-500';
        borderColor = 'border-emerald-200 dark:border-emerald-900';
        title = "Motor de Crecimiento";
        advice = "¡Felicidades! Tu modelo de negocio es altamente eficiente. Tienes un colchón financiero sólido que te permite absorber fluctuaciones del mercado sin estrés.";
        action = "Es el momento de escalar. Considera reinvertir estas utilidades en marketing o en mejorar tu infraestructura. Tu eficiencia operativa garantiza que cada dólar invertido retornará multiplicado.";
    }
    if (pct > 35) { // >35% (Excellent)
        color = '#f59e0b'; // amber-500
        label = 'Excelente';
        textClass = 'text-amber-600 dark:text-amber-400';
        bgClass = 'bg-amber-500';
        borderColor = 'border-amber-200 dark:border-amber-900';
        title = "Líder de Mercado";
        advice = "Estás en el top de rentabilidad. Tu propuesta de valor es tan fuerte que el mercado está dispuesto a pagar una prima alta por tus servicios/productos.";
        action = "Protege tu ventaja competitiva. Mantén la calidad y enfócate en la fidelización. Con estos márgenes, podrías considerar diversificar tus ingresos o expandirte a nuevos mercados.";
    }

    return { dashOffset, color, label, textClass, bgClass, borderColor, title, advice, action };
  };

  const gauge = getGaugeMetrics(gananciaRealPct);

  // Helper calculation for Gross Margin in tooltip
  const calcGrossMargin = (parseFloat(gastosOperativos) || 0) + (parseFloat(margenGanancia) || 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] transition-colors">
        
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 flex items-center justify-between shrink-0 transition-colors">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Cálculo Blindado
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Define precios protegidos contra la brecha</p>
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

        <div className="p-6 space-y-4 overflow-y-auto">
          
          {/* STEP 1: Inputs for Cost Structure */}
          <div className="grid grid-cols-2 gap-4">
            {/* Costo Reposición */}
            <div className="col-span-2">
              <label htmlFor="costo" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Costo Reposición ($)
              </label>
              <input
                id="costo"
                type="number"
                value={costoReposicion}
                onChange={(e) => setCostoReposicion(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 focus:outline-none transition-all text-slate-900 dark:text-white font-bold text-xl placeholder-slate-300 dark:placeholder-slate-500"
              />
            </div>

            {/* Gastos Operativos */}
            <div className="col-span-1">
               {/* Label with Tooltip */}
               <div className="flex items-center gap-1.5 mb-1.5 relative group w-fit">
                 <label htmlFor="gastos" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-help">
                  Gastos Op. (%)
                 </label>
                 <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-help">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                 </div>
                 
                 {/* Tooltip Content */}
                 <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 dark:bg-slate-700 text-slate-200 text-[10px] leading-relaxed rounded-xl shadow-xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20 pointer-events-none">
                    <div className="mb-2 pb-2 border-b border-slate-600">
                        <p className="font-bold text-emerald-400 mb-0.5">Definición:</p>
                        <p className="text-slate-300">Porcentaje de ventas que consumen tus costos fijos (Alquiler, Nómina, etc).</p>
                    </div>
                    
                    <div className="bg-slate-900/50 p-1.5 rounded text-center font-mono border border-white/5 tracking-tight text-white/90 mb-2">
                        (TOTAL GASTOS ÷ TOTAL VENTAS) × 100
                    </div>

                    <div className="flex items-start gap-1.5 text-orange-300 bg-orange-900/20 p-1.5 rounded border border-orange-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <p>Tip: Usa el <strong>Diagnóstico 360</strong> del menú para calcular este valor exacto.</p>
                    </div>
                    <div className="absolute top-full left-6 -mt-[1px] border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                 </div>
               </div>

              <div className="relative">
                <input
                  id="gastos"
                  type="number"
                  value={gastosOperativos}
                  onChange={(e) => setGastosOperativos(e.target.value)}
                  placeholder="0"
                  className="block w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 focus:outline-none transition-all text-slate-900 dark:text-white font-bold text-lg"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-slate-400 dark:text-slate-500 font-bold">%</span>
                </div>
              </div>
              <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 text-right">
                + ${montoGastos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Costo Total Display (Moved here, between Gastos and Margen) */}
            <div className="col-span-1 flex flex-col justify-end pb-[1.125rem]"> 
                 <div className="bg-slate-50 dark:bg-slate-700/30 px-3 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 h-[46px] flex flex-col justify-center">
                    <div className="flex justify-between items-baseline">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-none">Costo Total</p>
                        <p className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">Cost+Gastos</p>
                    </div>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200 tracking-tight leading-none mt-1">
                        $ {costoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                 </div>
            </div>

            {/* Margen Ganancia */}
            <div className="col-span-2">
               {/* Label with Tooltip */}
               <div className="flex items-center gap-1.5 mb-1.5 relative group w-fit">
                 <label htmlFor="margen" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-help">
                  Margen Neto (%)
                 </label>
                 <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-help">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                 </div>
                 
                 {/* Tooltip Content */}
                 <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 dark:bg-slate-700 text-slate-200 text-[10px] leading-relaxed rounded-xl shadow-xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20 pointer-events-none">
                    <div className="mb-2 pb-2 border-b border-slate-700">
                        <div className="flex justify-between items-baseline mb-0.5">
                             <p className="font-bold text-emerald-400">Margen Bruto:</p>
                             <span className="font-bold text-white text-xs">{calcGrossMargin.toFixed(2)}%</span>
                        </div>
                        <p className="text-slate-300 leading-snug">
                            Ganancia total sobre la venta. <br/>
                            <span className="text-slate-400 text-[9px]">(Gastos {gastosOperativos || 0}% + Neto {margenGanancia || 0}%)</span>
                        </p>
                    </div>
                    <div>
                        <p className="font-bold text-emerald-400 mb-0.5">Margen Neto:</p>
                        <p className="text-slate-300">Tu ganancia real libre (Bolsillo) después de pagar todo.</p>
                    </div>
                    <div className="absolute top-full left-6 -mt-[1px] border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                 </div>
               </div>

              <div className="relative">
                <input
                  id="margen"
                  type="number"
                  value={margenGanancia}
                  onChange={(e) => setMargenGanancia(e.target.value)}
                  placeholder="30"
                  className="block w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 focus:outline-none transition-all text-slate-900 dark:text-white font-bold text-lg"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-slate-400 dark:text-slate-500 font-bold">%</span>
                </div>
              </div>
              <div className="mt-1 text-[10px] text-emerald-600/70 dark:text-emerald-400/70 text-right font-medium">
                + ${montoGanancia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* STEP 2: Precio Base Display */}
          <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600 flex justify-between items-center transition-colors">
             <div className="text-left">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Precio Base</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">Costo / (1 - (Gastos% + Margen%))</p>
             </div>
             <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                $ {precioBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </p>
          </div>

          {/* STEP 3: Discount Input */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-slate-800 px-2 text-xs text-slate-400 uppercase tracking-widest font-semibold">Descuentos</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
             <div className="col-span-1">
                <label htmlFor="descuento" className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                   <span>Aplicar Descuento</span>
                   <span className="text-[9px] bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">Máx: {margenGanancia}%</span>
                </label>
                <div className="relative">
                    <input
                    id="descuento"
                    type="number"
                    value={descuento}
                    onChange={handleDiscountChange}
                    max={margenGanancia}
                    placeholder="0"
                    className="block w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 focus:outline-none transition-all text-slate-900 dark:text-white font-bold text-lg"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 dark:text-slate-500 font-bold">%</span>
                    </div>
                </div>
                <div className="mt-1 text-[10px] text-red-500/70 dark:text-red-400/70 text-right font-medium">
                    - ${montoDescuento.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
             </div>

             {/* STEP 4: Precio Final Display - UPDATED BREAKDOWN */}
             <div className="col-span-1 bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between h-full">
                <div className="mb-2">
                   <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Precio Final</p>
                   <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 tracking-tight">
                       $ {precioFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                </div>
                
                <div className="space-y-1.5 pt-2 border-t border-emerald-200 dark:border-emerald-800/30">
                    {/* Costo Proveedor */}
                    <div className="flex justify-between items-center text-[10px]">
                         <span className="text-slate-500 dark:text-slate-400 font-medium">Costo Prov.</span>
                         <div className="text-right">
                             <span className="text-slate-700 dark:text-slate-300 font-bold mr-1.5">
                                ${(parseFloat(costoReposicion) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                             <span className="text-slate-400 text-[9px]">
                                 ({precioFinal > 0 ? (((parseFloat(costoReposicion) || 0) / precioFinal) * 100).toFixed(1) : '0.0'}%)
                             </span>
                         </div>
                    </div>

                    {/* Gastos */}
                    <div className="flex justify-between items-center text-[10px]">
                         <span className="text-slate-500 dark:text-slate-400 font-medium">Gastos Op.</span>
                         <div className="text-right">
                             <span className="text-slate-700 dark:text-slate-300 font-bold mr-1.5">
                                ${montoGastos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                             <span className="text-slate-400 text-[9px]">
                                 ({precioFinal > 0 ? ((montoGastos / precioFinal) * 100).toFixed(1) : '0.0'}%)
                             </span>
                         </div>
                    </div>

                    {/* Ganancia Real */}
                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-dashed border-emerald-200 dark:border-emerald-800/30">
                         <span className="text-emerald-700 dark:text-emerald-400 font-bold">Ganancia</span>
                         <div className="text-right">
                             <span className={`font-bold mr-1.5 ${gananciaReal >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                                ${gananciaReal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                             <span className={`text-[9px] ${gananciaReal >= 0 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-red-500/70 dark:text-red-400/70'}`}>
                                 ({gananciaRealPct.toFixed(1)}%)
                             </span>
                         </div>
                    </div>
                </div>

                {/* VISUAL GAUGE (Speedometer) - WITH ADVICE TOOLTIP */}
                <div className={`group relative mt-3 flex items-center justify-between bg-white dark:bg-slate-900/40 rounded-lg p-2 border ${gauge.borderColor} cursor-help`}>
                    <div className="flex flex-col min-w-0 mr-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 truncate">Rentabilidad</span>
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${gauge.bgClass} bg-opacity-10 ${gauge.textClass} flex items-center gap-1 whitespace-nowrap`}>
                            {gananciaRealPct > 35 && <span>💎</span>}
                            {gauge.label}
                        </div>
                    </div>
                    
                    <div className="relative w-16 h-10 flex items-end justify-center pb-1 shrink-0">
                         {/* SVG Gauge */}
                         <svg width="64" height="34" viewBox="0 0 64 34" className="overflow-visible">
                            <path d="M 4 30 A 28 28 0 0 1 60 30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                            <path 
                                d="M 4 30 A 28 28 0 0 1 60 30" 
                                fill="none" 
                                stroke={gauge.color} 
                                strokeWidth="6" 
                                strokeLinecap="round" 
                                strokeDasharray="88" 
                                strokeDashoffset={gauge.dashOffset}
                                className="transition-all duration-500 ease-out"
                            />
                         </svg>
                         <div className="absolute bottom-1 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                             {gananciaRealPct.toFixed(0)}%
                         </div>
                    </div>

                    {/* MANAGERIAL ADVICE TOOLTIP */}
                    <div className="absolute bottom-full right-0 mb-3 w-72 p-4 bg-slate-900/95 dark:bg-black/95 text-white rounded-xl shadow-2xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[60] backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                            <span className={`w-2 h-2 rounded-full ${gauge.bgClass}`}></span>
                            <h4 className={`text-sm font-bold ${gauge.textClass}`}>{gauge.title}</h4>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Consejo:</p>
                                <p className="text-xs text-slate-200 leading-relaxed">
                                    {gauge.advice}
                                </p>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                                <p className="text-[10px] text-orange-400 uppercase font-bold mb-1">Acción Inmediata:</p>
                                <p className="text-xs text-slate-300 leading-relaxed italic">
                                    "{gauge.action}"
                                </p>
                            </div>
                        </div>
                        <div className="absolute top-full right-10 w-0 h-0 border-8 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                    </div>
                </div>
             </div>
          </div>

          {/* STEP 5: Factor & Publication */}
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 justify-center bg-slate-50/50 dark:bg-slate-700/30 py-1 rounded">
                <span>Tasa Alta: {maxParallelRate.toFixed(2)}</span>
                <span>/</span>
                <span>BCV: {data.rate.toFixed(2)}</span>
                <span>=</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">Factor {factor.toFixed(4)}x</span>
            </div>

            {/* Final Result: Precio Publicacion */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 relative overflow-hidden text-center group transition-colors shadow-xl">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-500 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 relative z-10">
                Precio de Publicación
                </p>
                
                <div className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter relative z-10 break-words mb-2 leading-none">
                $ {precioPublicacion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                
                <p className="text-purple-400 text-xs font-medium relative z-10">
                Valor en etiqueta (Blindado)
                </p>

                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400 relative z-10">
                <p>Al cobrar a BCV, recibes: <span className="text-white font-bold">Bs {(precioPublicacion * data.rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                <p className="text-[10px] opacity-70 mt-0.5">Equivalente a recibir el Precio Final (${precioFinal.toFixed(2)}) a tasa paralela</p>
                </div>
            </div>

            {/* Max Discount Highlight */}
            {precioPublicacion > 0 && (
                <div className="mx-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top-2 transition-colors">
                <div className="flex items-center gap-2">
                    <div className="bg-orange-100 dark:bg-orange-900/40 p-1.5 rounded-lg text-orange-600 dark:text-orange-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    </div>
                    <div>
                    <p className="text-xs font-bold text-orange-900 dark:text-orange-300">Descuento Máximo</p>
                    <p className="text-[10px] text-orange-700 dark:text-orange-400/80 leading-tight">Por pago en DIVISAS</p>
                    </div>
                </div>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {maxDiscount.toFixed(1)}%
                </p>
                </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex gap-3 shrink-0 transition-colors">
          <button 
            onClick={handleReset}
            className="flex-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Limpiar
          </button>
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-900 dark:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-[0.98] transition-all text-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};