require('dotenv').config();

module.exports = {
  PORT: process.env.PORT,
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
  AUCTION_SERVICE_URL: process.env.AUCTION_SERVICE_URL,
  BID_SERVICE_URL: process.env.BID_SERVICE_URL,
};