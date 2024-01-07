const utils = require('../utils/utils.js');
const AMOUNT = '10';
const { Keyring } = require('@polkadot/keyring');

const MINT = 1;
module.exports = async function (app) {
  app.post('/get_token', async function (req, res) {
    var account = req.query.publicKey;
    var tokenId = req.query.tokenId;
    var pallet;
    if (req.query.hasOwnProperty('pallet')) {
      pallet = req.query.pallet;
    } else {
      pallet = 'assets';
    }

    let key = tokenId + account;
    // var tokenId = [...Buffer.from(tokenIdHex.replace('0x', ''), 'hex')];
    let currentTime = new Date().getTime();
    let claimed = false;
    let lastClaimTime = currentTime;
    let oneDay = 24 * 60 * 60 * 1000;
    if (global.StateDB.has(key)) {
      lastClaimTime = StateDB.getValue(key);
      if (currentTime - lastClaimTime < oneDay) {
        claimed = true;
      }
    }
    let address = utils.getAddress(account);
    if (claimed) {
      let nextClaimTime = lastClaimTime + oneDay;
      res.send({
        code: -1,
        message:
          'Already claimed, after ' +
          new Date(nextClaimTime).toISOString() +
          ' to claim.',
      });
      return;
    } else {
      let {
        data: { free: balance },
      } = await Api.query.system.account(address);
      let minimun = BigInt('200000000000000');
      let max = BigInt('1000000000000000');
      if (BigInt(balance) < minimun) {
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice');
        await Api.tx.balances
          .transfer(address, max - BigInt(balance))
          .signAndSend(alice);
      }
      if (pallet == 'assets') {
        var tokenInfo;
        var amount;
        if (tokenId) {
          var tokenInfo = await Api.query[pallet].tokensInfo(tokenId);
          if (!tokenInfo.toJSON()) {
            res.send({ code: -2, message: 'Token id not exist' });
            return;
          }
          var assetId = (
            await Api.query[pallet].tokenId2AssetId(tokenId)
          ).toJSON();
          let metadata = (await Api.query[pallet].metadata(assetId)).toJSON();
          amount = AMOUNT + '0'.repeat(metadata.decimals);
          // var remain = await Api.query[pallet].tokens(tokenId, PublicKey);
          // if (BigInt(remain) < BigInt(amount)) {
          //   res.send({ code: -3, message: 'Token not enough'});
          //   return;
          // }
        } else {
          res.send({ code: -4, message: 'Missing tokenId' });
          return;
        }
        let tx = await utils.sendTransaction(
          Api,
          pallet,
          tokenId,
          PrivateKeyBuffer,
          PublicKey,
          MINT,
          account,
          amount
        );
        let result = await utils.enqueueTask(
          Queue,
          Api,
          pallet,
          'sendTransaction',
          Sender,
          [tokenId, tx]
        );
        if (result) {
          await Api.tx[pallet].sendTransaction(tokenId, tx).signAndSend(Sender);
          console.log(
            'Faucet tokenId: ' + tokenId + ' to ' + account + ' successfully!!!\nSustrate:' + address
          );
          StateDB.setValue(key, lastClaimTime);
          res.send({ code: 0, message: 'Successfully' });
          return;
        } else {
          res.send({ code: -5, message: 'Please try again later!' });
        }
      } else {
        if (req.query.hasOwnProperty('itemId')) {
          let itemId = req.query.itemId;
          let collectionId = (
            await Api.query[pallet].tokenId2CollectionId(tokenId)
          ).toJSON();
          let item = (
            await Api.query[pallet].asset(collectionId, itemId)
          ).toJSON();
          if (item) {
            res.send({ code: -4, message: 'Item id already exists.' });
            return;
          }
          let tx = await utils.sendTransaction(
            Api,
            pallet,
            tokenId,
            PrivateKeyBuffer,
            PublicKey,
            MINT,
            account,
            itemId
          );
          await Api.tx[pallet].sendTransaction(tokenId, tx).signAndSend(Sender);
          console.log(
            'Faucet tokenId: ' + tokenId + ' to ' + account + ' successfully!!!'
          );
          res.send({ code: 0, message: 'Successfully' });
          StateDB.set(key, lastClaimTime);
          return;
        } else {
          res.send({ code: -5, message: 'Missing itemId' });
          return;
        }
      }
    }
  });
};
