const utils = require('../utils/utils');
const { eip712Hash } = require('./eip712');
const config = require('config');
const PENDING_TABLE_NAME = 'Pending';
const CLAIMED_TABLE_NAME = 'Claimed';

const polling = async (request, sender, secret) => {
  const assetId = config.get('assetId')
  const faucetAmount = config.get('faucetAmount')
  while (1) {
    let table = StateDB.getTable(PENDING_TABLE_NAME);
    if (Object.keys(table).length !== 0) {
      let networkParameters = await request.rpc('getNetworkParameters', []);
      let eip712Domain = {
        chainId: networkParameters.eip712.chainId,
        name: 'Omniverse Transaction',
        verifyingContract: networkParameters.eip712.verifyingContract,
        version: networkParameters.eip712.version,
      };
      let outputs = [];
      const addresses = Object.keys(table);
      for (let address of addresses) {
        outputs.push({
          address,
          amount: faucetAmount,
        });
      }
      if (addresses) {
        try {
          let preTransferData = await request.rpc('preTransfer', [
            {
              assetId,
              address: sender,
              outputs,
            },
          ]);
          console.log(preTransferData)
          let messageHash = eip712Hash(eip712Domain, {
            asset_id: assetId,
            ...utils.snakeCaseKeys(preTransferData),
          });

          let signature = utils.sign(messageHash, secret);
          let txid = '';
          try {
            txid = await request.rpc('sendTransaction', [
              {
                type: 'Transfer',
                signature,
                assetId,
                ...preTransferData,
              },
            ]);
            for (let address of addresses) {
              let value = StateDB.getValue(PENDING_TABLE_NAME, address);
              StateDB.setValue(CLAIMED_TABLE_NAME, address, value);
              StateDB.deleteValue(PENDING_TABLE_NAME, address);
            }
          } catch (e) {
            console.error('sendTransaction failed:', e);
            continue;
          }
          console.log('txid: ', txid);
          while (1) {
            await utils.sleep(2);
            if (await request.rpc('getTransactionDetail', [txid])) {
              console.log('Transfer to', addresses.toString(), 'complete.');
              break;
            }
          }
        } catch (e) {
          console.error('rpc request failed:', e);
        }
      }
    }
    await utils.sleep(5);
  }
};

module.exports = polling;
