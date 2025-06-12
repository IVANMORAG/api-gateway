const express = require('express');
const httpProxy = require('express-http-proxy');
const { AUTH_SERVICE_URL } = require('../config/env');

const router = express.Router();

// ✅ MIDDLEWARE CORS específico para auth ANTES del proxy
router.use((req, res, next) => {
  const origin = req.get('origin');
  
  // Lista de orígenes permitidos
  const allowedOrigins = [
    'https://subastas-mora.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
  ];
  
  // Configurar headers CORS específicos para auth
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers');
  }
  
  // ✅ IMPORTANTE: Manejar OPTIONS aquí ANTES del proxy
  if (req.method === 'OPTIONS') {
    console.log(`✅ AUTH OPTIONS handled: ${req.path} from ${origin || 'no-origin'}`);
    return res.status(200).end();
  }
  
  next();
});

// ✅ PROXY configurado correctamente
router.use('/', httpProxy(AUTH_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    // Como el gateway ya maneja /api/auth, pasamos la ruta completa
    const path = `/api/auth${req.url}`;
    console.log(`🔄 Proxying AUTH: ${req.method} ${req.url} -> ${AUTH_SERVICE_URL}${path}`);
    return path;
  },
  
  // ✅ Configurar headers correctamente
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    // Pasar todos los headers originales
    proxyReqOpts.headers = {
      ...srcReq.headers,
      // Preservar el origen para que el servicio auth pueda configurar CORS
      'X-Original-Origin': srcReq.get('origin') || '',
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Forwarded-Host': srcReq.get('host')
    };
    
    console.log('📤 Headers sent to AUTH service:', {
      authorization: srcReq.headers.authorization ? '***' : 'none',
      contentType: srcReq.headers['content-type'],
      origin: srcReq.headers.origin,
      userAgent: srcReq.headers['user-agent']?.substring(0, 50) + '...'
    });
    
    return proxyReqOpts;
  },
  
  // ✅ Decorar el body de la request
  proxyReqBodyDecorator: (bodyContent, srcReq) => {
  if (srcReq.method === 'POST' || srcReq.method === 'PUT') {
    try {
      const body = srcReq.body; // Usar req.body directamente
      console.log('📝 Request body to AUTH service:', {
        ...body,
        password: body.password ? '***' : undefined
      });
      return JSON.stringify(body); // Convertir a JSON para el proxy
    } catch (error) {
      console.warn('⚠️ Could not process request body for AUTH service:', error.message);
      return bodyContent; // Devolver el contenido original en caso de error
    }
  }
  return bodyContent;
},

  // ✅ Decorar la respuesta del auth service
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    try {
      // ✅ IMPORTANTE: Agregar headers CORS a la respuesta del proxy
      const origin = userReq.get('origin');
      const allowedOrigins = [
        'https://subastas-mora.netlify.app',
        'http://localhost:3000',
        'http://localhost:3001',  
        'http://localhost:5173'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        userRes.header('Access-Control-Allow-Origin', origin || '*');
        userRes.header('Access-Control-Allow-Credentials', 'true');
      }
      
      const data = JSON.parse(proxyResData.toString('utf8'));
      console.log('📥 Response from AUTH service:', {
        status: proxyRes.statusCode,
        hasToken: !!(data.token || data.accessToken),
        hasUser: !!data.user,
        hasError: !!data.error
      });
      
      return JSON.stringify(data);
    } catch (error) {
      console.warn('⚠️ Could not parse response from AUTH service');
      
      // ✅ Aún así agregar headers CORS
      const origin = userReq.get('origin');
      const allowedOrigins = ['https://subastas-mora.netlify.app', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
      
      if (!origin || allowedOrigins.includes(origin)) {
        userRes.header('Access-Control-Allow-Origin', origin || '*');
        userRes.header('Access-Control-Allow-Credentials', 'true');
      }
      
      return proxyResData;
    }
  },

  // ✅ Manejar errores de proxy
  proxyErrorHandler: (err, res, next) => {
    console.error('❌ Auth Service Proxy Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack?.split('\n')[0]
    });

    if (res && !res.headersSent) {
      // ✅ Agregar headers CORS incluso en errores
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      // Diferentes tipos de error
      if (err.code === 'ECONNREFUSED') {
        res.status(503).json({
          error: 'Servicio de autenticación no disponible',
          message: 'El servicio de autenticación está temporalmente fuera de línea',
          code: 'SERVICE_UNAVAILABLE'
        });
      } else if (err.code === 'ETIMEDOUT') {
        res.status(504).json({
          error: 'Timeout del servicio de autenticación',
          message: 'El servicio de autenticación tardó demasiado en responder',
          code: 'GATEWAY_TIMEOUT'
        });
      } else {
        res.status(500).json({
          error: 'Error en el gateway de autenticación',
          message: 'Error interno del gateway',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  },

  // ✅ Configuración mejorada
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000,
  preserveHeaderKeyCase: true,
  parseReqBody: true,
  limit: '10mb',
  
  // ✅ Solo proxy requests válidos (no OPTIONS)
  filter: (req, res) => {
    // No hacer proxy de OPTIONS, ya se maneja arriba
    return req.method !== 'OPTIONS';
  }
}));

// ✅ Health check específico para auth
router.get('/health', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/health`, {
      timeout: 5000
    });
    
    res.status(200).json({
      status: 'OK',
      service: 'auth-service-proxy',
      upstream: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ AUTH service health check failed:', error.message);
    res.status(503).json({
      status: 'ERROR',
      service: 'auth-service-proxy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
