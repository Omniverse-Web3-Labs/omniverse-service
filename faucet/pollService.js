const utils = require('../utils/utils');
const { eip712Hash } = require('./eip712');
const config = require('config');
const fs = require('fs');
const {Web3} = require('web3');
const PENDING_TABLE_NAME = 'Pending';
const CLAIMED_TABLE_NAME = 'Claimed';
const LOCAL_PENDING_TABLE_NAME = 'LocalPending';
const LOCAL_CLAIMED_TABLE_NAME = 'LocalClaimed';

async function sendOmniverseAsset(request, sender, secret) {
  const assetId = config.get('assetId')
  const faucetAmount = config.get('faucetAmount')
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
      if (outputs.length > 10) {
        break;
      }
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
}

async function sendLocalToken() {
  const faucetAmount = config.get('localToken.faucetAmount');
  const rpc = config.get('localToken.rpc');
  const sk = fs.readFileSync(config.get('localToken.secret')).toString();
  const chainId = config.get('localToken.chainId');
  let table = StateDB.getTable(LOCAL_PENDING_TABLE_NAME);
  for (let address of Object.keys(table)) {
    const web3 = new Web3(rpc);
    // try {
    const account =
    web3.eth.accounts.privateKeyToAccount(sk).address;
    const to = address;
    const nonce = web3.utils.numberToHex(
        await web3.eth.getTransactionCount(account)
    );
    const estimateGas = await web3.eth.estimateGas({
        from: account,
        to
    });
    // const gasPrice = await web3.eth.getGasPrice();
    // console.log('gas: '+gas);
    // console.log('gasPrice: '+gasPrice);
    // console.log('estimateGas: ' + estimateGas);

    let { gasPrice, maxFeePerGas, maxPriorityFeePerGas } =
        await web3.eth.calculateFeeData();
    const tx = {
        account,
        to,
        chainId,
        nonce,
        value: faucetAmount,
        gasLimit: estimateGas,
        maxFeePerGas,
        maxPriorityFeePerGas
    };
    // console.log(tx);

    let signTx = await web3.eth.accounts.signTransaction(
        tx,
        sk
    );
    let ret = await web3.eth.sendSignedTransaction(signTx.rawTransaction);
    console.log(`gasUsed: ${ret.gasUsed}`);
    
    // confirm
    while (1) {
      await utils.sleep(2);
      const receipt = await waitForTransactionReceipt(ret.transactionHash, web3);
      if (receipt) {
        let value = StateDB.getValue(LOCAL_PENDING_TABLE_NAME, address);
        StateDB.setValue(LOCAL_CLAIMED_TABLE_NAME, address, value);
        StateDB.deleteValue(LOCAL_PENDING_TABLE_NAME, address);
        break;
      }
    }
  }
}

async function waitForTransactionReceipt(txHash, web3) {
  let receipt;
  while (!receipt) {
    try {
      receipt = await web3.eth.getTransactionReceipt(txHash);
    } catch (e) {
      console.log("error", e);
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return receipt;
}

const polling = async (request, sender, secret) => {
  while (1) {
    await sendOmniverseAsset(request, sender, secret);
    await sendLocalToken();
    await utils.sleep(5);
  }
};

module.exports = polling;
