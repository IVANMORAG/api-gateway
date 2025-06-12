const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Lista de orígenes permitidos - AÑADE TU URL DE RENDER
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite dev server
      'https://subastas-mora.netlify.app',
      'https://api-gateway-g9gb.onrender.com', // ✅ TU URL DE RENDER
      // URLs de Railway (si las sigues usando)
      'https://api-gateway-production-041c.up.railway.app',
      'https://auth-service-production-efff.up.railway.app',
      'https://auction-service-production-0633.up.railway.app',
      'https://bid-service-production.up.railway.app'
    ];
    
    // ✅ CLAVE: Permitir requests sin origin
    if (!origin) {
      console.log('🌐 CORS: Request without origin - ALLOWED');
      return callback(null, true);
    }
    
    // ✅ Verificar origen permitido
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Origin allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Origin NOT allowed: ${origin}`);
      
      // En desarrollo, ser más permisivo
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV MODE: Allowing origin anyway');
        callback(null, true);
      } else {
        // En producción, permitir si incluye netlify o localhost para desarrollo
        if (origin.includes('netlify.app') || origin.includes('localhost')) {
          console.log('🔧 PROD MODE: Allowing netlify/localhost origin');
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin ${origin} not allowed`), false);
        }
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
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 horas
};

// ✅ CORREGIDO: Exportar solo el middleware principal
const corsMiddleware = cors(corsOptions);

// ✅ Middleware adicional para debugging
const debugCors = (req, res, next) => {
  const origin = req.get('origin');
  const method = req.method;
  const path = req.path;
  
  console.log(`🌐 CORS Debug: ${method} ${path} from ${origin || 'no-origin'}`);
  
  if (method === 'OPTIONS') {
    console.log('🔍 OPTIONS request details:', {
      origin: origin,
      'access-control-request-method': req.get('access-control-request-method'),
      'access-control-request-headers': req.get('access-control-request-headers')
    });
  }
  
  next();
};

// ✅ Middleware para forzar CORS headers en caso de problemas
const ensureCorsHeaders = (req, res, next) => {
  const origin = req.get('origin');
  
  // Solo agregar headers si no están ya presentes
  if (origin && !res.get('Access-Control-Allow-Origin')) {
    const allowedOrigins = [
      'https://subastas-mora.netlify.app',
      'https://api-gateway-g9gb.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173'
    ];
    
    if (allowedOrigins.includes(origin) || 
        origin.includes('netlify.app') || 
        origin.includes('localhost')) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    }
  }
  
  next();
};

// ✅ EXPORTAR como función compuesta
module.exports = (req, res, next) => {
  debugCors(req, res, () => {
    corsMiddleware(req, res, () => {
      ensureCorsHeaders(req, res, next);
    });
  });
};
