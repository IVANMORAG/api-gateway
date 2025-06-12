const express = require('express');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Cargar variables de entorno PRIMERO
require('dotenv').config();

console.log('🔧 Iniciando API Gateway...');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 PORT:', process.env.PORT);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para Render
app.set('trust proxy', 1);

// Middleware básico
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware simple
app.use((req, res, next) => {
  const origin = req.get('origin');
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];

  if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  }
  next();
});

// Logger middleware simple
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Manejo explícito de OPTIONS
app.options('*', (req, res) => {
  const origin = req.get('origin');
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];

  if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    res.header('Access-Control-Max-Age', '86400');
  }
  console.log(`🔍 Handling OPTIONS: ${req.url} from ${origin || 'no-origin'}`);
  res.status(200).end();
});

// Configuración WebSocket
const BID_SERVICE_URL = process.env.BID_SERVICE_URL || 'http://localhost:3003';
const WS_TARGET = process.env.NODE_ENV === 'production' 
  ? 'wss://bid-service-production.up.railway.app' 
  : 'ws://localhost:3003';

console.log('📡 BID_SERVICE_URL:', BID_SERVICE_URL);
console.log('📡 WebSocket target:', WS_TARGET);

// Crear proxy WebSocket
const wsProxy = createProxyMiddleware({
  target: WS_TARGET,
  ws: true,
  changeOrigin: true,
  logLevel: 'info',
  onError: (err, req, res) => {
    console.error('❌ WebSocket Proxy Error:', err.message);
    if (res && res.writeHead) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'WebSocket proxy error' }));
    }
  },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    console.log('🔄 WebSocket proxy request:', req.url);
  }
});

// Rutas de salud
app.get('/health', (req, res) => {
  console.log('💚 Health check requested');
  res.status(200).json({ 
    status: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cors: 'enabled',
    port: PORT
  });
});

// Ruta para probar CORS
app.get('/test-cors', (req, res) => {
  console.log('🧪 CORS test requested');
  res.status(200).json({ 
    status: 'CORS OK',
    origin: req.get('origin'),
    method: req.method,
    headers: {
      'access-control-allow-origin': res.get('access-control-allow-origin'),
      'access-control-allow-credentials': res.get('access-control-allow-credentials')
    },
    timestamp: new Date().toISOString()
  });
});

// Proxy para microservicios (rutas básicas)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const AUCTION_SERVICE_URL = process.env.AUCTION_SERVICE_URL || 'http://localhost:3002';

// Proxy para auth service
const authProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/api/auth'
  },
  onError: (err, req, res) => {
    console.error('❌ Auth Proxy Error:', err.message);
    res.status(500).json({ error: 'Auth service unavailable' });
  }
});

// Proxy para auction service
const auctionProxy = createProxyMiddleware({
  target: AUCTION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auctions': '/api/auctions'
  },
  onError: (err, req, res) => {
    console.error('❌ Auction Proxy Error:', err.message);
    res.status(500).json({ error: 'Auction service unavailable' });
  }
});

// Proxy para bid service
const bidProxy = createProxyMiddleware({
  target: BID_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/bids': '/api/bids'
  },
  onError: (err, req, res) => {
    console.error('❌ Bid Proxy Error:', err.message);
    res.status(500).json({ error: 'Bid service unavailable' });
  }
});

// Aplicar proxies
app.use('/api/auth', authProxy);
app.use('/api/auctions', auctionProxy);
app.use('/api/bids', bidProxy);

// Aplicar WebSocket proxy
app.use('/socket.io', wsProxy);
server.on('upgrade', wsProxy.upgrade);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error en API Gateway:', {
    message: err.message,
    stack: err.stack?.split('\n')[0],
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  const origin = req.get('origin');
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];

  if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'Something went wrong!',
    timestamp: new Date().toISOString(),
    ...(isDev && { stack: err.stack })
  });
});

// 404 Handler
app.use('*', (req, res) => {
  console.log(`📍 404 - Ruta no encontrada: ${req.method} ${req.originalUrl} from ${req.ip}`);
  
  const origin = req.get('origin');
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];
  
  if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Error al iniciar servidor:', err);
    process.exit(1);
  }
  
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📡 WebSocket proxy configured for BID-SERVICE at ${WS_TARGET}`);
  console.log(`🌐 CORS enabled for: https://subastas-mora.netlify.app`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`🏥 Health check available at: /health`);
  console.log(`📍 Auth service: ${AUTH_SERVICE_URL}`);
  console.log(`📍 Auction service: ${AUCTION_SERVICE_URL}`);
  console.log(`📍 Bid service: ${BID_SERVICE_URL}`);
});

// Manejo de señales
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
