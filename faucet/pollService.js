const utils = require('../utils/utils');
const { eip712Hash } = require('./eip712');
const config = require('config');
const fs = require('fs');
const { Web3 } = require('web3');
const ethereum = require('./ethereum');
const PENDING_TABLE_NAME = 'Pending';
const CLAIMED_TABLE_NAME = 'Claimed';
const LOCAL_PENDING_TABLE_NAME = 'LocalPending';
const LOCAL_CLAIMED_TABLE_NAME = 'LocalClaimed';

async function sendOmniverseAsset(request, sender, secret) {
  while (1) {
    let table = StateDB.getTable(PENDING_TABLE_NAME);
    if (Object.keys(table).length !== 0) {
      const assetId = config.get('assetId');
      const faucetAmount = config.get('faucetAmount');
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
        if (outputs.length > 10) {
          break;
        }
        outputs.push({
          address,
          amount: faucetAmount,
        });
      }
      if (outputs.length > 0) {
        try {
          let preTransferData = await request.rpc('preTransfer', [
            {
              assetId,
              address: sender,
              outputs,
            },
          ]);
          console.log(preTransferData);
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
            for (let output of outputs) {
              let value = StateDB.getValue(PENDING_TABLE_NAME, output.address);
              StateDB.setValue(CLAIMED_TABLE_NAME, output.address, value);
              StateDB.deleteValue(PENDING_TABLE_NAME, output.address);
            }
          } catch (e) {
            console.error('sendTransaction failed:', e);
            return;
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
    await utils.sleep(2);
  }
}

async function sendLocalToken() {
  const rpc = config.get('localToken.rpc');
  const web3 = new Web3(rpc);
  const contractRawData = fs.readFileSync(
    config.get(
      'localToken.abi',
    ),
  );
  const contractAbi = JSON.parse(contractRawData);
  const contract = new web3.eth.Contract(
    contractAbi,
    config.get('localToken.contract'),
  );
  const faucetAmount = config.get('localToken.faucetAmount');
  const sk = fs.readFileSync(config.get('localToken.secret')).toString();
  const chainId = config.get('localToken.chainId');
  const limit = config.get('localToken.limit');
  while (1) {
    try {
      // get addresses
      let table = StateDB.getTable(LOCAL_PENDING_TABLE_NAME);
      let addresses = [];
      for (let address of Object.keys(table)) {
        if (addresses.length < parseInt(limit)) {
          addresses.push({
            account: address,
            amount: faucetAmount
          });
        }
        else {
          break;
        }
      }
      
      if (addresses.length == 0) {
        break;
      }

      // batch transfer
      const ret = await ethereum.sendTransaction(web3, chainId, contract, 'batchTransfer', sk, [addresses]);

      // confirm
      if (!ret) {
        console.log('Batch transfer failed');
        return;
      }

      while (1) {
        await utils.sleep(2);
        const receipt = await waitForTransactionReceipt(
          ret.transactionHash,
          web3
        );

        if (receipt) {
          for (let {account} of addresses) {
            let value = StateDB.getValue(LOCAL_PENDING_TABLE_NAME, account);
            StateDB.setValue(LOCAL_CLAIMED_TABLE_NAME, account, value);
            StateDB.deleteValue(LOCAL_PENDING_TABLE_NAME, account);
          }
          console.log("Batch transfer ETH successfully");
          break;
        }
      }
    } catch (err) {
      console.log('Send local token error: ', err);
    }
    await utils.sleep(2);
  }
}

async function waitForTransactionReceipt(txHash, web3) {
  let receipt;
  while (!receipt) {
    try {
      receipt = await web3.eth.getTransactionReceipt(txHash);
    } catch (e) {
      console.log('error', e);
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return receipt;
}

const polling = async (request, sender, secret) => {
  await Promise.all([
    sendOmniverseAsset(request, sender, secret),
    sendLocalToken(),
  ]);
};

module.exports = polling;
