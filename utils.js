const { u8, u128, Struct, Vector, Bytes } = require('scale-ts');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const BN = require('bn.js');

const TokenOpcode = Struct({
  op: u8,
  data: Vector(u8),
});

const TransferTokenOp = Struct({
  to: Bytes(64),
  amount: u128,
});
const ChainId = 1;

global.Transfer = async function (tokenId, to, amount) {
  let nonce = await Api.query.omniverseProtocol.transactionCount(PublicKey);
  let transferData = TransferTokenOp.enc({
      to: new Uint8Array(Buffer.from(to.slice(2), 'hex')),
      amount: BigInt(amount),
    });
  let data = TokenOpcode.enc({
      op: 1,
      data: Array.from(transferData),
  });
  let txData = {
      nonce,
      chainId: ChainId,
      from: PublicKey,
      to: tokenId,
      data: toHexString(Array.from(data)),
  };
  let bData = getRawData(txData);
  let hash = keccak256(bData);
  txData.signature = signData(hash, PrivateKeyBuffer);
  // console.log(txData);
  return txData;
}

// Convert u8 array to hex string
function toHexString(byteArray) {
  return '0x' + Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

let getRawData = (txData) => {
  let bData = Buffer.concat([Buffer.from(new BN(txData.nonce).toString('hex').padStart(32, '0'), 'hex'), Buffer.from(new BN(txData.chainId).toString('hex').padStart(2, '0'), 'hex'),
      Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
  return bData;
}

let signData = (hash, sk) => {
  let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(sk));
  return '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
}

global.ToByteArray = function (hexString) {
  if (hexString.substr(0, 2) == '0x') {
      hexString = hexString.substr(2);
  }
  
  let result = [];
  for (let i = 0; i < hexString.length; i += 2) {
      result.push(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}