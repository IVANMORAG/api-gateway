const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Máximo 100 solicitudes por IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutos en segundos
  },
  
  // ✅ Configuración para proxies (Railway, Heroku, etc.)
  trustProxy: true,
  
  // ✅ Configurar el generador de claves para manejar proxies
  keyGenerator: (req, res) => {
    // Usar la IP real del cliente, considerando proxies
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  
  // ✅ Headers de respuesta estándar
  standardHeaders: true,
  legacyHeaders: false,
  
  // ✅ Configuración de skip para health checks
  skip: (req, res) => {
    // No aplicar rate limiting a health checks
    return req.path === '/health' || req.path === '/test-cors';
  },
  
  // ✅ Handler personalizado para debugging
  handler: (req, res, next, options) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
  
  // ✅ Configuración de respuesta para OPTIONS
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

module.exports = limiter;
