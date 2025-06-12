const express = require('express');
const httpProxy = require('express-http-proxy');
const { AUCTION_SERVICE_URL } = require('../config/env');

const router = express.Router();

// Middleware para loggear solicitudes
router.use((req, res, next) => {
  console.log(`📥 Incoming request: ${req.method} ${req.path} from ${req.get('origin') || 'no-origin'}`, {
    headers: {
      contentType: req.headers['content-type'],
      authorization: req.headers.authorization ? '***' : 'none',
      origin: req.headers.origin,
    },
    body: req.body,
  });
  next();
});

// Middleware CORS
router.use((req, res, next) => {
  const origin = req.get('origin');
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'https://api-gateway-subastas.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ];

  if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers');
  }

  if (req.method === 'OPTIONS') {
    console.log(`✅ AUCTION OPTIONS handled: ${req.path} from ${origin || 'no-origin'}`);
    return res.status(200).end();
  }

  next();
});

// Proxy para /auctions/*
router.use('/auctions', httpProxy(AUCTION_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    const path = `/auctions${req.url}`;
    console.log(`🔄 Proxying AUCTION: ${req.method} /api/auctions${req.url} -> ${AUCTION_SERVICE_URL}${path}`);
    return path;
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = {
      ...srcReq.headers,
      'Host': 'auction-service-production-0633.up.railway.app', // Dominio correcto
      'X-Original-Origin': srcReq.get('origin') || '',
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Forwarded-Host': srcReq.get('host'),
    };
    return proxyReqOpts;
  },
  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    if (['POST', 'PUT', 'PATCH'].includes(srcReq.method)) {
      try {
        if (srcReq.body && typeof srcReq.body === 'object') {
          console.log('📝 Request body to AUCTION service:', srcReq.body);
          return JSON.stringify(srcReq.body);
        }
      } catch (error) {
        console.error('❌ Error processing request body for AUCTION service:', error.message);
      }
    }
    return bodyContent;
  },
  filter: (req) => {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  },
  proxyErrorHandler: (err, res, next) => {
    console.error('❌ AUCTION Service Proxy Error:', {
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    if (res && !res.headersSent) {
      res.status(500).json({
        error: 'Error en el gateway de subastas',
        message: err.message,
        code: err.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  },
  changeOrigin: true,
  timeout: 15000,
  proxyTimeout: 15000,
  parseReqBody: true,
  limit: '10mb',
}));

// Proxy para /categories/*
router.use('/categories', httpProxy(AUCTION_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    const path = `/categories${req.url}`.replace(/\/$/, ''); // Eliminar barra final
    console.log(`🔄 Proxying CATEGORY: ${req.method} /api/categories${req.url} -> ${AUCTION_SERVICE_URL}${path}`);
    return path;
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = {
      ...srcReq.headers,
      'Host': 'auction-service-production-0633.up.railway.app', // Dominio correcto
      'X-Original-Origin': srcReq.get('origin') || '',
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Forwarded-Host': srcReq.get('host'),
    };
    return proxyReqOpts;
  },
  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    if (['POST', 'PUT', 'PATCH'].includes(srcReq.method)) {
      try {
        if (srcReq.body && typeof srcReq.body === 'object') {
          console.log('📝 Request body to CATEGORY service:', srcReq.body);
          return JSON.stringify(srcReq.body);
        }
      } catch (error) {
        console.error('❌ Error processing request body for CATEGORY service:', error.message);
      }
    }
    return bodyContent;
  },
  filter: (req) => {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  },
  proxyErrorHandler: (err, res, next) => {
    console.error('❌ CATEGORY Service Proxy Error:', {
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    if (res && !res.headersSent) {
      res.status(500).json({
        error: 'Error en el gateway de categorías',
        message: err.message,
        code: err.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  },
  changeOrigin: true,
  timeout: 15000,
  proxyTimeout: 15000,
  parseReqBody: true,
  limit: '10mb',
}));

// Health check para auction
router.get('/health', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`${AUCTION_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    console.log('✅ AUCTION health check success:', response.data);
    res.status(200).json({
      status: 'OK',
      service: 'auction-service-proxy',
      upstream: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ AUCTION service health check failed:', {
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    res.status(503).json({
      status: 'ERROR',
      service: 'auction-service-proxy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
