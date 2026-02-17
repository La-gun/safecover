/**
 * Blockchain service - simulates policy deployment
 * For production: integrate with ethers.js/web3.js and real network
 */
const crypto = require('crypto');

const EXPLORER_BASE = process.env.BLOCKCHAIN_EXPLORER || 'https://sepolia.etherscan.io';

function generateTxHash() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function generateContractAddress() {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

/**
 * Record policy on blockchain (simulated)
 * Returns { tx_hash, contract_address, explorer_url }
 */
function recordPolicy(policyId, insured, premium, coverage) {
  const txHash = generateTxHash();
  const contractAddress = generateContractAddress();
  return {
    tx_hash: txHash,
    contract_address: contractAddress,
    smart_contract_url: `${EXPLORER_BASE}/tx/${txHash}`,
    contract_address_url: `${EXPLORER_BASE}/address/${contractAddress}`,
  };
}

module.exports = { recordPolicy };
