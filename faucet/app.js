const express = require('express');
const compression = require('compression');
//操作日期的插件
const moment = require('moment');
const cookieParser = require('cookie-parser');
const eccrypto = require('eccrypto');
const fs = require('fs');
const { ApiPromise, HttpProvider, Keyring } = require('@polkadot/api');
const httpProvider = new HttpProvider('http://127.0.0.1:9911');
const utils = require('../utils');

(async () => {
  var app = express();
  app.use(compression());
  app.use(cookieParser());

  // 自动将body请求数据格式转成json
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
  // require('./mpc');

  global.KeyMap = new Map();
  // Private key
  let secret = JSON.parse(fs.readFileSync('./.secret').toString());
  let ownerAccountPrivateKey = secret.sks[secret.index];
  global.PrivateKeyBuffer = Buffer.from(
    utils.toByteArray(ownerAccountPrivateKey)
  );
  let publicKeyBuffer = eccrypto.getPublic(PrivateKeyBuffer);
  global.PublicKey = '0x' + publicKeyBuffer.toString('hex').slice(2);
  global.Api = await ApiPromise.create({
    provider: httpProvider,
    noInitWarn: true,
  });
  const keyring = new Keyring({ type: 'ecdsa' });
  global.Sender = keyring.addFromSeed(PrivateKeyBuffer);

  require('./router')(app);
  var port = 7799;
  //监听端口
  app.listen(port);

  console.log(
    '%s | node server initializing | listening on port %s | process id %s',
    moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
    port,
    process.pid
  );
})();
