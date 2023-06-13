const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const fs = require('fs');
const { queue } = require('async');
const eccrypto = require('eccrypto');
const utils = require('../utils');
const keccak256 = require('keccak256');
const config = require('./config/default.json');

let pending = {};
(async () => {
  for (let chainName of Object.keys(config)) {
    pending[chainName] = new Set();
    let conf = config[chainName];
    let queues = queue(utils.substrateTxWorker, 1);

    let secret = JSON.parse(fs.readFileSync(__dirname + '/' + conf.secret));
    let privateKeyBuffer = Buffer.from(utils.toByteArray(secret));
    let publicKeyBuffer = eccrypto.getPublic(privateKeyBuffer);
    let publicKey = '0x' + publicKeyBuffer.toString('hex').slice(2);
    let keyring = new Keyring({ type: 'ecdsa' });
    let sender = keyring.addFromSeed(privateKeyBuffer);

    // Create our API with a default connection to the local node
    const wsProvider = new WsProvider(conf.nodeAddress);
    let api = await ApiPromise.create({
      provider: wsProvider,
      noInitWarn: true,
    });
    api.query.system.events(async (events) => {
      events.forEach(async (record) => {
        const { event } = record;
        try {
          if (event.section == 'omniverseSwap') {
            // let data = event.toJSON().data;
            if (event.method == 'PendingDeposit') {
              let pk = event.data[0].toHuman();
              let tokenId = event.data[1].toHuman();
              let nonce = event.data[2].toHuman();
              pending[chainName].add(pk + tokenId + nonce);
              console.log('Depisit:', pk, tokenId, nonce);
            }
            if (event.method == 'Withdrawals') {
              let nonce = (
                await utils.contractCall(
                  api,
                  'omniverseProtocol',
                  'transactionCount',
                  [publicKey, 'assets', tokenId]
                )
              ).toJSON();
              let txData = transferData(tokenId, pk, value.toJSON(), nonce);
              await utils.enqueueTask(
                queues,
                api,
                'omniverseSwap',
                'withdrawComfirm',
                sender,
                [pk, tokenId, txData]
              );
            }
          }
          if (event.section == 'assets') {
            if (event.method == 'TransactionExecuted') {
              let pk = event.data[0].toHuman();
              let nonce = event.data[1].toHuman();
              let tokenId = event.data[2].toHuman();
              let key = pk + tokenId + nonce;
              console.log(key);
              if (pending[chainName].has(key)) {
                await utils.enqueueTask(
                  queues,
                  api,
                  'omniverseSwap',
                  'depositComfirm',
                  sender,
                  [pk, tokenId, nonce]
                );
                pending[chainName].delete(key);
                console.log('Deposit comfirm:', pk, tokenId, nonce);
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
    // process past deposit and withdrawal records
    {
      console.log('Process past deposit and withdrawal records');
      // deposit records
      let depositRecords =
        await api.query.omniverseSwap.depositRecords.entries();
      for (let [key, _] of depositRecords) {
        let [[pk, tokenId, nonce]] = key.toHuman();
        console.log(pk);
        let omniTx = (
          await utils.contractCall(
            api,
            'omniverseProtocol',
            'transactionRecorder',
            [pk, 'assets', tokenId, nonce]
          )
        ).toJSON();
        if (omniTx.executed) {
          await utils.enqueueTask(
            queues,
            api,
            'omniverseSwap',
            'depositComfirm',
            sender,
            [pk, tokenId, nonce]
          );
        } else {
          pending[chainName].add(pk + tokenId + nonce);
        }
      }

      // withdrawal records
      let withdrawalRecords =
        await api.query.omniverseSwap.withdrawals.entries();
      for (let [key, value] of withdrawalRecords) {
        let [[pk, tokenId]] = key.toHuman();
        let nonce = (
          await utils.contractCall(
            api,
            'omniverseProtocol',
            'transactionCount',
            [publicKey, 'assets', tokenId]
          )
        ).toJSON();
        let txData = transferData(
          conf.omniverseChainId,
          privateKeyBuffer,
          publicKey,
          tokenId,
          pk,
          value.toJSON(),
          nonce
        );
        await utils.enqueueTask(
          queues,
          api,
          'omniverseSwap',
          'withdrawComfirm',
          sender,
          [pk, tokenId, txData]
        );
      }
    }
  }
})();

function transferData(
  chainId,
  privateKeyBuffer,
  publicKey,
  tokenId,
  to,
  amount,
  nonce
) {
  let payload = utils.Fungible.enc({
    op: 0,
    ex_data: Array.from(Buffer.from(to.slice(2), 'hex')),
    amount: BigInt(amount),
  });
  let txData = {
    nonce: nonce,
    chainId: chainId,
    initiatorAddress: tokenId,
    from: publicKey,
    payload: utils.toHexString(Array.from(payload)),
  };
  // console.log(Buffer.from(txData.to.replace('0x', ''), 'hex'));
  let bData = utils.getRawData(txData);
  let hash = keccak256(bData);
  txData.signature = utils.signData(hash, privateKeyBuffer);
  return txData;
}
