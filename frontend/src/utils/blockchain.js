import { BrowserProvider, Contract } from "ethers";
import contractData from "./KYCRegistry.json";

const STATUS_LABELS = ["Not Submitted", "Pending", "Verified", "Rejected"];

function getEthereum() {
  if (!window.ethereum) {
    throw new Error("MetaMask is required to use this application.");
  }
  return window.ethereum;
}

async function getProvider() {
  return new BrowserProvider(getEthereum());
}

async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

async function getContract(withSigner = false) {
  if (!contractData.address) {
    throw new Error("Contract is not deployed yet. Run deploy:local or deploy:sepolia first.");
  }

  const runner = withSigner ? await getSigner() : await getProvider();
  return new Contract(contractData.address, contractData.abi, runner);
}

function normalizeRecord(record, wallet = "") {
  return {
    wallet,
    fullName: record.fullName,
    email: record.email,
    dateOfBirth: record.dateOfBirth,
    residentialAddress: record.residentialAddress,
    documentType: record.documentType,
    ipfsCID: record.ipfsCID,
    rejectionReason: record.rejectionReason,
    reviewerNote: record.reviewerNote,
    submittedAt: Number(record.submittedAt),
    reviewedAt: Number(record.reviewedAt),
    statusHash: record.statusHash,
    status: Number(record.status),
    reviewer: record.reviewer,
    exists: Boolean(record.exists)
  };
}

export async function connectWallet() {
  const [account] = await getEthereum().request({ method: "eth_requestAccounts" });
  return account || "";
}

export async function getCurrentWallet() {
  const accounts = await getEthereum().request({ method: "eth_accounts" });
  return accounts[0] || "";
}

export async function hasVerifierRole(address) {
  const contract = await getContract(false);
  return contract.hasVerifierRole(address);
}

export async function hasAdminRole(address) {
  const contract = await getContract(false);
  return contract.hasAdminRole(address);
}

export async function submitKYC(payload) {
  const contract = await getContract(true);
  const tx = await contract.submitKYC(
    payload.fullName,
    payload.email,
    payload.dateOfBirth,
    payload.residentialAddress,
    payload.documentType,
    payload.ipfsCID
  );
  await tx.wait();
}

export async function approveUser(address, reviewerNote) {
  const contract = await getContract(true);
  const tx = await contract.verifyUser(address, reviewerNote);
  await tx.wait();
}

export async function rejectUser(address, reason, reviewerNote) {
  const contract = await getContract(true);
  const tx = await contract.rejectUser(address, reason, reviewerNote);
  await tx.wait();
}

export async function addVerifier(address) {
  const contract = await getContract(true);
  const tx = await contract.addVerifier(address);
  await tx.wait();
}

export async function removeVerifier(address) {
  const contract = await getContract(true);
  const tx = await contract.removeVerifier(address);
  await tx.wait();
}

export async function getDashboardStats() {
  const contract = await getContract(false);
  const [submissions, pending, verified, rejected, verifiers] = await contract.getDashboardStats();
  return {
    submissions: Number(submissions),
    pending: Number(pending),
    verified: Number(verified),
    rejected: Number(rejected),
    verifiers: Number(verifiers)
  };
}

export async function getMyRecord() {
  const contract = await getContract(true);
  const record = await contract.getMyRecord();
  return normalizeRecord(record);
}

export async function getVerifierRecord(address) {
  const contract = await getContract(false);
  const record = await contract.getRecord(address);
  return normalizeRecord(record, address);
}

export async function fetchPendingApplications() {
  const contract = await getContract(false);
  const addresses = await contract.getPendingApplicants();
  return Promise.all(addresses.map((address) => getVerifierRecord(address)));
}

export async function getVerifiers() {
  const contract = await getContract(false);
  return contract.getVerifierAddresses();
}

export async function checkInstitutionStatus(wallet) {
  const contract = await getContract(false);
  const [verified, status] = await Promise.all([
    contract.isVerified(wallet),
    contract.checkStatus(wallet)
  ]);

  let statusHash = "";
  if (Number(status) !== 0) {
    statusHash = await contract.getStatusHash(wallet);
  }

  return {
    wallet,
    verified,
    status: Number(status),
    statusHash
  };
}

export function getStatusLabel(status) {
  return STATUS_LABELS[Number(status)] || "Unknown";
}

export function formatTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!numeric) {
    return "Not available";
  }

  return new Date(numeric * 1000).toLocaleString();
}

export async function uploadDocument(file, metadata) {
  const token = import.meta.env.VITE_WEB3_STORAGE_TOKEN;

  if (!token) {
    return `mock-${Date.now()}-${sanitize(file.name)}`;
  }

  const payload = new Blob(
    [
      JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        metadata
      })
    ],
    { type: "application/json" }
  );

  const formData = new FormData();
  formData.append("file", payload, `${sanitize(file.name)}.json`);

  const response = await fetch("https://api.web3.storage/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error("IPFS upload failed. Check your web3.storage token.");
  }

  const result = await response.json();
  return result.cid;
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9.-]/g, "-");
}
