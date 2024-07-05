const express = require('express');
const compression = require('compression');
const moment = require('moment');
const cookieParser = require('cookie-parser');
const eccrypto = require('eccrypto');
const fs = require('fs');
const config = require('config');
global.StateDB = require('../utils/state');
const utils = require('../utils/utils');
const polling = require('./pollService');
const Request = require('./request');

(async () => {
  var app = express();
  app.use(compression());
  app.use(cookieParser());

  // parse application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: false }));
  // parse application/json
  app.use(express.text());
  app.use(express.json());

  app.use(function (req, res, next) {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  StateDB.init(config.get('stateDB'));
  // Private key
  let ownerAccountPrivateKey = JSON.parse(
    fs.readFileSync(config.get('secret')).toString()
  );
  const secret = Buffer.from(utils.toByteArray(ownerAccountPrivateKey));
  const publicKeyBuffer = eccrypto.getPublic(secret);

  await require('./router')(app);
  // listening port
  var port = 7788;
  app.listen(port, '0.0.0.0');

  console.log(
    '%s | node server initializing | listening on port %s | process id %s',
    moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
    port,
    process.pid
  );
  const request = new Request(config.get('omniverseServer'));
  const sender = '0x' + publicKeyBuffer.toString('hex').substring(2, 66);
  polling(request, sender, secret);
})();
