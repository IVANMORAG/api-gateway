const express = require('express');
const httpProxy = require('express-http-proxy');
const { AUCTION_SERVICE_URL } = require('../config/env');

const router = express.Router();

// Middleware para loggear todas las solicitudes entrantes
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
    'https://auth-service-production-efff.up.railway.app',
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
      ...proxyReqOpts.headers,
      ...srcReq.headers,
      'Host': 'auction-service-production.up.railway.app', // Ajustar al dominio correcto del servicio
      'X-Original-Origin': srcReq.get('origin') || '',
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Forwarded-Host': srcReq.get('host'),
    };

    console.log('📤 Headers sent to AUCTION service:', {
      host: proxyReqOpts.headers['host'],
      authorization: srcReq.headers.authorization ? '***' : 'none',
      contentType: srcReq.headers['content-type'],
      origin: srcReq.headers.origin,
      userAgent: srcReq.headers['user-agent']?.substring(0, 50),
    });

    return proxyReqOpts;
  },

  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    if (['POST', 'PUT', 'PATCH'].includes(srcReq.method)) {
      try {
        if (srcReq.body && typeof srcReq.body === 'object') {
          console.log('📝 Request body to AUCTION service:', srcReq.body);
          return JSON.stringify(srcReq.body);
        } else {
          console.warn('⚠️ No valid request body for AUCTION service:', srcReq.body);
          return bodyContent;
        }
      } catch (error) {
        console.error('❌ Error processing request body for AUCTION service:', error.message);
        return bodyContent;
      }
    }
    return bodyContent;
  },

  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    const startTime = Date.now();
    const origin = userReq.get('origin');
    const allowedOrigins = [
      'https://subastas-mora.netlify.app',
      'https://api-gateway-subastas.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ];

    if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
      userRes.header('Access-Control-Allow-Origin', origin || '*');
      userRes.header('Access-Control-Allow-Credentials', 'true');
      userRes.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      userRes.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    }

    try {
      const data = JSON.parse(proxyResData.toString('utf8'));
      console.log('📥 Response from AUCTION service:', {
        status: proxyRes.statusCode,
        dataKeys: Object.keys(data || {}),
        hasError: !!data.error,
        responseTime: `${Date.now() - startTime}ms`,
      });
      return JSON.stringify(data);
    } catch (error) {
      console.error('❌ Could not parse response from AUCTION service:', error.message);
      return proxyResData;
    }
  },

  proxyErrorHandler: (err, res, next) => {
    console.error('❌ AUCTION Service Proxy Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack?.split('\n')[0],
      timestamp: new Date().toISOString(),
    });

    if (res && !res.headersSent) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Credentials', 'true');

      if (err.code === 'ECONNREFUSED') {
        res.status(503).json({
          error: 'Servicio de subastas no disponible',
          message: 'El servicio de subastas está temporalmente fuera de línea',
          code: 'SERVICE_UNAVAILABLE',
          timestamp: new Date().toISOString(),
        });
      } else if (err.code === 'ETIMEDOUT') {
        res.status(504).json({
          error: 'Timeout del servicio de subastas',
          message: 'El servicio de subastas tardó demasiado en responder',
          code: 'GATEWAY_TIMEOUT',
          timestamp: new Date().toISOString(),
        });
      } else if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        res.status(502).json({
          error: 'Error de validación de certificado',
          message: 'No se pudo validar el certificado del servicio de subastas',
          code: 'TLS_CERT_ERROR',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'Error en el gateway de subastas',
          message: 'Error interno del gateway',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.warn('⚠️ Headers already sent, cannot send error response');
    }
  },

  changeOrigin: true,
  timeout: 15000, // 15 segundos
  proxyTimeout: 15000, // 15 segundos
  preserveHeaderKeyCase: true,
  parseReqBody: true,
  limit: '10mb',

  filter: (req, res) => {
    console.log(`🔎 Proxy filter: ${req.method} ${req.path}`);
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  },
}));

