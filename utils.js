const { u8, u128, Struct, Vector, Bytes } = require('scale-ts');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const BN = require('bn.js');

const Assets = Struct({
  op: u8,
  ex_data: Vector(u8),
  amount: u128,
});

const TransferTokenOp = Struct({
  to: Bytes(64),
  amount: u128,
});
const ChainId = 1;

async function sendTransaction(api, palletName, tokenId, privateKeyBuffer, publicKey, op, to, amount) {
  let nonce = await api.query.omniverseProtocol.transactionCount(
    publicKey,
    palletName,
    tokenId
  );

  let payload = Assets.enc({
    op: op,
    ex_data: Array.from(Buffer.from(to.slice(2), 'hex')),
    amount: BigInt(amount),
  });

  let txData = {
    nonce: nonce.toJSON(),
    chainId: ChainId,
    initiatorAddress: tokenId,
    from: publicKey,
    payload: toHexString(Array.from(payload)),
  };

  let bData = getRawData(txData);
  let hash = keccak256(bData);
  txData.signature = signData(hash, privateKeyBuffer);
  console.log(txData);
  return txData;
}

// Convert u8 array to hex string
function toHexString(byteArray) {
  return (
    '0x' +
    Array.from(byteArray, function (byte) {
      return ('0' + (byte & 0xff).toString(16)).slice(-2);
    }).join('')
  );
}

let getRawData = (txData) => {
  let bData = Buffer.concat([
    Buffer.from(new BN(txData.nonce).toString('hex').padStart(32, '0'), 'hex'),
    Buffer.from(new BN(txData.chainId).toString('hex').padStart(8, '0'), 'hex'),
    Buffer.from(txData.initiatorAddress, 'utf-8'),
    Buffer.from(txData.from.slice(2), 'hex'),
  ]);
  console.log(bData);

  let asset = Assets.dec(txData.payload);
  bData = Buffer.concat([bData, Buffer.from([asset.op])]);

  bData = Buffer.concat([bData, Buffer.from(asset.ex_data)]);
  bData = Buffer.concat([
    bData,
    Buffer.from(
      new BN(asset.amount).toString('hex').padStart(32, '0'),
      'hex'
    ),
  ]);

  return bData;
};

let signData = (hash, sk) => {
  let signature = secp256k1.ecdsaSign(
    Uint8Array.from(hash),
    Uint8Array.from(sk)
  );
  return (
    '0x' +
    Buffer.from(signature.signature).toString('hex') +
    (signature.recid == 0 ? '1b' : '1c')
  );
};

function toByteArray(hexString) {
  if (hexString.substr(0, 2) == '0x') {
    hexString = hexString.substr(2);
  }

  let result = [];
  for (let i = 0; i < hexString.length; i += 2) {
    result.push(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}

module.exports = {
  sendTransaction,
  toByteArray,
};
