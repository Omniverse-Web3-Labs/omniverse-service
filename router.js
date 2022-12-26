
const AMOUNT = 10_000_000_000_000;
module.exports = function (app) {
  app.post('/get_token', async function (req, res) {
    var account = req.query.publicKey;
    var tokenIdHex = req.query.tokenId;
    var tokenInfo;
    if (tokenIdHex) {
      var tokenInfo = await Api.query.omniverseFactory.tokensInfo(tokenIdHex);
      if (!tokenInfo.toJSON()) {
        res.send({ code: -2, message: 'Token id not exist'});
        return;
      }
      var remain = await Api.query.omniverseFactory.tokens(tokenIdHex, account);
      if (remain < AMOUNT) {
        res.send({ code: -3, message: 'Token not enough'});
      }
    } else {
      res.send({ code: -4, message: 'Missing tokenId' });
      return;
    }
    let key = tokenIdHex + account;
    var tokenId = [...Buffer.from(tokenIdHex.replace('0x', ''), 'hex')];
    let currentTime = (new Date()).getTime();
    let claimed = false;
    let lastClaimTime = currentTime;
    let oneHour = 60 * 60 * 1000;
    if (KeyMap.has(key)) {
      lastClaimTime = KeyMap.get(key);
      if (currentTime - lastClaimTime < oneHour) {
        claimed = true;
      }
    } else {
      KeyMap.set(key, lastClaimTime);
    }
    if (claimed) {
      let nextClaimTime = lastClaimTime + oneHour;
      res.send({ code: -1, message: 'Already claimed, after ' + (new Date(nextClaimTime)).toISOString() + ' to claim.'});
    } else {
      let tx = await Transfer(tokenId, account, AMOUNT);
      await Api.tx.omniverseFactory.sendTransaction(tokenId, tx).signAndSend(Sender);
      console.log('Transfer tokenId: ' + tokenIdHex + ' to ' + account +' successfully!!!');
      res.send({ code: 0, message: 'Successfully' });
    }
  });
};


async function mint(to, amount) {
  let nonce = await Api.query.omniverseProtocol.transactionCount(publicKey);
  let mintData = MintTokenOp.enc({
      to: new Uint8Array(Buffer.from(to.slice(2), 'hex')),
      amount: BigInt(amount),
    });
  console.log('mintData', mintData);
  let data = TokenOpcode.enc({
      op: MINT,
      data: Array.from(mintData),
  });
  let txData = {
      nonce: nonce,
      chainId: chainId,
      from: publicKey,
      to: TOKEN_ID,
      data: utils.toHexString(Array.from(data)),
  };
  let bData = getRawData(txData);
  let hash = keccak256(bData);
  txData.signature = signData(hash, privateKeyBuffer);
  console.log(txData, Array.from(data));
}