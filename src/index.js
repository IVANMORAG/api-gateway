const express = require('express');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const corsMiddleware = require('./middleware/cors');
const rateLimiter = require('./middleware/rateLimiter');
const logger = require('./middleware/logger');
const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const bidRoutes = require('./routes/bids');

// Cargar variables de entorno
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para Render
app.set('trust proxy', 1);

// Orden crítico de middlewares
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter);
app.use(logger);

// Manejo explícito de OPTIONS para rutas de autenticación
app.options('/api/auth/*', (req, res) => {
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
  console.log(`🔍 Handling OPTIONS for auth: ${req.url} from ${origin || 'no-origin'}`);
  res.status(200).end();
});

// Configuración WebSocket
const BID_SERVICE_URL = process.env.BID_SERVICE_URL || 'http://localhost:3003';
const WS_TARGET = process.env.NODE_ENV === 'production' 
  ? 'wss://bid-service-production.up.railway.app' 
  : 'ws://localhost:3003';

console.log('📡 BID_SERVICE_URL:', BID_SERVICE_URL);
console.log('📡 WebSocket target:', WS_TARGET);

const wsProxy = createProxyMiddleware({
  target: WS_TARGET,
  ws: true,
  changeOrigin: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('❌ WebSocket Proxy Error:', err);
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
  res.status(200).json({ 
    status: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cors: 'enabled'
  });
});

// Ruta para probar CORS
app.get('/test-cors', (req, res) => {
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

// Rutas a microservicios
app.use('/api/auth', authRoutes);
app.use('/api', auctionRoutes);
app.use('/api/bids', bidRoutes);

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
    ip: req.ip,
    userAgent: req.get('user-agent')?.substring(0, 50)
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📡 WebSocket proxy configured for BID-SERVICE at ${WS_TARGET}`);
  console.log(`🌐 CORS enabled for: https://subastas-mora.netlify.app`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
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
