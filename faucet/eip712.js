// Based on https://github.com/ethereum/EIPs/blob/master/assets/eip-712/Example.js
const ethUtil = require('ethereumjs-util');
const { TypedDataUtils } = require('@metamask/eth-sig-util');

const TransferEip712TypeInfo = {
  primaryType: 'Transfer',
  types: {
    // This refers to the domain the contract is hosted on.,
    Transfer: [
      { name: 'asset_id', type: 'bytes32' },
      { name: 'inputs', type: 'Input[]' },
      { name: 'outputs', type: 'Output[]' },
      { name: 'fee_inputs', type: 'Input[]' },
      { name: 'fee_outputs', type: 'Output[]' },
      { name: 'gas_price', type: 'uint128' },
    ],
    Input: [
      { name: 'txid', type: 'bytes32' },
      { name: 'index', type: 'uint32' },
      { name: 'amount', type: 'uint128' },
      { name: 'address', type: 'bytes32' },
    ],
    Output: [
      { name: 'amount', type: 'uint128' },
      { name: 'address', type: 'bytes32' },
    ],
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
  },
};

const DeployEip712TypeInfo = {
  primaryType: 'Deploy',
  types: {
    // This refers to the domain the contract is hosted on.,
    Deploy: [
      { name: 'salt', type: 'bytes8' },
      { name: 'name', type: 'string' },
      { name: 'deployer', type: 'bytes32' },
      { name: 'limit', type: 'uint128' },
      { name: 'price', type: 'uint128' },
      { name: 'total_supply', type: 'uint128' },
      { name: 'fee_inputs', type: 'Input[]' },
      { name: 'fee_outputs', type: 'Output[]' },
    ],
    Input: [
      { name: 'txid', type: 'bytes32' },
      { name: 'index', type: 'uint32' },
      { name: 'amount', type: 'uint128' },
      { name: 'address', type: 'bytes32' },
    ],
    Output: [
      { name: 'amount', type: 'uint128' },
      { name: 'address', type: 'bytes32' },
    ],
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
  },
};

function eip712Hash(domain, message, typeInfo = TransferEip712TypeInfo) {
  const msgParams = {
    domain,

    // This defines the message you're proposing the user to sign, is dapp-specific, and contains
    // anything you want. There are no required fields. Be as explicit as possible when building out
    // the message schema.
    message,
    // This refers to the keys of the following types object.
    primaryType: typeInfo.primaryType,
    types: typeInfo.types,
  };
  let concat = Buffer.concat([
    Buffer.from([0x19, 0x01]),
    ethUtil.keccak256(
      TypedDataUtils.encodeData(
        'EIP712Domain',
        msgParams.domain,
        msgParams.types,
        'V4'
      )
    ),
    ethUtil.keccak256(
      TypedDataUtils.encodeData(
        msgParams.primaryType,
        msgParams.message,
        msgParams.types,
        'V4'
      )
    ),
  ]);
  return ethUtil.keccak256(concat);
}

module.exports = {
  TransferEip712TypeInfo,
  DeployEip712TypeInfo,
  eip712Hash,
};
