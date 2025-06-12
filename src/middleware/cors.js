const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite dev server
      'https://subastas-mora.netlify.app',
      'https://api-gateway-production-041c.up.railway.app',
      'https://auth-service-production-efff.up.railway.app',
      'https://auction-service-production-0633.up.railway.app',
      'https://bid-service-production.up.railway.app'
    ];
    
    // ✅ CLAVE: Permitir requests sin origin (ej: mobile apps, postman, mismo servidor)
    if (!origin) {
      console.log('🌐 CORS: Request without origin - ALLOWED');
      return callback(null, true);
    }
    
    // ✅ CORREGIDO: Verificar origen permitido
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Origin allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Origin NOT allowed: ${origin}`);
      // ✅ IMPORTANTE: No devolver false, sino un error más específico
      // Pero para desarrollo, podemos ser más permisivos
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV MODE: Allowing origin anyway');
        callback(null, true);
      } else {
        // En producción, rechazar con un error apropiado
        callback(new Error(`CORS: Origin ${origin} not allowed by CORS policy`), false);
      }
    }
  },
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cache-Control',
    'Pragma'
  ],
  
  exposedHeaders: [
    'Content-Length', 
    'X-Request-Id',
    'Access-Control-Allow-Origin'
  ],
  
  credentials: true,
  
  // ✅ IMPORTANTE: Para OPTIONS requests
  optionsSuccessStatus: 200, // Para soportar navegadores legacy
  preflightContinue: false,
  
  // ✅ CLAVE: Configurar headers manualmente si es necesario
  maxAge: 86400 // 24 horas de cache para preflight requests
};

// Crear el middleware CORS principal
const corsMiddleware = cors(corsOptions);

// ✅ Middleware adicional para forzar headers CORS si es necesario
const forceCorsHeaders = (req, res, next) => {
  const origin = req.get('origin');
  
  // Lista de orígenes permitidos (misma que arriba)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://subastas-mora.netlify.app',
    'https://api-gateway-production-041c.up.railway.app',
    'https://auth-service-production-efff.up.railway.app',
    'https://auction-service-production-0633.up.railway.app',
    'https://bid-service-production.up.railway.app'
  ];
  
  // ✅ Forzar headers CORS para orígenes permitidos
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers');
    res.header('Vary', 'Origin');
  }
  
  // ✅ Para OPTIONS requests, responder inmediatamente
  if (req.method === 'OPTIONS') {
    console.log(`🔍 OPTIONS request handled: ${req.path} from ${origin || 'no-origin'}`);
    return res.status(200).end();
  }
  
  next();
};

// Middleware de debugging mejorado
const debugCors = (req, res, next) => {
  const origin = req.get('origin');
  const method = req.method;
  const path = req.path;
  
  console.log(`🌐 CORS: ${method} ${path} from ${origin || 'no-origin'}`);
  
  // Para peticiones OPTIONS, loggear headers importantes
  if (method === 'OPTIONS') {
    console.log('🔍 OPTIONS request details:', {
      origin: origin,
      'access-control-request-method': req.get('access-control-request-method'),
      'access-control-request-headers': req.get('access-control-request-headers'),
      'user-agent': req.get('user-agent')?.substring(0, 50) + '...'
    });
  }
  
  next();
};

// ✅ Middleware específico para manejar CORS en proxies
const proxyCorsFix = (req, res, next) => {
  // Almacenar el origen para que los proxies lo puedan usar
  if (req.get('origin')) {
    req.corsOrigin = req.get('origin');
  }
  next();
};

// ✅ EXPORTAR en el orden correcto
module.exports = [
  debugCors,      // 1. Debug primero
  proxyCorsFix,   // 2. Preparar datos para proxies
  forceCorsHeaders, // 3. Forzar headers CORS
  corsMiddleware  // 4. Middleware oficial de CORS
];
