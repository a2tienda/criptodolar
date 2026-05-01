import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Proxies para evitar CORS
app.use('/api/dollar', createProxyMiddleware({
  target: 'https://pydolarvenezuela-api.vercel.app',
  changeOrigin: true,
  pathRewrite: { '^/api/dollar': '/api/v1/dollar' }
}));

app.use('/api/btc', createProxyMiddleware({
  target: 'https://api.binance.com',
  changeOrigin: true,
  pathRewrite: { '^/api/btc': '/api/v3/ticker/price?symbol=BTCUSDT' }
}));

app.use('/api/paralelo', createProxyMiddleware({
  target: 'https://ve.dolarapi.com',
  changeOrigin: true,
  pathRewrite: { '^/api/paralelo': '/v1/dolares/paralelo' }
}));

app.use('/api/brecha', createProxyMiddleware({
  target: 'https://www.brecha-cambiaria.com',
  changeOrigin: true,
  pathRewrite: { '^/api/brecha': '/api/prices' }
}));

// API endpoint local
app.get('/api/local', async (req, res) => {
  try {
    const [resMonitor, resParalelo, resBrecha, resBtc] = await Promise.all([
      fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar').catch(() => null),
      fetch('https://ve.dolarapi.com/v1/dolares/paralelo').catch(() => null),
      fetch('https://www.brecha-cambiaria.com/api/prices').catch(() => null),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').catch(() => null)
    ]);

    let rate = 0, binance = 0, btc = 0, date = '';
    
    if (resMonitor?.ok) {
      const json = await resMonitor.json();
      rate = json?.monitors?.bcv?.price || 0;
      binance = json?.monitors?.binance?.price || 0;
      date = json?.monitors?.bcv?.last_update || '';
    }
    if (resParalelo?.ok) {
      const json = await resParalelo.json();
      binance = json?.promedio || binance;
    }
    if (resBrecha?.ok) {
      const json = await resBrecha.json();
      rate = json?.bcv_usd || rate;
      binance = json?.usdt_avg || binance;
    }
    if (resBtc?.ok) {
      const json = await resBtc.json();
      btc = parseFloat(json.price) || 0;
    }

    res.json({
      data: {
        rate: rate || 36.50,
        binanceRate: binance || 38.20,
        bitcoinRate: btc || undefined,
        date: new Date().toLocaleDateString('es-VE'),
        lastUpdate: date || new Date().toLocaleTimeString('es-VE')
      },
      sources: [],
      rawText: "APIs públicas vía proxy"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware en desarrollo
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
