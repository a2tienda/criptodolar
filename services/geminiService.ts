import { ExchangeData, ServiceResponse } from "../types";

// Proxy CORS que SÍ funciona
const PROXY = 'https://api.allorigins.win/raw?url=';

export const fetchDollarRate = async (skipCache: boolean = false): Promise<ServiceResponse> => {
  try {
    const [res1, res2] = await Promise.all([
      fetch(PROXY + encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar')).catch(() => null),
      fetch(PROXY + encodeURIComponent('https://ve.dolarapi.com/v1/dolares/paralelo')).catch(() => null)
    ]);

    let rate = 0, binance = 0, date = '';
    
    if (res1?.ok) {
      const json = await res1.json();
      rate = json?.monitors?.bcv?.price || 0;
      binance = json?.monitors?.binance?.price || json?.monitors?.enparalelovzla?.price || 0;
      date = json?.monitors?.bcv?.last_update || '';
    }
    if (res2?.ok) {
      const json = await res2.json();
      binance = json?.promedio || binance;
    }

    if (rate <= 0) throw new Error('APIs fallaron');

    return {
      data: {
        rate,
        binanceRate: binance,
        date: new Date().toLocaleDateString('es-VE'),
        lastUpdate: date || new Date().toLocaleTimeString('es-VE')
      },
      sources: [],
      rawText: 'APIs públicas'
    };
  } catch (error) {
    throw new Error("Error conectando con el servicio de consulta.");
  }
};
