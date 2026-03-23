# KYC Chain

KYC Chain is a blockchain-based Know Your Customer registry built with Hardhat, Solidity, React, Vite, MetaMask, and IPFS-compatible document storage.

## What this project includes

- Applicant KYC submission flow with full profile fields
- IPFS document reference storage via CID
- On-chain KYC status lifecycle: pending, verified, rejected
- Applicant self-service status view
- Verifier review dashboard for approve and reject actions
- Admin verifier management for role onboarding and removal
- Institution lookup to validate whether a wallet is verified
- Hardhat test suite for the contract workflow
- Localhost and Sepolia deployment support

## Monorepo layout

- `smart-contracts/` - Solidity contract, deployment scripts, tests, and Hardhat config
- `frontend/` - React + Vite dApp for applicant, verifier, and institution workflows

## Environment files

Copy [.env.example](d:/KYC/.env.example) into both of these files:

- `smart-contracts/.env`
- `frontend/.env`

### Variables

- `PRIVATE_KEY` - required for Sepolia deployment
- `SEPOLIA_RPC_URL` - required for Sepolia deployment
- `ETHERSCAN_API_KEY` - optional, used for contract verification
- `VITE_WEB3_STORAGE_TOKEN` - optional for real IPFS uploads; if omitted, the frontend uses a mock CID for local demo flow

## Local run

### 1. Install dependencies

```powershell
cd d:\KYC\smart-contracts
npm.cmd install

cd d:\KYC\frontend
npm.cmd install
```

### 2. Start the local blockchain

Open terminal 1:

```powershell
cd d:\KYC\smart-contracts
npm.cmd run node
```

### 3. Deploy the contract locally

Open terminal 2:

```powershell
cd d:\KYC\smart-contracts
npm.cmd run deploy:local
```

This writes the deployed address and ABI to `frontend/src/utils/KYCRegistry.json`.

### 4. Start the frontend

Open terminal 3:

```powershell
cd d:\KYC\frontend
npm.cmd run dev
```

## MetaMask local network

Add this network in MetaMask:

- Network name: `Localhost 8545`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

Import Hardhat test accounts from the node output:

- Account `#0` - admin and default verifier
- Account `#1` - applicant wallet
- Account `#2` - optional second verifier or second applicant

## Local demo flow

1. Connect applicant wallet and submit a KYC application.
2. Switch to verifier wallet to review pending applications.
3. Approve or reject with notes.
4. Switch back to the applicant wallet and confirm updated status.
5. Use the institution lookup panel to verify wallet status independently.

## Sepolia deployment

```powershell
cd d:\KYC\smart-contracts
npm.cmd run deploy:sepolia
```

Optional Etherscan verification:

```powershell
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

Then deploy the frontend however you prefer, such as Vercel.

## Verified in this workspace

- `npm.cmd run compile` in `smart-contracts`
- `npm.cmd run test` in `smart-contracts`
- `npm.cmd run build` in `frontend`
