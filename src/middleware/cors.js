const cors = require('cors');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://subastas-mora.netlify.app', 'https://api-gateway-g9gb.onrender.com'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /.*\.netlify\.app$/.test(origin)) {
      console.log(`✅ CORS: Origin allowed: ${origin || 'no-origin'}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Origin NOT allowed: ${origin}`);
      callback(new Error(`CORS: Origin ${origin} not allowed`), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400,
};

const corsMiddleware = cors(corsOptions);

module.exports = [corsMiddleware];
