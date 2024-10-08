const ONE_DAY = 24 * 60 * 60 * 1000;
const PENDING_TABLE_NAME = 'Pending';
const CLAIMED_TABLE_NAME = 'Claimed';
const LOCAL_PENDING_TABLE_NAME = 'LocalPending';
const LOCAL_CLAIMED_TABLE_NAME = 'LocalClaimed';
const { isAddress } = require('web3-validator');

module.exports = async function (app) {
  app.get('/get_token', async function (req, res) {
    var address = req.query.address;
    if (address.substring(0, 2) !== '0x') {
      address = '0x' + address;
    }
    if (!isValidOmniverseAddress(address)) {
      res.send({
        code: -1,
        message: 'Wrong address',
      });
      return;
    }
    let currentTime = new Date().getTime();
    let lastClaimTime = currentTime;
    if (StateDB.has(PENDING_TABLE_NAME, address)) {
      lastClaimTime = StateDB.getValue(PENDING_TABLE_NAME, address);
      let nextClaimTime = lastClaimTime + ONE_DAY;
      if (nextClaimTime >= currentTime) {
        res.send({
          code: -2,
          message:
            'Already claimed, after ' +
            new Date(nextClaimTime).toISOString() +
            ' to claim.',
        });
        return;
      }
    }
    if (StateDB.has(CLAIMED_TABLE_NAME, address)) {
      lastClaimTime = StateDB.getValue(CLAIMED_TABLE_NAME, address);
      let nextClaimTime = lastClaimTime + ONE_DAY;
      if (nextClaimTime >= currentTime) {
        res.send({
          code: -2,
          message:
            'Already claimed, after ' +
            new Date(nextClaimTime).toISOString() +
            ' to claim.',
        });
        return;
      }
    }

    console.log(
      'Receive a faucet request from the account: ' +
        address +
        ' successfully!!!'
    );
    res.send({ code: 0, message: 'Receive a faucet request successfully' });
    StateDB.setValue(PENDING_TABLE_NAME, address, currentTime);
    return;
  });

  app.get('/get_local_token', async function (req, res) {
    var address = req.query.address;
    if (address.substring(0, 2) !== '0x') {
      address = '0x' + address;
    }
    const isValidAddress = isAddress(address, false);
    if (!isValidAddress) {
      console.error('Invalid address format:', address);
      res.send({
        code: -1,
        message: 'Wrong address',
      });
      return;
    }
    let currentTime = new Date().getTime();
    let lastClaimTime = currentTime;
    if (StateDB.has(LOCAL_PENDING_TABLE_NAME, address)) {
      lastClaimTime = StateDB.getValue(LOCAL_PENDING_TABLE_NAME, address);
      let nextClaimTime = lastClaimTime + ONE_DAY;
      if (nextClaimTime >= currentTime) {
        res.send({
          code: -2,
          message:
            'Already claimed, after ' +
            new Date(nextClaimTime).toISOString() +
            ' to claim.',
        });
        return;
      }
    }
    if (StateDB.has(LOCAL_CLAIMED_TABLE_NAME, address)) {
      lastClaimTime = StateDB.getValue(LOCAL_CLAIMED_TABLE_NAME, address);
      let nextClaimTime = lastClaimTime + ONE_DAY;
      if (nextClaimTime >= currentTime) {
        res.send({
          code: -2,
          message:
            'Already claimed, after ' +
            new Date(nextClaimTime).toISOString() +
            ' to claim.',
        });
        return;
      }
    }

    console.log(
      'Receive a faucet request from the account: ' +
        address +
        ' successfully!!!'
    );
    res.send({ code: 0, message: 'Receive a faucet request successfully' });
    StateDB.setValue(LOCAL_PENDING_TABLE_NAME, address, currentTime);
    return;
  });
};

function isValidOmniverseAddress(address) {
  const regex = /^0x[0-9a-fA-F]{64}$/;

  return regex.test(address);
}
