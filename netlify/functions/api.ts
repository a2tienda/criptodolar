import { GoogleGenAI } from "@google/genai";

interface ExchangeData {
  rate: number;
  binanceRate?: number;
  binanceVariation?: number;
  binanceTrend?: 'up' | 'down' | 'stable';
  goldRate?: number;
  bitcoinRate?: number;
  date: string;
  lastUpdate: string;
}

interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface ServiceResponse {
  data: ExchangeData | null;
  sources: GroundingChunk[];
  rawText?: string;
}

const CACHE = new Map<string, { timestamp: number; payload: ServiceResponse }>();
const CACHE_DURATION = 10 * 60 * 1000;

const fetchBaseRatesFromApi = async (): Promise<Partial<ExchangeData>> => {
  try {
    const [responseMonitors, responseBtc, responseParalelo, responseBrecha] = await Promise.all([
      fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar').catch(() => null),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').catch(() => null),
      fetch('https://ve.dolarapi.com/v1/dolares/paralelo').catch(() => null),
      fetch('https://www.brecha-cambiaria.com/api/prices').catch(() => null)
    ]);

    let apiRate = 0, apiBinance = 0, apiVariation = 0, apiTrend: 'up' | 'down' | 'stable' = 'stable', apiDate = '';

    if (responseMonitors && responseMonitors.ok) {
      try {
        const json = await responseMonitors.json();
        const monitors = json.monitors;
        if (monitors) {
          if (monitors.bcv) {
            apiRate = monitors.bcv.price || 0;
            apiDate = monitors.bcv.last_update || '';
          }
          const binanceData = monitors.binance || monitors.enparalelovzla;
          if (binanceData) {
            apiBinance = binanceData.price || 0;
            apiVariation = binanceData.percent || 0;
            const change = binanceData.change || 0;
            apiTrend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
          }
        }
      } catch (e) { console.warn("Error parsing monitors API", e); }
    }

    if (responseParalelo && responseParalelo.ok) {
      try {
        const json = await responseParalelo.json();
        if (json.promedio && typeof json.promedio === 'number') apiBinance = json.promedio;
      } catch (e) { console.warn("Error parsing Paralelo API", e); }
    }

    let binanceVariation = 0, binanceTrend: 'up' | 'down' | 'stable' = 'stable';
    if (responseBrecha && responseBrecha.ok) {
      try {
        const json = await responseBrecha.json();
        if (json.usdt_avg && typeof json.usdt_avg === 'number') apiBinance = json.usdt_avg;
        if (json.bcv_usd && typeof json.bcv_usd === 'number') apiRate = json.bcv_usd;
        if (json.usdt_variation !== undefined) {
          binanceVariation = json.usdt_variation;
          binanceTrend = binanceVariation > 0 ? 'up' : (binanceVariation < 0 ? 'down' : 'stable');
        }
      } catch (e) { console.warn("Error parsing Brecha API", e); }
    }

    let btcPrice: number | undefined;
    if (responseBtc && responseBtc.ok) {
      try {
        const btcJson = await responseBtc.json();
        btcPrice = parseFloat(btcJson.price);
      } catch (e) { console.warn("Error parsing BTC API", e); }
    }

    return {
      rate: apiRate, binanceRate: apiBinance, binanceVariation, binanceTrend,
      bitcoinRate: btcPrice,
      date: new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
      lastUpdate: apiDate || new Date().toLocaleTimeString('es-VE')
    };
  } catch (error) {
    console.warn("API fetch failed:", error);
    return {};
  }
};

const fetchGroundedRates = async (apiKey: string): Promise<ServiceResponse | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
    const timeStr = now.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas' });

    const prompt = `
    Fecha: ${dateStr}, ${timeStr} (Caracas).
    
    Actúa como un monitor financiero experto en Venezuela. Usa Google Search para encontrar:
    1. **Tasa BCV:** Tasa oficial del Dólar BCV vigente.
    2. **Tasa USDT / Paralelo:** Precio actual en "Dolitoday" o "Binance P2P" (Venta/Ask).
    3. **Oro:** Precio spot internacional de la Onza de Oro en USD.

    Prioriza fuentes actualizadas en las últimas 24 horas.
    
    Responde ÚNICAMENTE con este JSON:
    \`\`\`json
    {
        "bcvRate": <numero_tasa_bcv>,
        "binanceRate": <numero_tasa_usdt_o_dolitoday>,
        "goldRate": <numero_precio_oro>
    }
    \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = response.text || "";
    const chunks = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    let data: any = null;
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try { data = JSON.parse(jsonMatch[1]); } catch (e) {}
    } else {
      try { if (text.trim().startsWith('{')) data = JSON.parse(text.trim()); } catch (e) {}
    }

    return { data, sources: chunks, rawText: text };
  } catch (error) {
    console.warn("Gemini fetch failed:", error);
    return null;
  }
};

export default async (req: Request, context: any) => {
  const url = new URL(req.url);
  const skipCache = url.searchParams.get('refresh') === 'true';

  if (!skipCache) {
    const cached = CACHE.get('rates');
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' }
      });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  const apiResult = await fetchBaseRatesFromApi();
  let geminiResult: ServiceResponse | null = null;

  if (apiKey && apiKey.trim()) {
    geminiResult = await fetchGroundedRates(apiKey);
  }

  if (!apiResult.rate && !geminiResult) {
    return new Response(JSON.stringify({ error: "No se pudieron obtener datos" }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const geminiPayload: any = geminiResult?.data || {};
  const finalData: ExchangeData = {
    rate: (apiResult.rate && apiResult.rate > 0) ? apiResult.rate : (geminiPayload.bcvRate || 0),
    binanceRate: (apiResult.binanceRate && apiResult.binanceRate > 0) ? apiResult.binanceRate : (geminiPayload.binanceRate || 0),
    binanceVariation: apiResult.binanceVariation || 0,
    binanceTrend: apiResult.binanceTrend || 'stable',
    goldRate: geminiPayload.goldRate || undefined,
    bitcoinRate: apiResult.bitcoinRate || undefined,
    date: apiResult.date || new Date().toLocaleDateString('es-VE'),
    lastUpdate: apiResult.lastUpdate || new Date().toLocaleTimeString('es-VE')
  };

  const finalResponse: ServiceResponse = {
    data: finalData,
    sources: geminiResult?.sources || [],
    rawText: geminiResult?.rawText || "Datos API combinados."
  };

  if (finalData.rate > 0) {
    CACHE.set('rates', { timestamp: Date.now(), payload: finalResponse });
  }

  return new Response(JSON.stringify(finalResponse), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' }
  });
};
