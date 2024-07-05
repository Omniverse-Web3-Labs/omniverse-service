const secp256k1 = require('secp256k1');
const _ = require('lodash');

// Convert u8 array to hex string
function toHexString(byteArray) {
  return (
    '0x' +
    Array.from(byteArray, function (byte) {
      return ('0' + (byte & 0xff).toString(16)).slice(-2);
    }).join('')
  );
}

let sign = (hash, sk) => {
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

async function sleep(seconds) {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}

function snakeCaseKeys(o) {
  if (o instanceof Array) {
    const a = [];
    for (const value of o) {
      a.push(snakeCaseKeys(value));
    }
    return a;
  } else if (o instanceof Object) {
    const a = {};
    for (const key in o) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      a[_.snakeCase(key)] = snakeCaseKeys(o[key]);
    }
    return a;
  }
  return o;
}
module.exports = {
  toByteArray,
  toHexString,
  sign,
  sleep,
  snakeCaseKeys,
};
