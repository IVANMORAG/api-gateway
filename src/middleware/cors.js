const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite dev server
      'https://subastas-mora.netlify.app'
    ];
    
    // Permitir subdominios de Netlify y solicitudes sin origen (ej: Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
      console.log(`✅ CORS: Origin allowed: ${origin || 'no-origin'}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Origin NOT allowed: ${origin}`);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 DEV MODE: Allowing origin anyway');
        callback(null, true);
      } else {
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
    'Access-Control-Request-Headers'
  ],
  
  exposedHeaders: [
    'Content-Length', 
    'X-Request-Id',
    'Access-Control-Allow-Origin'
  ],
  
  credentials: true,
  
  optionsSuccessStatus: 200, // Para navegadores legacy
  preflightContinue: false,
  
  maxAge: 86400 // 24 horas de cache para preflight requests
};

// Crear el middleware CORS principal
const corsMiddleware = cors(corsOptions);

// Middleware de debugging mejorado
const debugCors = (req, res, next) => {
  const origin = req.get('origin');
  const method = req.method;
  const path = req.path;
  
  console.log(`🌐 CORS Debug: ${method} ${path}`, {
    origin,
    headers: req.headers,
    ip: req.ip,
    protocol: req.protocol,
    host: req.get('host')
  });
  
  if (method === 'OPTIONS') {
    console.log('🔍 OPTIONS request details:', {
      origin,
      'access-control-request-method': req.get('access-control-request-method'),
      'access-control-request-headers': req.get('access-control-request-headers'),
      'user-agent': req.get('user-agent')?.substring(0, 50)
    });
  }
  
  next();
};

// Middleware para forzar headers CORS
const forceCorsHeaders = (req, res, next) => {
  const origin = req.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://subastas-mora.netlify.app'
  ];
  
  if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers');
    res.header('Vary', 'Origin');
  }
  
  if (req.method === 'OPTIONS') {
    console.log(`🔍 OPTIONS request handled: ${req.path} from ${origin || 'no-origin'}`);
    return res.status(200).end();
  }
  
  next();
};

// Middleware para proxies
const proxyCorsFix = (req, res, next) => {
  if (req.get('origin')) {
    req.corsOrigin = req.get('origin');
  }
  next();
};

// Exportar middlewares en el orden correcto
module.exports = [
  debugCors,
  proxyCorsFix,
  forceCorsHeaders,
  corsMiddleware
];
