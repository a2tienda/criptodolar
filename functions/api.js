export default async (req, context) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || '';
    
    const [responseMonitors, responseBtc, responseParalelo, responseBrecha] = await Promise.all([
      fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar').catch(() => null),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').catch(() => null),
      fetch('https://ve.dolarapi.com/v1/dolares/paralelo').catch(() => null),
      fetch('https://www.brecha-cambiaria.com/api/prices').catch(() => null)
    ]);

    let apiRate = 0, apiBinance = 0, apiDate = '', btcPrice;

    if (responseMonitors && responseMonitors.ok) {
      try {
        const json = await responseMonitors.json();
        if (json.monitors?.bcv) {
          apiRate = json.monitors.bcv.price || 0;
          apiDate = json.monitors.bcv.last_update || '';
        }
        const binData = json.monitors?.binance || json.monitors?.enparalelovzla;
        if (binData) apiBinance = binData.price || 0;
      } catch (e) {}
    }

    if (responseParalelo && responseParalelo.ok) {
      try {
        const json = await responseParalelo.json();
        if (json.promedio) apiBinance = json.promedio;
      } catch (e) {}
    }

    if (responseBrecha && responseBrecha.ok) {
      try {
        const json = await responseBrecha.json();
        if (json.usdt_avg) apiBinance = json.usdt_avg;
        if (json.bcv_usd) apiRate = json.bcv_usd;
      } catch (e) {}
    }

    if (responseBtc && responseBtc.ok) {
      try {
        const json = await responseBtc.json();
        btcPrice = parseFloat(json.price);
      } catch (e) {}
    }

    let geminiRate = 0, geminiBinance = 0, goldRate = 0, sources = [], rawText = '';
    
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
        const timeStr = now.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas' });

        const prompt = `Fecha: ${dateStr}, ${timeStr} (Caracas). Actúa como monitor financiero experto en Venezuela. Usa Google Search para encontrar: 1. Tasa BCV oficial vigente, 2. Tasa USDT/Paralelo (Dolitoday o Binance P2P), 3. Precio spot Oro en USD. Prioriza fuentes de últimas 24 horas. Responde ÚNICAMENTE con este JSON: {"bcvRate": <numero>, "binanceRate": <numero>, "goldRate": <numero>}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 } },
        });

        rawText = response.text || "";
        sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        try {
          const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/) || rawText.match(/```([\s\S]*?)```/);
          const data = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(rawText.trim());
          geminiRate = data.bcvRate || 0;
          geminiBinance = data.binanceRate || 0;
          goldRate = data.goldRate || 0;
        } catch (e) {}
      } catch (e) { console.warn("Gemini error:", e); }
    }

    const finalData = {
      rate: apiRate > 0 ? apiRate : geminiRate,
      binanceRate: apiBinance > 0 ? apiBinance : geminiBinance,
      goldRate: goldRate || undefined,
      bitcoinRate: btcPrice || undefined,
      date: new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
      lastUpdate: apiDate || new Date().toLocaleTimeString('es-VE')
    };

    return new Response(JSON.stringify({ data: finalData, sources, rawText }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