// Proxy para /categories/*
router.use('/categories', httpProxy(AUCTION_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    const path = `/categories${req.url}`;
    console.log(`🔄 Proxying CATEGORY: ${req.method} /api/categories${req.url} -> ${AUCTION_SERVICE_URL}${path}`);
    return path;
  },

  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = {
      ...proxyReqOpts.headers,
      ...srcReq.headers,
      'Host': 'auction-service-production.up.railway.app', // Ajustar al dominio correcto del servicio
      'X-Original-Origin': srcReq.get('origin') || '',
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Forwarded-Host': srcReq.get('host'),
    };

    console.log('📤 Headers sent to CATEGORY service:', {
      host: proxyReqOpts.headers['host'],
      authorization: srcReq.headers.authorization ? '***' : 'none',
      contentType: srcReq.headers['content-type'],
      origin: srcReq.headers.origin,
      userAgent: srcReq.headers['user-agent']?.substring(0, 50),
    });

    return proxyReqOpts;
  },

  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    if (['POST', 'PUT', 'PATCH'].includes(srcReq.method)) {
      try {
        if (srcReq.body && typeof srcReq.body === 'object') {
          console.log('📝 Request body to CATEGORY service:', srcReq.body);
          return JSON.stringify(srcReq.body);
        } else {
          console.warn('⚠️ No valid request body for CATEGORY service:', srcReq.body);
          return bodyContent;
        }
      } catch (error) {
        console.error('❌ Error processing request body for CATEGORY service:', error.message);
        return bodyContent;
      }
    }
    return bodyContent;
  },

  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    const startTime = Date.now();
    const origin = userReq.get('origin');
    const allowedOrigins = [
      'https://subastas-mora.netlify.app',
      'https://api-gateway-subastas.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ];

    if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
      userRes.header('Access-Control-Allow-Origin', origin || '*');
      userRes.header('Access-Control-Allow-Credentials', 'true');
      userRes.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      userRes.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    }

    try {
      const data = JSON.parse(proxyResData.toString('utf8'));
      console.log('📥 Response from CATEGORY service:', {
        status: proxyRes.statusCode,
        dataKeys: Object.keys(data || {}),
        hasError: !!data.error,
        responseTime: `${Date.now() - startTime}ms`,
      });
      return JSON.stringify(data);
    } catch (error) {
      console.error('❌ Could not parse response from CATEGORY service:', error.message);
      return proxyResData;
    }
  },

  proxyErrorHandler: (err, res, next) => {
    console.error('❌ CATEGORY Service Proxy Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack?.split('\n')[0],
      timestamp: new Date().toISOString(),
    });

    if (res && !res.headersSent) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Credentials', 'true');

      if (err.code === 'ECONNREFUSED') {
        res.status(503).json({
          error: 'Servicio de categorías no disponible',
          message: 'El servicio de categorías está temporalmente fuera de línea',
          code: 'SERVICE_UNAVAILABLE',
          timestamp: new Date().toISOString(),
        });
      } else if (err.code === 'ETIMEDOUT') {
        res.status(504).json({
          error: 'Timeout del servicio de categorías',
          message: 'El servicio de categorías tardó demasiado en responder',
          code: 'GATEWAY_TIMEOUT',
          timestamp: new Date().toISOString(),
        });
      } else if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        res.status(502).json({
          error: 'Error de validación de certificado',
          message: 'No se pudo validar el certificado del servicio de categorías',
          code: 'TLS_CERT_ERROR',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'Error en el gateway de categorías',
          message: 'Error interno del gateway',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.warn('⚠️ Headers already sent, cannot send error response');
    }
  },

  changeOrigin: true,
  timeout: 15000, // 15 segundos
  proxyTimeout: 15000, // 15 segundos
  preserveHeaderKeyCase: true,
  parseReqBody: true,
  limit: '10mb',

  filter: (req, res) => {
    console.log(`🔎 Proxy filter: ${req.method} ${req.path}`);
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  },
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
