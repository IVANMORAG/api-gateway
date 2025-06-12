const express = require('express');
const httpProxy = require('express-http-proxy');
const { BID_SERVICE_URL } = require('../config/env');

const router = express.Router();

// ✅ CORREGIDO: Mejor configuración del proxy
router.use('/', httpProxy(BID_SERVICE_URL, {
  // Resolver la ruta correctamente
  proxyReqPathResolver: (req) => {
    // Cambiar de /api/bids a /bids para el microservicio
    const path = `/bids${req.url}`;
    console.log(`🔄 Proxying BID request to: ${BID_SERVICE_URL}${path}`);
    return path;
  },

  // Decorar opciones de la petición
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    // Pasar todos los headers importantes
    proxyReqOpts.headers = {
      ...srcReq.headers,
      'X-Forwarded-For': srcReq.ip,
      'X-Forwarded-Proto': srcReq.protocol,
      'X-Original-Host': srcReq.get('host')
    };
    
    console.log('📤 Headers passed to BID service:', {
      authorization: srcReq.headers.authorization ? '***' : 'none',
      contentType: srcReq.headers['content-type'],
      userAgent: srcReq.headers['user-agent']
    });
    
    return proxyReqOpts;
  },

  // Decorar la petición body
  proxyReqBodyDecorator: (bodyContent, srcReq) => {
    try {
      if (srcReq.method === 'POST' || srcReq.method === 'PUT') {
        const body = JSON.parse(bodyContent.toString());
        console.log('📝 Request body to BID service:', body);
        return JSON.stringify(body);
      }
    } catch (error) {
      console.warn('⚠️ Could not parse request body:', error.message);
    }
    return bodyContent;
  },

  // Decorar la respuesta
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    try {
      const data = JSON.parse(proxyResData.toString('utf8'));
      console.log('📥 Response from BID service:', {
        status: proxyRes.statusCode,
        dataKeys: Object.keys(data || {}),
        hasError: !!data.error
      });
      return JSON.stringify(data);
    } catch (error) {
      console.warn('⚠️ Could not parse response from BID service');
      return proxyResData;
    }
  },

  // Manejo de errores mejorado
  proxyErrorHandler: (err, res, next) => {
    console.error('❌ BID Service Proxy Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack?.split('\n')[0]
    });

    if (res && !res.headersSent) {
      // Diferentes tipos de error
      if (err.code === 'ECONNREFUSED') {
        res.status(503).json({
          error: 'Servicio de pujas no disponible',
          message: 'El servicio de pujas está temporalmente fuera de línea',
          code: 'SERVICE_UNAVAILABLE'
        });
      } else if (err.code === 'ETIMEDOUT') {
        res.status(504).json({
          error: 'Timeout del servicio de pujas',
          message: 'El servicio de pujas tardó demasiado en responder',
          code: 'GATEWAY_TIMEOUT'
        });
      } else {
        res.status(500).json({
          error: 'Error en el gateway de pujas',
          message: 'Error interno del gateway',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  },

  // Configuración de timeouts
  timeout: 30000, // 30 segundos
  proxyTimeout: 30000,

  // Cambiar origen para evitar problemas de CORS
  changeOrigin: true,

  // Preservar el host original
  preserveHeaderKeyCase: true,

  // Log de requests
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',

  // Configuración de parsing
  parseReqBody: true,
  
  // Límite de tamaño del body
  limit: '10mb'
}));

// ✅ AGREGAR: Middleware de health check específico para bids
router.get('/health', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`${BID_SERVICE_URL}/health`, {
      timeout: 5000
    });
    
    res.status(200).json({
      status: 'OK',
      service: 'bid-service-proxy',
      upstream: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ BID service health check failed:', error.message);
    res.status(503).json({
      status: 'ERROR',
      service: 'bid-service-proxy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;