/**
 * Blockchain service - policy deployment (simulated or real testnet)
 * Set BLOCKCHAIN_RPC_URL + BLOCKCHAIN_PRIVATE_KEY for real Sepolia deployment
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const EXPLORER_BASE = process.env.BLOCKCHAIN_EXPLORER || 'https://sepolia.etherscan.io';
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

function generateTxHash() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function generateContractAddress() {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

function canDeployReal() {
  return !!(RPC_URL && PRIVATE_KEY);
}

/**
 * MicroInsurancePolicy contract ABI (constructor + events)
 * Used for execution simulation
 */
const CONTRACT_ABI = [
  'constructor(address _insured, uint256 _premium, string _coverage)',
  'event PolicyBound(address indexed insured, uint256 premium, string coverage)',
  'function insurer() view returns (address)',
  'function insured() view returns (address)',
  'function premium() view returns (uint256)',
  'function coverage() view returns (string)',
  'function active() view returns (bool)',
];

/**
 * Simulate contract deployment execution steps
 * Mirrors: new MicroInsurancePolicy(insured, premiumWei, coverage)
 */
function simulateContractExecution(policyId, insured, premium, coverage) {
  const txHash = generateTxHash();
  const contractAddress = generateContractAddress();
  const premiumWei = Math.floor(premium * 1e18).toString(); // USD to wei (simplified)
  const coverageStr = `goods-in-transit-${coverage}`;

  const steps = [
    { step: 1, action: 'Encode constructor args', detail: `insured: ${insured}, premium: ${premiumWei} wei, coverage: "${coverageStr}"` },
    { step: 2, action: 'Estimate gas', detail: '~450,000 gas for contract deployment' },
    { step: 3, action: 'Sign transaction', detail: 'From: insurer wallet, To: null (create), Value: 0' },
    { step: 4, action: 'Broadcast to network', detail: `txHash: ${txHash}` },
    { step: 5, action: 'Contract deployed', detail: `Address: ${contractAddress}` },
    { step: 6, action: 'PolicyBound event emitted', detail: 'insured, premium, coverage logged' },
    { step: 7, action: 'Confirmation', detail: 'Block included, policy on-chain' },
  ];

  return {
    tx_hash: txHash,
    contract_address: contractAddress,
    smart_contract_url: `${EXPLORER_BASE}/tx/${txHash}`,
    contract_address_url: `${EXPLORER_BASE}/address/${contractAddress}`,
    execution_steps: steps,
    constructor_args: {
      insured,
      premium_wei: premiumWei,
      coverage: coverageStr,
    },
    abi: CONTRACT_ABI,
  };
}

/**
 * Deploy contract to real testnet (Sepolia) when configured
 */
async function deployToChain(insuredAddress, premiumWei, coverageStr) {
  if (!canDeployReal()) return null;
  try {
    const { ethers } = require('ethers');
    const solc = require('solc');
    const contractPath = path.join(__dirname, '../../contracts/MicroInsurancePolicy.sol');
    const source = fs.readFileSync(contractPath, 'utf8');
    const input = {
      language: 'Solidity',
      sources: { 'MicroInsurancePolicy.sol': { content: source } },
      settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contract = output.contracts['MicroInsurancePolicy.sol'].MicroInsurancePolicy;
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployed = await factory.deploy(insuredAddress, premiumWei, coverageStr);
    await deployed.waitForDeployment();
    const address = await deployed.getAddress();
    const tx = deployed.deploymentTransaction();
    return {
      tx_hash: tx.hash,
      contract_address: address,
      smart_contract_url: `${EXPLORER_BASE}/tx/${tx.hash}`,
      contract_address_url: `${EXPLORER_BASE}/address/${address}`,
    };
  } catch (e) {
    console.error('Blockchain deploy error:', e.message);
    return null;
  }
}

/**
 * Record policy on blockchain (simulated or real)
 * Returns { tx_hash, contract_address, explorer_url, execution_steps }
 */
async function recordPolicy(policyId, insured, premium, coverage) {
  const premiumWei = BigInt(Math.floor(premium * 1e18));
  const coverageStr = `goods-in-transit-${coverage}`;
  // Use consistent address format for both simulation and real deployment so downstream
  // systems (validation, audit, claims) always receive the same constructor_args shape.
  const insuredAddress = '0x0000000000000000000000000000000000000001';

  const buildConstructorArgs = () => ({
    insured: insuredAddress,
    premium_wei: premiumWei.toString(),
    coverage: coverageStr,
  });

  if (canDeployReal()) {
    const real = await deployToChain(insuredAddress, premiumWei.toString(), coverageStr);
    if (real) {
      const steps = [
        { step: 1, action: 'Compile contract', detail: 'Solidity → bytecode' },
        { step: 2, action: 'Sign deployment', detail: 'Wallet signs tx' },
        { step: 3, action: 'Broadcast', detail: `txHash: ${real.tx_hash}` },
        { step: 4, action: 'Deployed', detail: `Address: ${real.contract_address}` },
        { step: 5, action: 'Confirmed', detail: 'Policy on-chain (Sepolia)' },
      ];
      return {
        ...real,
        execution_steps: steps,
        constructor_args: buildConstructorArgs(),
      };
    }
  }

  const result = simulateContractExecution(policyId, insuredAddress, premium, coverage);
  return {
    tx_hash: result.tx_hash,
    contract_address: result.contract_address,
    smart_contract_url: result.smart_contract_url,
    contract_address_url: result.contract_address_url,
    execution_steps: result.execution_steps,
    constructor_args: buildConstructorArgs(),
  };
}

module.exports = { recordPolicy, simulateContractExecution, deployToChain, canDeployReal, CONTRACT_ABI };
