const morgan = require('morgan');

// ✅ Formato personalizado para Railway
const customFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' // Formato estándar para producción
  : 'dev'; // Formato colorido para desarrollo

// ✅ Crear token personalizado para IP real
morgan.token('real-ip', (req) => {
  return req.ip || req.connection.remoteAddress || '-';
});

// ✅ Formato personalizado que incluye IP real
const railwayFormat = ':real-ip - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

const logger = morgan(process.env.NODE_ENV === 'production' ? railwayFormat : customFormat, {
  // ✅ Solo loggear errores en producción para reducir noise
  skip: (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      // Solo loggear errores 4xx/5xx y requests importantes
      return res.statusCode < 400 && !req.url.includes('/api/');
    }
    return false;
  }
});

module.exports = logger;
