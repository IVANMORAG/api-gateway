FROM node:18-alpine

# Instalar dumb-init y curl para health checks
RUN apk add --no-cache dumb-init curl

# Crear directorio de trabajo
WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY --chown=nodejs:nodejs . .

# Cambiar a usuario no-root
USER nodejs


# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
