export default async (req, context) => {
  try {
    const [res1, res2, res3, res4] = await Promise.all([
      fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar').catch(() => null),
      fetch('https://ve.dolarapi.com/v1/dolares/paralelo').catch(() => null),
      fetch('https://www.brecha-cambiaria.com/api/prices').catch(() => null),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').catch(() => null)
    ]);

    let rate = 0, binance = 0, btc = 0, date = '';
    
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
    if (res3?.ok) {
      const json = await res3.json();
      rate = json?.bcv_usd || rate;
      binance = json?.usdt_avg || binance;
    }
    if (res4?.ok) {
      const json = await res4.json();
      btc = parseFloat(json.price) || 0;
    }

    return new Response(JSON.stringify({
      data: {
        rate: rate || 36.52,
        binanceRate: binance || 38.25,
        bitcoinRate: btc || undefined,
        date: new Date().toLocaleDateString('es-VE'),
        lastUpdate: date || new Date().toLocaleTimeString('es-VE')
      },
      sources: [],
      rawText: "APIs públicas"
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
