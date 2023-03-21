
const utils = require('./utils');
const AMOUNT = "10";

const TRANSFER = 0;
const MINT = 1;
const BURN = 2;
module.exports = function (app) {
  app.post('/get_token', async function (req, res) {
    var account = req.query.publicKey;
    var tokenId = req.query.tokenId;
    var pallet;
    if (req.query.hasOwnProperty('pallet')) {
      pallet = req.query.pallet;
    } else {
      pallet = 'assets'
    } 

    let key = tokenId + account;
    // var tokenId = [...Buffer.from(tokenIdHex.replace('0x', ''), 'hex')];
    let currentTime = (new Date()).getTime();
    let claimed = false;
    let lastClaimTime = currentTime;
    let oneDay = 24 * 60 * 60 * 1000;
    if (KeyMap.has(key)) {
      lastClaimTime = KeyMap.get(key);
      if (currentTime - lastClaimTime < oneDay) {
        claimed = true;
      }
    }
    if (claimed) {
      let nextClaimTime = lastClaimTime + oneDay;
      res.send({ code: -1, message: 'Already claimed, after ' + (new Date(nextClaimTime)).toISOString() + ' to claim.'});
      return;
    } else {
      if (pallet == 'assets') {
        var tokenInfo;
        var amount;
        if (tokenId) {
          var tokenInfo = await Api.query[pallet].tokensInfo(tokenId);
          if (!tokenInfo.toJSON()) {
            res.send({ code: -2, message: 'Token id not exist'});
            return;
          }
          var assetId = (await Api.query[pallet].tokenId2AssetId(tokenId)).toJSON();
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
        let tx = await utils.sendTransaction(Api, pallet, tokenId, PrivateKeyBuffer, PublicKey, MINT, account, amount);
        await Api.tx[pallet].sendTransaction(tokenId, tx).signAndSend(Sender);
        console.log('Faucet tokenId: ' + tokenId + ' to ' + account +' successfully!!!');
        res.send({ code: 0, message: 'Successfully' });
        KeyMap.set(key, lastClaimTime);
        return;
      } else {
        if (req.query.hasOwnProperty('itemId')) {
          let itemId = req.query.itemId;
          let collectionId = (await Api.query[pallet].tokenId2CollectionId(tokenId)).toJSON();
          let item = (await Api.query[pallet].asset(collectionId, itemId)).toJSON();
          if (item) {
            res.send({ code: -4, message: 'Item id already exists.' });
            return;
          }
          let tx = await utils.sendTransaction(Api, pallet, tokenId, PrivateKeyBuffer, PublicKey, MINT, account, itemId);
          await Api.tx[pallet].sendTransaction(tokenId, tx).signAndSend(Sender);
          console.log('Faucet tokenId: ' + tokenId + ' to ' + account +' successfully!!!');
          res.send({ code: 0, message: 'Successfully' });
          KeyMap.set(key, lastClaimTime);
          return;
        } else {
          res.send({ code: -5, message: 'Missing itemId' });
          return;
        } 
      }

    }
  });
};