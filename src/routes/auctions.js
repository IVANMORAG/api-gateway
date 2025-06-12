const express = require('express');
const httpProxy = require('express-http-proxy');
const { AUCTION_SERVICE_URL } = require('../config/env');

const router = express.Router();

// Enrutar solicitudes de /api/auctions/* a /auctions/*
router.use('/auctions', httpProxy(AUCTION_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    console.log(`Enrutando ${req.method} /api/auctions${req.url} a ${AUCTION_SERVICE_URL}/auctions${req.url}`);
    return `/auctions${req.url}`;
  },
  filter: (req) => {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method); // Agrega PATCH
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = { ...srcReq.headers };
    return proxyReqOpts;
  }
}));

// Enrutar solicitudes de /api/categories/* a /categories/*
router.use('/categories', httpProxy(AUCTION_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    console.log(`Enrutando ${req.method} /api/categories${req.url} a ${AUCTION_SERVICE_URL}/categories${req.url}`);
    return `/categories${req.url}`;
  },
  filter: (req) => {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method); // Agrega PATCH
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = { ...srcReq.headers };
    return proxyReqOpts;
  }
}));

module.exports = router;