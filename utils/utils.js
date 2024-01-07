const { u8, u128, Struct, Vector, Bytes } = require('scale-ts');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const BN = require('bn.js');
const { blake2AsHex, encodeAddress } = require('@polkadot/util-crypto');
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

// query info from blockchain node
async function contractCall(provider, moduleName, methodName, arguments) {
  const ret = await provider.query[moduleName][methodName](...arguments);
  return ret;
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

  let asset = Assets.dec(txData.payload);
  bData = Buffer.concat([bData, Buffer.from([asset.op])]);

  bData = Buffer.concat([bData, Buffer.from(asset.ex_data)]);
  bData = Buffer.concat([
    bData,
    Buffer.from(new BN(asset.amount).toString('hex').padStart(32, '0'), 'hex'),
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

function getAddress(publicKey) {
  // `publicKey` starts from `0x`
  // const pubKey = publicKey.substring(2);
  if (publicKey.substr(0, 2) == '0x') {
    publicKey = publicKey.substr(2);
  }

  const y = '0x' + publicKey.substring(64);
  // console.log(y);

  const _1n = BigInt(1);
  let flag = BigInt(y) & _1n ? '03' : '02';
  // console.log(flag);

  const x = Buffer.from(publicKey.substring(0, 64), 'hex');
  // console.log(pubKey.substring(0, 64));
  const finalX = Buffer.concat([Buffer.from([flag]), x]);
  const finalXArray = new Uint8Array(finalX);
  // console.log("Public Key: \n", finalXArray);
  const addrHash = blake2AsHex(finalXArray);
  return encodeAddress(addrHash);
}

// query info from blockchain node
async function contractCall(provider, moduleName, methodName, arguments) {
  const ret = await provider.query[moduleName][methodName](...arguments);
  return ret;
}

async function sendTransaction(
  api,
  palletName,
  tokenId,
  privateKeyBuffer,
  publicKey,
  op,
  to,
  amount
) {
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

function substrateTxWorker(
  { api, moduleName, methodName, account, arguments },
  callback
) {
  api.tx[moduleName][methodName](...arguments).signAndSend(
    account,
    ({ status, events }) => {
      console.log(status.isInBlock, status.isFinalized);
      if (status.isInBlock || status.isFinalized) {
        let err;
        events
          // find/filter for failed events
          .filter(({ event }) => api.events.system.ExtrinsicFailed.is(event))
          // we know that data for system.ExtrinsicFailed is
          // (DispatchError, DispatchInfo)
          .forEach(
            ({
              event: {
                data: [error, info],
              },
            }) => {
              if (error.isModule) {
                // for module errors, we have the section indexed, lookup
                const decoded = api.registry.findMetaError(error.asModule);
                const { docs, method, section } = decoded;

                console.log(`${section}.${method}: ${docs.join(' ')}`);
              } else {
                // Other, CannotLookup, BadOrigin, no extra info
                console.log(error.toString());
              }
              err = error;
            }
          );
        if (status.isInBlock) {
          callback(err);
        }
      }
    }
  );
}

async function enqueueTask(
  queue,
  api,
  moduleName,
  methodName,
  account,
  arguments
) {
  return new Promise((resolve, reject) => {
    queue.push(
      { api, moduleName, methodName, account, arguments },
      function (error) {
        if (error) {
          reject(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}

module.exports = {
  contractCall,
  sendTransaction,
  substrateTxWorker,
  enqueueTask,
  toByteArray,
  getAddress,
  Assets,
  toHexString,
  getRawData,
  signData,
  TransferTokenOp,
};
