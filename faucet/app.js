const express = require('express');
const compression = require('compression');
//操作日期的插件
const moment = require('moment');
const cookieParser = require('cookie-parser');
const eccrypto = require('eccrypto');
const fs = require('fs')
const { ApiPromise, HttpProvider, Keyring, WsProvider } = require('@polkadot/api');
const config = require('config');
global.StateDB = require('../utils/state');
// const httpProvider = new HttpProvider('http://47.254.40.186:9933');
const wsProvider = new WsProvider(config.get('nodeAddress'));
const utils = require('../utils/utils');
const { queue } = require('async');

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

  StateDB.init(config.get('stateDB'));
  
  wsProvider.on('disconnected', () => {
    StateDB.init(config.get('stateDB'));
  });

  // Private key
  let ownerAccountPrivateKey = JSON.parse(fs.readFileSync(config.get('secret')).toString());
  // let ownerAccountPrivateKey = secret.sks[secret.index];
  global.PrivateKeyBuffer = Buffer.from(utils.toByteArray(ownerAccountPrivateKey));
  let publicKeyBuffer = eccrypto.getPublic(PrivateKeyBuffer);
  global.PublicKey = '0x' + publicKeyBuffer.toString('hex').slice(2);
  global.Api = await ApiPromise.create({ provider: wsProvider, noInitWarn: true });
  const keyring = new Keyring({ type: 'ecdsa' });
  global.Sender = keyring.addFromSeed(PrivateKeyBuffer);
  global.Queue = queue(utils.substrateTxWorker, 1);

  await require('./router')(app);
  var port = 7788;
  //监听端口
  app.listen(port, '0.0.0.0');

  console.log(
    '%s | node server initializing | listening on port %s | process id %s',
    moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
    port,
    process.pid
  );
})();