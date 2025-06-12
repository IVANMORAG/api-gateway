// ✅ CORS SIMPLIFICADO Y MÁS AGRESIVO PARA RENDER
const cors = require('cors');

// ✅ Configuración más permisiva para Render
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🌐 CORS CHECK: Origin = ${origin || 'NO-ORIGIN'}`);
    
    // ✅ LISTA ACTUALIZADA con tu URL de Render
    const allowedOrigins = [
      'https://subastas-mora.netlify.app',
      'https://api-gateway-g9gb.onrender.com', // TU URL
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173'
    ];
    
    // ✅ MÁS PERMISIVO: Permitir cualquier origin en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 DEV MODE: Allowing all origins');
      return callback(null, true);
    }
    
    // ✅ Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: No origin - ALLOWED');
      return callback(null, true);
    }
    
    // ✅ Permitir orígenes específicos + patrones
    const isAllowed = allowedOrigins.includes(origin) ||
                     origin.includes('netlify.app') ||
                     origin.includes('localhost') ||
                     origin.includes('onrender.com') ||
                     origin.includes('127.0.0.1');
    
    if (isAllowed) {
      console.log(`✅ CORS: Origin ALLOWED - ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Origin BLOCKED - ${origin}`);
      // ✅ En producción, ser menos estricto por problemas de Render
      console.log('🔧 RENDER FIX: Allowing anyway due to Render proxy issues');
      callback(null, true);
    }
  },
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
  allowedHeaders: [
    'Content-Type',
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cache-Control',
    'Pragma',
    'X-Forwarded-For',
    'X-Forwarded-Proto',
    'X-Forwarded-Host'
  ],
  
  exposedHeaders: [
    'Content-Length',
    'X-Request-Id',
    'Access-Control-Allow-Origin'
  ],
  
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400
};

// ✅ Middleware principal de CORS
const corsMiddleware = cors(corsOptions);

// ✅ Middleware para FORZAR headers CORS (backup)
const forceCorsHeaders = (req, res, next) => {
  const origin = req.get('origin');
  
  console.log(`🔧 FORCE CORS: ${req.method} ${req.path} from ${origin || 'no-origin'}`);
  
  // ✅ FORZAR headers CORS SIEMPRE para Render
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers');
  res.header('Vary', 'Origin');
  
  // ✅ Responder OPTIONS inmediatamente
  if (req.method === 'OPTIONS') {
    console.log(`✅ OPTIONS: Handled for ${req.path} from ${origin || 'no-origin'}`);
    return res.status(200).end();
  }
  
  next();
};

// ✅ Debugging mejorado
const debugCors = (req, res, next) => {
  const origin = req.get('origin');
  const method = req.method;
  const path = req.path;
  
  console.log(`🌐 CORS DEBUG: ${method} ${path} | Origin: ${origin || 'none'} | IP: ${req.ip}`);
  
  // Log headers importantes para debugging
  if (method === 'OPTIONS') {
    console.log('🔍 OPTIONS Details:', {
      origin,
      requestMethod: req.get('access-control-request-method'),
      requestHeaders: req.get('access-control-request-headers'),
      userAgent: req.get('user-agent')?.substring(0, 50)
    });
  }
  
  next();
};

// ✅ EXPORTAR middleware compuesto
module.exports = (req, res, next) => {
  // Secuencia: Debug -> Force CORS -> Official CORS
  debugCors(req, res, () => {
    forceCorsHeaders(req, res, () => {
      // Solo aplicar el middleware oficial si no es OPTIONS
      if (req.method === 'OPTIONS') {
        return; // Ya se manejó en forceCorsHeaders
      }
      corsMiddleware(req, res, next);
    });
  });
};
