const express = require('express');
const httpProxy = require('express-http-proxy');
const { AUTH_SERVICE_URL } = require('../config/env');

const router = express.Router();

// ✅ MIDDLEWARE CORS MUY ESPECÍFICO - DEBE APLICARSE ANTES DEL PROXY
router.use((req, res, next) => {
  const origin = req.get('origin');
  
  console.log(`🔍 AUTH CORS: ${req.method} ${req.path} from origin: ${origin || 'no-origin'}`);
  
  // Lista de orígenes permitidos
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'https://api-gateway-g9gb.onrender.com', // TU URL DE RENDER
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];
  
  // ✅ CRÍTICO: Configurar headers CORS SIEMPRE
  const isAllowedOrigin = !origin || 
                         allowedOrigins.includes(origin) || 
                         origin.includes('netlify.app') || 
                         origin.includes('localhost') ||
                         origin.includes('onrender.com');
  
  if (isAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers');
    res.header('Access-Control-Max-Age', '86400');
    
    console.log(`✅ AUTH CORS: Headers set for ${origin || 'no-origin'}`);
  } else {
    console.log(`❌ AUTH CORS: Origin not allowed: ${origin}`);
  }
  
  // ✅ MANEJAR OPTIONS INMEDIATAMENTE - NO HACER PROXY
  if (req.method === 'OPTIONS') {
    console.log(`✅ AUTH OPTIONS: Handled locally for ${req.path}`);
    return res.status(200).end();
  }
  
  next();
});

// ✅ PROXY MEJORADO CON CORS FIJO
router.use('/', httpProxy(AUTH_SERVICE_URL, {
  // Resolver la ruta correctamente
  proxyReqPathResolver: (req) => {
    const path = `/api/auth${req.url}`;
    console.log(`🔄 AUTH PROXY: ${req.method} ${req.url} -> ${AUTH_SERVICE_URL}${path}`);
    return path;
  },
  
  // ✅ Headers del request
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = {
      ...proxyReqOpts.headers,
      'Content-Type': 'application/json',
      'X-Original-Origin': srcReq.get('origin') || '',
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Forwarded-Host': srcReq.get('host'),
      // Preservar authorization
      ...(srcReq.headers.authorization && { 'Authorization': srcReq.headers.authorization })
    };
    
    console.log('📤 AUTH PROXY: Headers prepared');
    return proxyReqOpts;
  },
  
  // ✅ Body del request
  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    if (srcReq.method === 'POST' || srcReq.method === 'PUT') {
      try {
        const body = srcReq.body;
        console.log('📝 AUTH PROXY: Body prepared', {
          hasEmail: !!body.email,
          hasPassword: !!body.password,
          keys: Object.keys(body || {})
        });
        return JSON.stringify(body);
      } catch (error) {
        console.warn('⚠️ AUTH PROXY: Body processing error:', error.message);
        return bodyContent;
      }
    }
    return bodyContent;
  },

  // ✅ CRÍTICO: Decorar la respuesta para asegurar CORS
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    const origin = userReq.get('origin');
    
    // ✅ FORZAR headers CORS en la respuesta del proxy
    const allowedOrigins = [
      'https://subastas-mora.netlify.app',
      'https://api-gateway-g9gb.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173'
    ];
    
    const isAllowedOrigin = !origin || 
                           allowedOrigins.includes(origin) || 
                           origin.includes('netlify.app') || 
                           origin.includes('localhost') ||
                           origin.includes('onrender.com');
    
    if (isAllowedOrigin) {
      userRes.header('Access-Control-Allow-Origin', origin || '*');
      userRes.header('Access-Control-Allow-Credentials', 'true');
      userRes.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      userRes.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
      
      console.log(`✅ AUTH RESPONSE: CORS headers applied for ${origin || 'no-origin'}`);
    }
    
    try {
      const data = JSON.parse(proxyResData.toString('utf8'));
      console.log('📥 AUTH RESPONSE:', {
        status: proxyRes.statusCode,
        hasToken: !!(data.token || data.accessToken),
        hasUser: !!data.user,
        hasError: !!data.error
      });
      
      return JSON.stringify(data);
    } catch (error) {
      console.warn('⚠️ AUTH RESPONSE: Parse error, returning raw data');
      return proxyResData;
    }
  },

  // ✅ Manejo de errores con CORS
  proxyErrorHandler: (err, res, next) => {
    console.error('❌ AUTH PROXY ERROR:', {
      message: err.message,
      code: err.code
    });

    if (res && !res.headersSent) {
      // ✅ ASEGURAR CORS incluso en errores
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
      
      if (err.code === 'ECONNREFUSED') {
        res.status(503).json({
          error: 'Auth service unavailable',
          message: 'Authentication service is temporarily offline',
          code: 'SERVICE_UNAVAILABLE'
        });
      } else if (err.code === 'ETIMEDOUT') {
        res.status(504).json({
          error: 'Auth service timeout',
          message: 'Authentication service timeout',
          code: 'GATEWAY_TIMEOUT'
        });
      } else {
        res.status(500).json({
          error: 'Auth gateway error',
          message: 'Internal gateway error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  },

  // Configuración del proxy
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000,
  preserveHeaderKeyCase: true,
  parseReqBody: false, // ✅ CAMBIADO: Dejar que Express maneje el body
  limit: '10mb',
  
  // ✅ Filtrar solo requests válidos (no OPTIONS)
  filter: (req, res) => {
    console.log(`🔍 AUTH FILTER: ${req.method} ${req.path} - ${req.method !== 'OPTIONS' ? 'PROXY' : 'SKIP'}`);
    return req.method !== 'OPTIONS';
  }
}));

// ✅ Health check local (sin proxy)
router.get('/health-local', (req, res) => {
  const origin = req.get('origin');
  
  // Asegurar CORS
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(200).json({
    status: 'OK',
    service: 'auth-proxy',
    gateway: 'api-gateway',
    timestamp: new Date().toISOString(),
    upstream: AUTH_SERVICE_URL
  });
});

module.exports = router;
