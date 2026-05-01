import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Metrics {
  utilidadBruta: number; // Sales - COGS
  utilidad: number; // Net Profit (EBITDA)
  margenReal: number;
  roi: number;
  puntoEquilibrio: number; // Break-even amount
  margenSeguridad: number; // % distance from break-even
  ratioEficiencia: number; // Expenses / Sales
  
  // Time metrics (Total)
  costoHora: number;
  ventaHora: number;
  costoDia: number;
  ventaDia: number;

  // Operating Expenses metrics (Just Expenses)
  gastosHora: number;
  gastosDia: number;
  
  // Targets
  ventaObjetivo: number; // Sales needed to reach target margin
  markupSugerido: number; // Markup on cost to reach target margin
  targetMarginUsed: number; // Store the target margin used for reference
  
  // Status
  salud: 'excelente' | 'buena' | 'cuidado' | 'critica';
}

interface ActionItem {
    type: 'critical' | 'warning' | 'opportunity' | 'info';
    title: string;
    description: string;
}

// Helper Component for Tooltips
const TooltipLabel: React.FC<{ label: string; tooltip: string; className?: string; align?: 'left' | 'center' | 'right' }> = ({ label, tooltip, className, align = 'center' }) => (
  <div className={`group relative inline-flex items-center gap-1 cursor-help ${className}`}>
    <span className="border-b border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 transition-colors pb-0.5">{label}</span>
    <div className={`absolute bottom-full mb-2 w-48 p-2.5 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-normal normal-case rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none leading-snug border border-slate-600
      ${align === 'center' ? 'left-1/2 -translate-x-1/2 text-center' : ''}
      ${align === 'left' ? 'left-0 text-left' : ''}
      ${align === 'right' ? 'right-0 text-right' : ''}
    `}>
      {tooltip}
      <div className={`absolute top-full w-0 h-0 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700
        ${align === 'center' ? 'left-1/2 -translate-x-1/2' : ''}
        ${align === 'left' ? 'left-4' : ''}
        ${align === 'right' ? 'right-4' : ''}
      `}></div>
    </div>
  </div>
);

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({ isOpen, onClose }) => {
  // Main Inputs
  const [ventas, setVentas] = useState<string>('');
  const [margenBruto, setMargenBruto] = useState<string>('30'); // Gross Margin %
  const [gastos, setGastos] = useState<string>(''); // OpEx
  const [diasSemana, setDiasSemana] = useState<string>('5');
  const [horasDia, setHorasDia] = useState<string>('8');

  // Advanced Inputs
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [facturasMes, setFacturasMes] = useState<string>('');
  const [empleados, setEmpleados] = useState<string>('');
  const [visitasMes, setVisitasMes] = useState<string>('');
  const [lossAmount, setLossAmount] = useState<string>(''); // NEW: Loss Input

  // Goal Modal State
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [goalAmount, setGoalAmount] = useState<string>('');

  // Notification State
  const [downloadInfo, setDownloadInfo] = useState<{ filename: string; location: string } | null>(null);

  // Computed Values for UI display
  const [costoVentasCalc, setCostoVentasCalc] = useState<number>(0);
  const [actionPlan, setActionPlan] = useState<ActionItem[]>([]);

  // Validation state for Goal Button
  const isGoalCalculatorEnabled = (parseFloat(margenBruto) || 0) > 0 && (parseFloat(gastos) || 0) > 0;

  // Metrics State
  const [m, setM] = useState<Metrics>({
    utilidadBruta: 0,
    utilidad: 0, margenReal: 0, roi: 0, puntoEquilibrio: 0, margenSeguridad: 0, ratioEficiencia: 0,
    costoHora: 0, ventaHora: 0, costoDia: 0, ventaDia: 0, 
    gastosHora: 0, gastosDia: 0,
    ventaObjetivo: 0, markupSugerido: 0, targetMarginUsed: 0,
    salud: 'buena'
  });

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

  // Calculation Logic
  useEffect(() => {
    const v = parseFloat(ventas) || 0;
    const mbPct = parseFloat(margenBruto) || 0;
    const g = parseFloat(gastos) || 0; // OpEx
    
    // NEW LOGIC: Target Net Margin is now the inputted Gross Margin
    const targetNetMarginPct = mbPct > 0 ? mbPct : 20; 

    const dias = parseFloat(diasSemana) || 0;
    const horas = parseFloat(horasDia) || 0;
    
    // 0. Auto-calculate COGS based on Sales and Gross Margin
    // Formula: COGS = Sales * (1 - GrossMargin%)
    const c = v * (1 - (mbPct / 100));
    setCostoVentasCalc(c);

    // Time Constants (Avg weeks per month)
    const weeksPerMonth = 4.33;
    const totalDaysMonth = dias * weeksPerMonth;
    const totalHoursMonth = totalDaysMonth * horas;

    // 1. Basic Financials
    // Gross Profit = Sales - COGS
    const grossProfit = v - c;
    // Net Profit (EBITDA proxy) = Gross Profit - OpEx
    const netProfit = grossProfit - g; 
    
    const marginReal = v > 0 ? (netProfit / v) * 100 : 0;
    const totalCosts = c + g;
    const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
    const efficiency = v > 0 ? (g / v) * 100 : 0; // OpEx / Sales ratio

    // 2. Break-even (Advanced)
    // Formula: Fixed Costs / Gross Margin Ratio
    // Gross Margin Ratio = (Sales - COGS) / Sales (Which is essentially mbPct / 100)
    const grossMarginRatio = v > 0 ? grossProfit / v : (mbPct / 100);
    
    let breakEven = 0;
    if (grossMarginRatio > 0.001) { 
        breakEven = g / grossMarginRatio;
    } else {
        breakEven = 0; 
    }

    const safetyMargin = v > 0 ? ((v - breakEven) / v) * 100 : 0;

    // 3. Time Metrics 
    // A. Total Costs (COGS + OpEx) per unit of time
    const costHour = totalHoursMonth > 0 ? totalCosts / totalHoursMonth : 0;
    const revHour = totalHoursMonth > 0 ? v / totalHoursMonth : 0;
    const costDay = totalDaysMonth > 0 ? totalCosts / totalDaysMonth : 0;
    const revDay = totalDaysMonth > 0 ? v / totalDaysMonth : 0;

    // B. Operating Expenses Only (Fixed Costs) per unit of time - "Open Door Cost"
    const opExHour = totalHoursMonth > 0 ? g / totalHoursMonth : 0;
    const opExDay = totalDaysMonth > 0 ? g / totalDaysMonth : 0;

    // 4. Targets
    // Target Sales to achieve Net Margin Target
    // Formula: Sales = Expenses / (GrossMarginRatio - TargetNetMargin)
    const targetNetMarginDecimal = targetNetMarginPct / 100;
    
    let targetSales = 0;
    const denominator = grossMarginRatio - targetNetMarginDecimal;
    
    // If denominator is <= 0, it means we cannot reach the target net margin 
    // (which equals gross margin) by volume alone because we have expenses.
    // We use -1 to indicate "Impossible via volume" in the UI.
    if (denominator > 0.0001) {
        targetSales = g / denominator;
    } else {
        targetSales = -1; 
    }

    // Markup Suggested
    // Standard markup formula based on the TARGET NET MARGIN assuming expenses are fixed relative ratio.
    // Logic: We want Net Margin = TargetNetMarginPct.
    // Net = Gross - ExpRatio. So RequiredGross = ExpRatio + TargetNetMarginPct.
    // ExpRatio = g / v.
    const currentExpRatio = v > 0 ? g / v : 0;
    const targetGrossMarginDecimal = currentExpRatio + targetNetMarginDecimal;
    
    let markup = 0;
    if (targetGrossMarginDecimal < 1) {
         // Markup = Margin / (1 - Margin)
         markup = (targetGrossMarginDecimal / (1 - targetGrossMarginDecimal)) * 100;
    } else {
        // If required margin >= 100%, it's impossible or requires infinite markup
        markup = 999;
    }

    // 5. Health Status
    let health: Metrics['salud'] = 'buena';
    if (netProfit < 0) health = 'critica';
    else if (marginReal < 5 || safetyMargin < 10) health = 'cuidado';
    else if (marginReal >= targetNetMarginPct) health = 'excelente';

    setM({
        utilidadBruta: grossProfit,
        utilidad: netProfit,
        margenReal: marginReal,
        roi,
        puntoEquilibrio: breakEven,
        margenSeguridad: safetyMargin,
        ratioEficiencia: efficiency,
        costoHora: costHour,
        ventaHora: revHour,
        costoDia: costDay,
        ventaDia: revDay,
        gastosHora: opExHour,
        gastosDia: opExDay,
        ventaObjetivo: targetSales,
        markupSugerido: markup,
        targetMarginUsed: targetNetMarginPct,
        salud: health
    });

    // GENERATE ACTION PLAN
    if (v > 0) {
        const plan: ActionItem[] = [];

        // Critical Checks
        if (netProfit < 0) {
            plan.push({
                type: 'critical',
                title: 'Detener Pérdidas Inmediatamente',
                description: `Estás perdiendo dinero. Tus ingresos ($${formatCurrency(v)}) no cubren el costo total ($${formatCurrency(totalCosts)}). Audita tus gastos fijos hoy mismo o reestructura tu costo de venta.`
            });
        }

        // Efficiency Checks
        if (efficiency > 50) {
            plan.push({
                type: 'warning',
                title: 'Estructura Pesada (Overhead)',
                description: `Tus gastos fijos consumen el ${formatPct(efficiency)} de tus ventas. Esto es insostenible. Debes aligerar la estructura o duplicar ventas sin aumentar gastos.`
            });
        } else if (efficiency > 30) {
            // New Specific Check for Expense Level between 30% and 50%
            plan.push({
                type: 'warning',
                title: 'Nivel de Gasto Elevado',
                description: `Tus gastos operativos absorben el ${formatPct(efficiency)} de tus ingresos. Estás operando con una carga pesada. Revisa línea por línea tus egresos fijos (nómina, servicios, alquiler) y elimina superfluos.`
            });
        }

        // Safety Margin Checks
        if (safetyMargin < 15 && netProfit > 0) {
            plan.push({
                type: 'warning',
                title: 'Vulnerabilidad ante Ventas Bajas',
                description: `Estás demasiado cerca del punto de equilibrio (solo ${formatPct(safetyMargin)} de margen). Una semana mala te pone en pérdidas. Intensifica esfuerzos comerciales para alejarte de la zona de riesgo.`
            });
        }

        // Pricing Checks
        if (marginReal < 5 && netProfit > 0) {
             plan.push({
                type: 'critical',
                title: 'Error de Precios',
                description: `Trabajas mucho para ganar muy poco (${formatPct(marginReal)}). Sube tus precios un 5-10% inmediatamente; aunque pierdas volumen, ganarás más calidad de vida y flujo de caja.`
            });
        }

        // Growth Opportunities
        if (health === 'excelente') {
            plan.push({
                type: 'opportunity',
                title: 'Escalar y Reinvertir',
                description: 'Tu modelo es sólido y rentable. Es el momento seguro para invertir en marketing pagado o comprar inventario por volumen para mejorar aún más el costo.'
            });
        } else if (health === 'buena') {
             plan.push({
                type: 'info',
                title: 'Optimización',
                description: `Tu negocio es estable. Para saltar a "Excelente", enfócate en aumentar el Ticket Promedio (Upselling) sin aumentar los gastos operativos.`
            });
        }

        setActionPlan(plan);
    } else {
        setActionPlan([]);
    }

  }, [ventas, margenBruto, gastos, diasSemana, horasDia]);

  const handleReset = () => {
    setVentas('');
    setMargenBruto('30'); // Default value
    setGastos('');
    setDiasSemana('5'); // Default value
    setHorasDia('8'); // Default value
    setFacturasMes('');
    setEmpleados('');
    setVisitasMes('');
    setLossAmount('');
    setShowAdvanced(false); // Reset UI state
    setDownloadInfo(null);
  };

  const formatCurrency = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPct = (val: number) => `${val.toFixed(2)}%`;

  // Calculate Break-Even specific COGS for the visual explanation
  const ratioCosto = 1 - ((parseFloat(margenBruto) || 0) / 100);
  const breakEvenCostoMercancia = m.puntoEquilibrio * ratioCosto;

  // Calculate Monthly Days for Tooltip
  const daysPerWeek = parseFloat(diasSemana) || 0;
  const daysPerMonth = (daysPerWeek * 4.33).toFixed(1).replace('.0', '');

  // Calculate Monetary Safety Margin (Drop allowed)
  const salesVal = parseFloat(ventas) || 0;
  const allowedDrop = Math.max(0, salesVal - m.puntoEquilibrio);

  // --- ADVANCED METRICS CALCULATIONS ---
  const numFacturas = parseFloat(facturasMes) || 0;
  const numVisitas = parseFloat(visitasMes) || 0;
  const numEmpleados = parseFloat(empleados) || 0;
  
  // Ticket Promedio
  const ticketPromedio = numFacturas > 0 ? salesVal / numFacturas : 0;
  
  // Conversion Rate
  const conversionRate = numVisitas > 0 ? (numFacturas / numVisitas) * 100 : 0;
  
  // Conversion Status Logic
  let conversionStatus = { label: '', color: '' };
  if (conversionRate === 0) {
      conversionStatus = { label: 'N/A', color: 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600' };
  } else if (conversionRate < 15) {
      conversionStatus = { label: 'BAJA', color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' };
  } else if (conversionRate < 25) {
      conversionStatus = { label: 'MEDIA', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' };
  } else if (conversionRate < 40) {
      conversionStatus = { label: 'BUENA', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' };
  } else {
      conversionStatus = { label: 'MUY BUENA', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' };
  }

  // Unit Economics (Per Ticket Breakdown)
  // Uses global ratios calculated in main effect
  const costoTicket = ticketPromedio * (costoVentasCalc / (salesVal || 1));
  const costoTicketPct = ticketPromedio > 0 ? (costoTicket / ticketPromedio) * 100 : 0;

  const gananciaBrutaTicket = ticketPromedio * (m.utilidadBruta / (salesVal || 1));
  const gananciaBrutaTicketPct = ticketPromedio > 0 ? (gananciaBrutaTicket / ticketPromedio) * 100 : 0;

  // Gastos Unitarios (Expenses Per Ticket)
  const gastosTotal = parseFloat(gastos) || 0;
  const gastosTicket = ticketPromedio * (gastosTotal / (salesVal || 1));
  const gastosTicketPct = ticketPromedio > 0 ? (gastosTicket / ticketPromedio) * 100 : 0;

  const gananciaNetaTicket = ticketPromedio * (m.utilidad / (salesVal || 1));
  const gananciaNetaTicketPct = ticketPromedio > 0 ? (gananciaNetaTicket / ticketPromedio) * 100 : 0;

  const ventasPorEmpleado = numEmpleados > 0 ? salesVal / numEmpleados : 0;

  // --- LOSS RECOVERY CALCULATOR ---
  const lossVal = parseFloat(lossAmount) || 0;
  const grossMarginVal = parseFloat(margenBruto) || 0; // Use Gross Margin from Input directly
  let requiredSalesForLoss = 0;
  let lossMultiplier = 0;
  
  if (grossMarginVal > 0 && lossVal > 0) {
      // Formula: Required Sales = Loss / (Gross Margin % / 100)
      requiredSalesForLoss = lossVal / (grossMarginVal / 100);
      lossMultiplier = requiredSalesForLoss / lossVal;
  }

  // --- GOAL CALCULATOR LOGIC ---
  // Formula: Revenue = (Fixed Expenses + Goal Net Profit) / Gross Margin %
  // This assumes Gross Margin is stable.
  const goalTarget = parseFloat(goalAmount) || 0;
  const expensesFixed = parseFloat(gastos) || 0;
  const grossMarginDecimal = (parseFloat(margenBruto) || 0) / 100;
  
  let requiredSalesForGoal = 0;
  let requiredCOGSForGoal = 0;

  if (grossMarginDecimal > 0) {
     requiredSalesForGoal = (expensesFixed + goalTarget) / grossMarginDecimal;
     requiredCOGSForGoal = requiredSalesForGoal * (1 - grossMarginDecimal);
  }

  // Calculate Net Profit % for the Goal Scenario
  // Profit / Total Sales
  const goalNetMarginPct = requiredSalesForGoal > 0 ? (goalTarget / requiredSalesForGoal) * 100 : 0;

  // Calculate Time-based Goals
  const daysPerWeekVal = parseFloat(diasSemana) || 0;
  const hoursPerDayVal = parseFloat(horasDia) || 0;
  const daysInMonth = daysPerWeekVal * 4.33;
  
  let dailyGoal = 0;
  let hourlyGoal = 0;

  if (requiredSalesForGoal > 0 && daysInMonth > 0) {
      dailyGoal = requiredSalesForGoal / daysInMonth;
      if (hoursPerDayVal > 0) {
          hourlyGoal = dailyGoal / hoursPerDayVal;
      }
  }

  // --- GAUGE LOGIC FOR RENTABILIDAD NETA ---
  const getNetMarginGauge = (pct: number) => {
    // Range Logic requested:
    // < 6: Red (Crítica)
    // 6 - 15: Yellow (Baja/Media)
    // 16 - 35: Green (Buena/Muy Buena)
    // > 35: Gold (Excelente)

    // Normalize for visual fill (cap at 50% for 180 degree gauge)
    const normalized = Math.min(Math.max(pct, 0), 50);
    const percentageOfGauge = normalized / 50; 
    
    // SVG Config
    const circumference = 88;
    const dashOffset = circumference * (1 - percentageOfGauge);

    let color = '#ef4444'; // red-500
    let label = 'Crítica';
    let textClass = 'text-red-500 dark:text-red-400';
    
    if (pct >= 6) {
        color = '#eab308'; // yellow-500
        label = 'Baja/Media';
        textClass = 'text-yellow-600 dark:text-yellow-400';
    }
    if (pct >= 16) {
        color = '#10b981'; // emerald-500
        label = 'Buena';
        textClass = 'text-emerald-600 dark:text-emerald-400';
    }
    if (pct > 35) {
        color = '#f59e0b'; // amber-500 (Gold)
        label = 'Excelente';
        textClass = 'text-amber-500 dark:text-amber-400';
    }

    return { dashOffset, color, label, textClass };
  };

  const netMarginGauge = getNetMarginGauge(m.margenReal);


  // --- PDF GENERATION ---
  const canPrint = parseFloat(ventas) > 0 && parseFloat(margenBruto) > 0;

  const generatePDF = () => {
    if (!canPrint) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const colGap = 5;
    const colWidth = (pageWidth - (margin * 2) - colGap) / 2;
    
    // Header (Compact)
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('DIAGNOSTICO FINANCIERO 360º', margin, 10);
    doc.setFontSize(8);
    doc.text('Informe Financiero & Operativo - CriptoPana', margin, 16);
    
    const dateStr = new Date().toLocaleDateString('es-VE', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    doc.setFontSize(8);
    doc.text(dateStr, pageWidth - margin, 16, { align: 'right' });

    let leftY = 32;
    let rightY = 32;

    const commonTableStyles = { fontSize: 7, cellPadding: 1.5 };
    const commonHeadStyles = { fontSize: 8, fontStyle: 'bold' as const };

    // --- LEFT COLUMN CONTENT ---

    // 1. INPUTS
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text('1. Estructura de Costos', margin, leftY);
    leftY += 3;

    autoTable(doc, {
        startY: leftY,
        margin: { left: margin },
        tableWidth: colWidth,
        head: [['Concepto', 'Valor']],
        body: [
            ['Ventas Mensuales', `$${formatCurrency(parseFloat(ventas))}`],
            ['Margen Bruto', `${margenBruto}%`],
            ['Gastos Operativos', `$${formatCurrency(parseFloat(gastos))}`],
            ['Costo Mercancía', `$${formatCurrency(costoVentasCalc)}`],
            ['Días Laborables', `${diasSemana} días/sem`],
            ['Horas Laborables', `${horasDia} h/día`]
        ],
        theme: 'grid',
        headStyles: { ...commonHeadStyles, fillColor: [71, 85, 105] },
        styles: commonTableStyles
    });
    // @ts-ignore
    leftY = doc.lastAutoTable.finalY + 8;

    // 3. EFICIENCIA OPERATIVA
    doc.setFontSize(10);
    doc.text('3. Eficiencia Operativa', margin, leftY);
    leftY += 3;

    autoTable(doc, {
        startY: leftY,
        margin: { left: margin },
        tableWidth: colWidth,
        head: [['Métrica', 'Diario', 'Hora']],
        body: [
            ['Costo TOTAL', `$${formatCurrency(m.costoDia)}`, `$${formatCurrency(m.costoHora)}`],
            ['Ventas Reales', `$${formatCurrency(m.ventaDia)}`, `$${formatCurrency(m.ventaHora)}`],
            ['Gastos Fijos', `$${formatCurrency(m.gastosDia)}`, `$${formatCurrency(m.gastosHora)}`],
        ],
        theme: 'grid',
        headStyles: { ...commonHeadStyles, fillColor: [124, 58, 237] }, // Purple
        styles: commonTableStyles
    });
    // @ts-ignore
    leftY = doc.lastAutoTable.finalY + 8;

    // 4. METRICAS AVANZADAS (Left Column if exists)
    if (numFacturas > 0 || numVisitas > 0 || numEmpleados > 0) {
        doc.setFontSize(10);
        doc.text('4. Métricas Avanzadas', margin, leftY);
        leftY += 3;

        autoTable(doc, {
            startY: leftY,
            margin: { left: margin },
            tableWidth: colWidth,
            head: [['Indicador', 'Valor']],
            body: [
                ['Ticket Promedio', `$${formatCurrency(ticketPromedio)}`],
                ['Costo/Ticket', `$${formatCurrency(costoTicket)}`],
                ['Ganancia Neta/Ticket', `$${formatCurrency(gananciaNetaTicket)}`],
                ['Conversión', formatPct(conversionRate)],
                ['Ventas/Empleado', `$${formatCurrency(ventasPorEmpleado)}`]
            ],
            theme: 'grid',
            headStyles: { ...commonHeadStyles, fillColor: [59, 130, 246] }, // Blue
            styles: commonTableStyles
        });
        // @ts-ignore
        leftY = doc.lastAutoTable.finalY + 8;
    }


    // --- RIGHT COLUMN CONTENT ---

    // 2. RENTABILIDAD
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text('2. Rentabilidad y Riesgo', margin + colWidth + colGap, rightY);
    rightY += 3;

    autoTable(doc, {
        startY: rightY,
        margin: { left: margin + colWidth + colGap },
        tableWidth: colWidth,
        head: [['Métrica', 'Resultado']],
        body: [
            ['Utilidad Neta (EBITDA)', `$${formatCurrency(m.utilidad)}`],
            ['Margen Neto Real', formatPct(m.margenReal)],
            ['Punto de Equilibrio', `$${formatCurrency(m.puntoEquilibrio)}`],
            ['Margen Seguridad', formatPct(m.margenSeguridad)],
            ['Markup Sugerido', formatPct(m.markupSugerido)],
            ['Absorción Gastos', formatPct(m.ratioEficiencia)]
        ],
        theme: 'striped',
        headStyles: { ...commonHeadStyles, fillColor: [16, 185, 129] }, // Emerald
        styles: commonTableStyles
    });
    // @ts-ignore
    rightY = doc.lastAutoTable.finalY + 8;

    // 5. META FINANCIERA (if exists)
    if (goalTarget > 0) {
        doc.setFontSize(10);
        doc.text('5. Meta Financiera', margin + colWidth + colGap, rightY);
        rightY += 3;

        autoTable(doc, {
            startY: rightY,
            margin: { left: margin + colWidth + colGap },
            tableWidth: colWidth,
            head: [['Indicador', 'Valor']],
            body: [
                ['Ganancia Deseada', `$${formatCurrency(goalTarget)}`],
                ['Ventas Requeridas', `$${formatCurrency(requiredSalesForGoal)}`]
            ],
            theme: 'grid',
            headStyles: { ...commonHeadStyles, fillColor: [59, 130, 246] }, // Blue
            styles: commonTableStyles
        });
         // @ts-ignore
        rightY = doc.lastAutoTable.finalY + 6;
    }

    // 6. EFECTO MULTIPLICADOR
    if (lossVal > 0) {
        doc.setFontSize(10);
        doc.text('Efecto Multiplicador (Fugas)', margin + colWidth + colGap, rightY);
        rightY += 3;

        autoTable(doc, {
            startY: rightY,
            margin: { left: margin + colWidth + colGap },
            tableWidth: colWidth,
            head: [['Concepto', 'Valor']],
            body: [
                ['Pérdida (Merma/Error)', `$${formatCurrency(lossVal)}`],
                ['Venta para Recuperar', `$${formatCurrency(requiredSalesForLoss)}`],
                ['Multiplicador', `${lossMultiplier.toFixed(1)}x`]
            ],
            theme: 'grid',
            headStyles: { ...commonHeadStyles, fillColor: [249, 115, 22] }, // Orange
            styles: commonTableStyles
        });
        // @ts-ignore
        let noteY = doc.lastAutoTable.finalY + 3;
        
        doc.setFontSize(7);
        doc.setTextColor(194, 65, 12); // Dark Orange
        doc.setFont('helvetica', 'bold');
        
        const note = `"CUIDAR COSTOS Y EVITAR FUGAS POR: $${formatCurrency(lossVal)} ES MÁS EFICIENTE QUE TENER QUE VENDER: $${formatCurrency(requiredSalesForLoss)}."`;
        const splitNote = doc.splitTextToSize(note, colWidth);
        doc.text(splitNote, margin + colWidth + colGap, noteY);
        
        rightY = noteY + (splitNote.length * 3) + 4;
        
        // Reset styles
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
    }

    // --- BOTTOM SECTION (FULL WIDTH) ---
    // Determine where to start the bottom section
    let finalY = Math.max(leftY, rightY) + 2;

    // 5. PLAN DE ACCION
    if (actionPlan.length > 0) {
        // Check for page overflow risk
        if (finalY > pageHeight - 50) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(10);
        doc.text('Plan de Acción Gerencial', margin, finalY);
        finalY += 3;

        const actionRows = actionPlan.map(item => {
            const typeLabel = item.type === 'critical' ? 'CRITICO' : item.type === 'warning' ? 'ALERTA' : item.type === 'opportunity' ? 'OPORTUNIDAD' : 'INFO';
            return [typeLabel, item.title, item.description];
        });

        autoTable(doc, {
            startY: finalY,
            margin: { left: margin },
            tableWidth: pageWidth - (margin * 2), // Full width
            head: [['Prioridad', 'Acción', 'Descripción']],
            body: actionRows,
            theme: 'grid',
            headStyles: { ...commonHeadStyles, fillColor: [15, 23, 42] }, // Slate 900
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 25 },
                1: { fontStyle: 'bold', cellWidth: 40 },
                2: { cellWidth: 'auto' }
            }
        });
    }

     // Footer Disclaimer
     doc.setFontSize(7);
     doc.setTextColor(150);
     doc.text('Reporte generado por CriptoDolar App. Valores estimados.', margin, pageHeight - 5);

    // FILENAME DEFINITION
    const filename = `Diagnostico_Financiero_${new Date().toISOString().slice(0,10)}.pdf`;
    
    doc.save(filename);

    // Show Notification Toast
    setDownloadInfo({
        filename: filename,
        location: "Carpeta de Descargas (Downloads)"
    });

    // Auto hide after 6 seconds
    setTimeout(() => {
        setDownloadInfo(null);
    }, 6000);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* DOWNLOAD NOTIFICATION TOAST */}
      {downloadInfo && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-sm animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-slate-700/50 backdrop-blur-md">
                <div className="bg-green-500/20 p-2 rounded-full text-green-400 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm">¡Reporte Descargado!</h4>
                    <div className="mt-1 space-y-1">
                        <p className="text-xs text-slate-300">
                            Archivo: <span className="font-mono text-emerald-300 break-all">{downloadInfo.filename}</span>
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            {downloadInfo.location}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setDownloadInfo(null)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
      )}

      {/* Main Modal Content */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-slate-900 dark:bg-black px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              Diagnóstico Financiero 360°
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Análisis de rentabilidad, solvencia y eficiencia operativa</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 relative">
          <div className="p-6 space-y-6">
          
            {/* INPUTS ROW */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Datos de Entrada</h4>
                    <button 
                        onClick={() => setShowAdvanced(true)}
                        disabled={!canPrint}
                        title={!canPrint ? "Ingresa Ventas y Margen para habilitar" : "Ver métricas avanzadas"}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors
                            ${canPrint
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
                                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Avanzado
                    </button>
                </div>
                
                {/* Changed grid to 5 columns since we removed one input */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="col-span-1">
                        <TooltipLabel 
                          label="Ventas Mes" 
                          tooltip="Total facturado en el mes (Ingresos Brutos)." 
                          className="text-[10px] uppercase font-bold text-slate-500 mb-1"
                          align="left"
                        />
                        <input type="number" value={ventas} onChange={e => setVentas(e.target.value)} placeholder="0" className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="col-span-1">
                        <TooltipLabel 
                          label="Margen Bruto %" 
                          tooltip="% Ganancia sobre la mercancía (antes de gastos)." 
                          className="text-[10px] uppercase font-bold text-slate-500 mb-1"
                          align="left"
                        />
                        <div className="relative">
                            <input type="number" value={margenBruto} onChange={e => setMargenBruto(e.target.value)} placeholder="30" className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2 pr-6 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                            <div className="absolute inset-y-0 right-0 pr-2 pt-1 flex items-center pointer-events-none">
                                <span className="text-slate-400 dark:text-slate-500 font-bold text-xs">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-1">
                        <TooltipLabel 
                          label="Gastos Op." 
                          tooltip="Total Gastos Fijos (Alquiler, Nómina, Servicios...)." 
                          className="text-[10px] uppercase font-bold text-slate-500 mb-1"
                          align="left"
                        />
                        <input type="number" value={gastos} onChange={e => setGastos(e.target.value)} placeholder="0" className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    {/* Removed Meta Neta Input */}
                    <div className="col-span-1">
                        <TooltipLabel 
                          label="Días/Sem" 
                          tooltip={`Días que abre el negocio por semana (aprox. ${daysPerMonth} al mes).`} 
                          className="text-[10px] uppercase font-bold text-slate-500 mb-1"
                        />
                        <input type="number" value={diasSemana} onChange={e => setDiasSemana(e.target.value)} max={7} placeholder="5" className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-center" />
                    </div>
                    <div className="col-span-1">
                        <TooltipLabel 
                          label="Horas/Día" 
                          tooltip="Horas de operación diaria." 
                          className="text-[10px] uppercase font-bold text-slate-500 mb-1"
                        />
                        <input type="number" value={horasDia} onChange={e => setHorasDia(e.target.value)} max={24} placeholder="8" className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-center" />
                    </div>
                </div>
            </div>

            {/* KPI DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. SOLVENCIA & RENTABILIDAD */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            Rentabilidad Neta
                        </h4>
                        
                        {/* Health Status Badge with Tooltip */}
                        <div className="group relative cursor-help">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide
                                ${m.salud === 'excelente' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 
                                m.salud === 'buena' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                                m.salud === 'cuidado' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' :
                                'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                                }`}>
                                {m.salud}
                            </span>
                            {/* Tooltip Content */}
                            <div className="absolute top-full right-0 mt-2 w-56 p-2.5 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-normal normal-case rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none leading-snug border border-slate-600 text-left">
                                <p className="font-bold border-b border-slate-600 pb-1 mb-1 text-slate-300">Criterios de Salud:</p>
                                <ul className="space-y-1.5 list-none opacity-90">
                                    <li className="flex items-start gap-1.5"><span className="font-bold text-red-400 shrink-0 mt-0.5">• Crítica:</span> <span className="leading-tight">Estás perdiendo dinero.</span></li>
                                    <li className="flex items-start gap-1.5"><span className="font-bold text-yellow-400 shrink-0 mt-0.5">• Cuidado:</span> <span className="leading-tight">Riesgo alto. Margen o seguridad bajos.</span></li>
                                    <li className="flex items-start gap-1.5"><span className="font-bold text-blue-400 shrink-0 mt-0.5">• Buena:</span> <span className="leading-tight">Rentable. Puede mejorar.</span></li>
                                    <li className="flex items-start gap-1.5"><span className="font-bold text-emerald-400 shrink-0 mt-0.5">• Excelente:</span> <span className="leading-tight">Negocio saludable y eficiente.</span></li>
                                </ul>
                                <div className="absolute bottom-full right-4 w-0 h-0 border-4 border-transparent border-b-slate-800 dark:border-b-slate-700"></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-end justify-between mb-4">
                        <div>
                            <TooltipLabel 
                            label="Utilidad Neta (EBITDA)" 
                            tooltip="Ganancia real (Ventas - Costos - Gastos)." 
                            className="text-xs text-slate-500 mb-1"
                            align="left"
                            />
                            <p className={`text-3xl font-black tracking-tighter ${m.utilidad >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                $ {formatCurrency(m.utilidad)}
                            </p>
                        </div>

                         {/* NET MARGIN GAUGE */}
                         <div className="relative w-24 h-12 flex items-end justify-center pb-1">
                             <div className="absolute top-0 left-0 w-full text-center">
                                 <TooltipLabel 
                                    label="Margen Neto" 
                                    tooltip="% de ganancia real final (Bolsillo)." 
                                    className="text-[9px] text-slate-400 font-bold uppercase"
                                    align="center"
                                />
                             </div>
                             {/* SVG Gauge */}
                             <svg width="80" height="40" viewBox="0 0 64 34" className="overflow-visible mt-2">
                                <path d="M 4 30 A 28 28 0 0 1 60 30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                                <path 
                                    d="M 4 30 A 28 28 0 0 1 60 30" 
                                    fill="none" 
                                    stroke={netMarginGauge.color}
                                    strokeWidth="6" 
                                    strokeLinecap="round" 
                                    strokeDasharray="88" 
                                    strokeDashoffset={netMarginGauge.dashOffset}
                                    className="transition-all duration-700 ease-out"
                                />
                             </svg>
                             <div className={`absolute bottom-0 text-sm font-bold ${netMarginGauge.textClass}`}>
                                 {m.margenReal.toFixed(1)}%
                             </div>
                             {m.margenReal > 35 && (
                                <div className="absolute -right-2 top-2 text-lg animate-pulse">💎</div>
                             )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div>
                             <TooltipLabel 
                                label="Costo Mercancía" 
                                tooltip="Costo de reposición de lo vendido." 
                                className="text-[10px] text-slate-400 uppercase font-bold"
                                align="left"
                             />
                             <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                $ {formatCurrency(costoVentasCalc)}
                             </p>
                        </div>
                         <div>
                            <TooltipLabel 
                              label="Absorción Gastos" 
                              tooltip="% de la venta consumido por gastos fijos." 
                              className="text-[10px] text-slate-400 uppercase font-bold"
                              align="left"
                            />
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                {formatPct(m.ratioEficiencia)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. PUNTO DE EQUILIBRIO */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                     <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        Equilibrio & Riesgo
                    </h4>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <TooltipLabel 
                              label="Punto de Equilibrio" 
                              tooltip="Venta mínima para cubrir costos y gastos (Ni ganas ni pierdes)."
                              className="text-xs text-slate-500 dark:text-slate-400"
                              align="left"
                            />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">$ {formatCurrency(m.puntoEquilibrio)}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-orange-400 h-full rounded-full" style={{ width: `${Math.min((m.puntoEquilibrio / (parseFloat(ventas) || 1)) * 100, 100)}%` }}></div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-3">
                            <div>
                                <TooltipLabel 
                                    label="Margen Seguridad %" 
                                    tooltip="% que pueden caer las ventas sin entrar en pérdidas." 
                                    className="text-[10px] text-slate-400 uppercase font-bold"
                                    align="left"
                                />
                                <p className={`text-lg font-bold ${m.margenSeguridad > 20 ? 'text-emerald-500' : m.margenSeguridad > 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {formatPct(m.margenSeguridad)}
                                </p>
                            </div>
                            <div>
                                <TooltipLabel 
                                    label="Caída Permitida ($)" 
                                    tooltip="Dinero que puedes dejar de vender sin perder." 
                                    className="text-[10px] text-slate-400 uppercase font-bold"
                                    align="left"
                                />
                                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                    $ {formatCurrency(allowedDrop)}
                                </p>
                            </div>
                        </div>
                        
                        {/* Breakdown Box - Math Proof */}
                        <div className="mt-3 p-2.5 bg-orange-50 dark:bg-orange-900/10 rounded-lg text-[10px] space-y-1.5 border border-orange-100 dark:border-orange-900/30">
                           <p className="font-bold text-orange-800 dark:text-orange-300 mb-1 border-b border-orange-200 dark:border-orange-800/30 pb-1">
                               Prueba Matemática (Desglose):
                           </p>
                           <div className="flex justify-between text-slate-600 dark:text-slate-400">
                               <span>(+) Ventas Equilibrio:</span> 
                               <span className="font-medium text-slate-800 dark:text-slate-200">${formatCurrency(m.puntoEquilibrio)}</span>
                           </div>
                           <div className="flex justify-between text-slate-500 italic">
                               <TooltipLabel 
                                    label="(-) Costo Mercancía (Var):"
                                    tooltip="Costo de mercancía ajustado al volumen de equilibrio."
                                    className="border-none cursor-help"
                                    align="center"
                               />
                               <span>-${formatCurrency(breakEvenCostoMercancia)}</span>
                           </div>
                           <div className="flex justify-between text-slate-500">
                               <span>(-) Gastos Fijos:</span> 
                               <span>-${formatCurrency(parseFloat(gastos) || 0)}</span>
                           </div>
                           <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 pt-1 border-t border-orange-200 dark:border-orange-800/30">
                               <span>(=) Resultado Neto:</span> 
                               <span>$0.00</span>
                           </div>
                        </div>
                    </div>
                </div>

                {/* 3. MICRO-GERENCIA (TIME) */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/50">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Eficiencia Operativa (Hora/Día)
                    </h4>
                    
                    {/* NEW SECTION: Open Door Cost (Fixed OpEx) */}
                    <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3 mb-4 border border-purple-100 dark:border-purple-900/30">
                        <h5 className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                           Costo Fijo "Puertas Abiertas"
                           <div className="group relative">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 cursor-help"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center font-normal normal-case">
                                    Lo que cuesta abrir el negocio un día sin vender nada.
                                </div>
                           </div>
                        </h5>
                        <div className="flex justify-between items-end">
                            <div>
                                 <p className="text-xs text-purple-600/70 dark:text-purple-400/70 font-medium">Por Hora</p>
                                 <p className="text-xl font-bold text-purple-800 dark:text-purple-200">$ {formatCurrency(m.gastosHora)}</p>
                            </div>
                             <div className="text-right">
                                 <p className="text-xs text-purple-600/70 dark:text-purple-400/70 font-medium">Por Día</p>
                                 <p className="text-xl font-bold text-purple-800 dark:text-purple-200">$ {formatCurrency(m.gastosDia)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                        <div>
                            <TooltipLabel 
                                label="Costo Total / Hora" 
                                tooltip="Costo Operativo + Mercancía por hora." 
                                className="text-[10px] text-slate-400 uppercase font-bold"
                                align="left"
                            />
                            <p className="text-base font-bold text-slate-700 dark:text-slate-300">$ {formatCurrency(m.costoHora)}</p>
                        </div>
                        <div>
                            <TooltipLabel 
                                label="Venta por Hora" 
                                tooltip="Lo que facturas cada hora." 
                                className="text-[10px] text-slate-400 uppercase font-bold"
                                align="left"
                            />
                            <p className={`text-base font-bold ${m.ventaHora > m.costoHora ? 'text-emerald-500' : 'text-red-500'}`}>$ {formatCurrency(m.ventaHora)}</p>
                        </div>
                        <div>
                            <TooltipLabel 
                                label="Costo Total / Día" 
                                tooltip="Costo total de operar un día." 
                                className="text-[10px] text-slate-400 uppercase font-bold"
                                align="left"
                            />
                            <p className="text-base font-bold text-slate-700 dark:text-slate-300">$ {formatCurrency(m.costoDia)}</p>
                        </div>
                        <div>
                            <TooltipLabel 
                                label="Venta Diaria Real" 
                                tooltip="Promedio de venta diaria actual." 
                                className="text-[10px] text-slate-400 uppercase font-bold"
                                align="left"
                            />
                            <p className={`text-base font-bold ${m.ventaDia > m.costoDia ? 'text-emerald-500' : 'text-red-500'}`}>$ {formatCurrency(m.ventaDia)}</p>
                        </div>
                    </div>
                </div>

                {/* 4. ESTRATEGIA DE PRECIOS (Replaces Proyección & Metas) */}
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/30 flex flex-col justify-center relative overflow-hidden">
                    {/* Decorative BG element */}
                    <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-blue-400/10 rounded-full blur-xl"></div>

                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            Ajuste de Precios
                        </h4>
                        
                        {/* New Goal Button */}
                        <button 
                            onClick={() => setShowGoalModal(true)}
                            disabled={!isGoalCalculatorEnabled}
                            title={!isGoalCalculatorEnabled ? "Ingresa Margen y Gastos para calcular" : "Calcular Meta"}
                            className={`text-[10px] font-bold px-2 py-1 rounded-full shadow-md transition-colors flex items-center gap-1 active:scale-95 ${
                                isGoalCalculatorEnabled 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            Mi Meta
                        </button>
                    </div>

                    <p className="text-[10px] text-blue-400 mb-4 leading-relaxed relative z-10">
                        Para que tu <strong>Utilidad Neta</strong> sea igual al {formatPct(m.targetMarginUsed)}, necesitas ajustar tu margen comercial para cubrir los gastos operativos.
                    </p>
                    
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <p className="text-xs text-blue-500/80 font-medium mb-0.5">Markup Necesario</p>
                            <div className="text-4xl font-black text-blue-600 dark:text-blue-300 tracking-tighter">
                                {m.markupSugerido > 500 ? '>500%' : formatPct(m.markupSugerido)}
                            </div>
                            <p className="text-[9px] text-blue-400 mt-1">Sobre costo de producto</p>
                        </div>

                        <div className="text-right">
                            <div className="bg-white dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Nuevo Margen Bruto</p>
                                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                                        {formatPct(m.targetMarginUsed + m.ratioEficiencia)}
                                    </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            
            {/* 5. NEW FINANCIAL ACTION PLAN SECTION */}
            {actionPlan.length > 0 && (
                <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 shadow-xl border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                            </svg>
                        </div>
                        <h4 className="text-base font-bold text-white tracking-wide">Plan de Acción Gerencial</h4>
                    </div>

                    <div className="space-y-3">
                        {actionPlan.map((action, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border-l-4 ${
                                action.type === 'critical' ? 'bg-red-500/10 border-red-500' :
                                action.type === 'warning' ? 'bg-orange-500/10 border-orange-500' :
                                action.type === 'opportunity' ? 'bg-emerald-500/10 border-emerald-500' :
                                'bg-blue-500/10 border-blue-500'
                            }`}>
                                <h5 className={`text-xs font-bold uppercase mb-1 ${
                                    action.type === 'critical' ? 'text-red-400' :
                                    action.type === 'warning' ? 'text-orange-400' :
                                    action.type === 'opportunity' ? 'text-emerald-400' :
                                    'text-blue-400'
                                }`}>
                                    {action.type === 'critical' ? '🔴 CRÍTICO: ' : 
                                     action.type === 'warning' ? '🟠 ALERTA: ' : 
                                     action.type === 'opportunity' ? '🟢 OPORTUNIDAD: ' : '🔵 CONSEJO: '}
                                    {action.title}
                                </h5>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    {action.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

          </div>
          
          {/* ADVANCED MODAL OVERLAY */}
          {showAdvanced && (
            <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900 p-6 animate-in slide-in-from-bottom-5 fade-in duration-300 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Métricas Avanzadas de Retail
                    </h3>
                    <button onClick={() => setShowAdvanced(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* INPUTS FOR ADVANCED */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div>
                             <TooltipLabel 
                                label="Facturas Mes" 
                                tooltip="Nro. de tickets/facturas al mes."
                                className="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                                align="left"
                             />
                             <input type="number" value={facturasMes} onChange={e => setFacturasMes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" placeholder="0" />
                        </div>
                        <div>
                             <TooltipLabel 
                                label="Empleados" 
                                tooltip="Total personas en el equipo."
                                className="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                                align="left"
                             />
                             <input type="number" value={empleados} onChange={e => setEmpleados(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" placeholder="0" />
                        </div>
                        <div>
                             <TooltipLabel 
                                label="Visitas Local" 
                                tooltip="Tráfico de personas (Entradas)."
                                className="block text-[10px] font-bold text-slate-500 uppercase mb-1"
                                align="left"
                             />
                             <input type="number" value={visitasMes} onChange={e => setVisitasMes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" placeholder="0" />
                        </div>
                    </div>

                    {/* RESULTS GRID */}
                    <div className="space-y-4">
                        
                        {/* 1. TOP METRICS ROW (Ticket, Conversion, Sales/Emp) */}
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            
                            {/* TICKET PROMEDIO */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                <div className="mb-2">
                                    <TooltipLabel 
                                        label="Ticket Promedio" 
                                        tooltip="Venta promedio por cliente."
                                        className="text-xs font-bold text-slate-500 uppercase tracking-wide"
                                        align="left"
                                    />
                                    <p className="text-[10px] text-slate-400">Ventas / Facturas</p>
                                </div>
                                <p className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">$ {formatCurrency(ticketPromedio)}</p>
                            </div>

                            {/* TASA DE CONVERSION */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-2">
                                     <TooltipLabel 
                                        label="Tasa de Conversión" 
                                        tooltip="% de visitantes que compran."
                                        className="text-[10px] font-bold text-slate-500 uppercase"
                                        align="left"
                                    />
                                    <div className="group relative cursor-help">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${conversionStatus.color}`}>
                                            {conversionStatus.label}
                                        </span>
                                        {/* Tooltip Content for Conversion Ranges */}
                                        <div className="absolute bottom-full right-0 mb-2 w-40 p-2.5 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-normal normal-case rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none leading-snug border border-slate-600 text-left">
                                            <p className="font-bold border-b border-slate-600 pb-1 mb-1 text-slate-300 text-center">Rangos:</p>
                                            <ul className="space-y-1 list-none opacity-90">
                                                <li className="flex justify-between"><span className="text-red-400 font-bold">Baja:</span> <span>&lt; 15%</span></li>
                                                <li className="flex justify-between"><span className="text-yellow-400 font-bold">Media:</span> <span>15% - 25%</span></li>
                                                <li className="flex justify-between"><span className="text-blue-400 font-bold">Buena:</span> <span>25% - 40%</span></li>
                                                <li className="flex justify-between"><span className="text-emerald-400 font-bold">Muy Buena:</span> <span>&ge; 40%</span></li>
                                            </ul>
                                            <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatPct(conversionRate)}</p>
                                    <p className="text-[9px] text-slate-400 mt-1">De Visitas a Facturas</p>
                                </div>
                            </div>

                            {/* VENTAS POR EMPLEADO */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                <div className="mb-2">
                                    <TooltipLabel 
                                        label="Ventas / Empleado" 
                                        tooltip="Facturación por persona del equipo."
                                        className="text-[10px] font-bold text-slate-500 uppercase"
                                        align="left"
                                    />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">$ {formatCurrency(ventasPorEmpleado)}</p>
                                    <p className="text-[9px] text-slate-400 mt-1">Productividad laboral</p>
                                </div>
                            </div>
                         </div>

                        {/* 2. UNIT ECONOMICS TABLE */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                             <div className="bg-slate-100 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                 <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Economía Unitaria (Por Ticket)</h4>
                             </div>
                             <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                 <div className="px-4 py-3 flex justify-between items-center">
                                     <TooltipLabel 
                                        label="(-) Costo Promedio" 
                                        tooltip="Costo de mercancía por cliente."
                                        className="text-xs font-medium text-slate-500"
                                        align="left"
                                     />
                                     <div className="text-right">
                                         <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">$ {formatCurrency(costoTicket)}</span>
                                         <span className="text-[10px] text-slate-400 block">{formatPct(costoTicketPct)}</span>
                                     </div>
                                 </div>
                                 <div className="px-4 py-3 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/10">
                                     <TooltipLabel 
                                        label="(=) Ganancia Bruta" 
                                        tooltip="Ganancia bruta por cliente."
                                        className="text-xs font-bold text-emerald-700 dark:text-emerald-500"
                                        align="left"
                                     />
                                     <div className="text-right">
                                         <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 block">$ {formatCurrency(gananciaBrutaTicket)}</span>
                                         <span className="text-[10px] text-emerald-600/70 block">{formatPct(gananciaBrutaTicketPct)}</span>
                                     </div>
                                 </div>
                                 {/* NEW ROW: Gastos Unitarios */}
                                 <div className="px-4 py-3 flex justify-between items-center bg-purple-50/50 dark:bg-purple-900/10">
                                     <TooltipLabel 
                                        label="(-) Gastos Unitarios" 
                                        tooltip="Gasto operativo por cliente."
                                        className="text-xs font-medium text-purple-700 dark:text-purple-400"
                                        align="left"
                                     />
                                     <div className="text-right">
                                         <span className="text-sm font-bold text-purple-700 dark:text-purple-300 block">$ {formatCurrency(gastosTicket)}</span>
                                         <span className="text-[10px] text-purple-600/70 block">{formatPct(gastosTicketPct)}</span>
                                     </div>
                                 </div>
                                  <div className="px-4 py-3 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10">
                                     <TooltipLabel 
                                        label="(=) Ganancia Neta" 
                                        tooltip="Ganancia neta real por cliente."
                                        className="text-xs font-bold text-blue-700 dark:text-blue-500"
                                        align="left"
                                     />
                                     <div className="text-right">
                                         <span className="text-sm font-bold text-blue-700 dark:text-blue-400 block">$ {formatCurrency(gananciaNetaTicket)}</span>
                                         <span className="text-[10px] text-blue-600/70 block">{formatPct(gananciaNetaTicketPct)}</span>
                                     </div>
                                 </div>
                             </div>
                        </div>

                        {/* 3. LOSS MULTIPLIER (EFECTO MULTIPLICADOR) - NEW */}
                        <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-xl border-2 border-orange-100 dark:border-orange-900/40 p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    Efecto Multiplicador de Pérdidas
                                </h4>
                                {lossMultiplier > 0 && (
                                    <span className="bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-[10px] font-bold px-2 py-0.5 rounded">
                                        Multiplicador: {lossMultiplier.toFixed(1)}x
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Pérdida (Merma/Robo/Error)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                            <span className="text-slate-400 font-bold text-xs">$</span>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={lossAmount} 
                                            onChange={e => setLossAmount(e.target.value)} 
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-6 pr-2 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" 
                                            placeholder="0" 
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 text-right pb-1">
                                    {lossVal > 0 ? (
                                        grossMarginVal > 0 ? (
                                            <>
                                                <p className="text-[10px] text-slate-400 font-medium">Debes vender extra:</p>
                                                <p className="text-2xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
                                                    $ {formatCurrency(requiredSalesForLoss)}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-xs font-bold text-red-500">Imposible recuperar (Margen bruto 0)</p>
                                        )
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic">Ingresa un monto para calcular</p>
                                    )}
                                </div>
                            </div>
                            {lossMultiplier > 0 && lossVal > 0 && (
                                <div className="mt-3 pt-2 border-t border-dashed border-orange-200 dark:border-orange-800/30">
                                    <div className="bg-orange-100/50 dark:bg-orange-900/20 p-2 rounded-lg border border-orange-100 dark:border-orange-900/30 text-center">
                                        <p className="text-[10px] text-orange-800 dark:text-orange-200 font-bold uppercase leading-relaxed">
                                            "CUIDAR COSTOS Y EVITAR FUGAS POR: ${formatCurrency(lossVal)} ES MÁS EFICIENTE QUE TENER QUE VENDER: ${formatCurrency(requiredSalesForLoss)}."
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
          )}
          
          {/* GOAL MODAL OVERLAY */}
          {showGoalModal && (
            <div className="absolute inset-0 z-20 bg-slate-900/95 p-6 animate-in zoom-in-95 fade-in duration-200 flex items-center justify-center">
                <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            Calculadora de Meta
                        </h4>
                        <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    
                    <div className="p-6">
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ganancia Mensual Deseada ($)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-400 font-bold">$</span>
                                </div>
                                <input 
                                    type="number" 
                                    value={goalAmount} 
                                    onChange={e => setGoalAmount(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl pl-8 py-3 text-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {requiredSalesForGoal > 0 ? (
                            <div className="space-y-4">
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 text-center">
                                    <p className="text-xs font-bold text-blue-500 uppercase mb-1">Debes vender al mes</p>
                                    <p className="text-3xl font-black text-blue-700 dark:text-blue-300 tracking-tight">$ {formatCurrency(requiredSalesForGoal)}</p>
                                </div>

                                {/* NEW TIME BASED GOALS */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-1">Meta Diaria</p>
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">$ {formatCurrency(dailyGoal)}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-1">Meta x Hora</p>
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">$ {formatCurrency(hourlyGoal)}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500">(-) Costo Mercancía ({margenBruto && (100 - parseFloat(margenBruto)).toFixed(0)}%):</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">$ {formatCurrency(requiredCOGSForGoal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500">(-) Gastos Operativos:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">$ {formatCurrency(expensesFixed)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-base pt-1">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">(=) Utilidad Neta:</span>
                                        <div className="text-right">
                                            <span className="font-black text-emerald-600 dark:text-emerald-400 block">$ {formatCurrency(goalTarget)}</span>
                                            <span className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 block">{formatPct(goalNetMarginPct)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-sm text-slate-400 py-4">Ingresa un monto para calcular la venta necesaria.</p>
                        )}
                    </div>
                </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-white dark:bg-slate-900 px-6 py-4 flex flex-wrap gap-3 shrink-0 border-t border-slate-100 dark:border-slate-800 z-20 relative">
          <button 
            onClick={handleReset}
            className="flex-1 min-w-[100px] bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Limpiar
          </button>
          
          <button 
            onClick={generatePDF}
            disabled={!canPrint}
            className={`flex-1 min-w-[140px] font-semibold py-3 px-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm ${
                canPrint 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
            title={canPrint ? "Generar reporte PDF" : "Ingresa Ventas y Margen para habilitar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            PDF Reporte
          </button>

          <button 
            onClick={onClose}
            className="flex-1 min-w-[100px] bg-slate-900 dark:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-[0.98] transition-all text-sm"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};