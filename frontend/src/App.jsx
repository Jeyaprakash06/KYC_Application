import { useEffect, useState } from "react";
import SubmitKYC from "./components/SubmitKYC";
import StatusPage from "./components/StatusPage";
import AdminPanel from "./components/AdminPanel";
import InstitutionCheck from "./components/InstitutionCheck";
import {
  connectWallet,
  getCurrentWallet,
  getDashboardStats,
  hasAdminRole,
  hasVerifierRole
} from "./utils/blockchain";

export default function App() {
  const [wallet, setWallet] = useState("");
  const [isVerifier, setIsVerifier] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    submissions: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    verifiers: 0
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  async function hydrate(address) {
    if (!address) {
      setWallet("");
      setIsVerifier(false);
      setIsAdmin(false);
      return;
    }

    setWallet(address);

    try {
      const [verifierRole, adminRole, dashboardStats] = await Promise.all([
        hasVerifierRole(address),
        hasAdminRole(address),
        getDashboardStats()
      ]);

      setIsVerifier(verifierRole);
      setIsAdmin(adminRole);
      setStats(dashboardStats);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load blockchain data.");
    }
  }

  useEffect(() => {
    getCurrentWallet().then(hydrate).catch(() => {});

    if (!window.ethereum) {
      return undefined;
    }

    const onAccountsChanged = (accounts) => {
      hydrate(accounts[0] || "");
      setRefreshKey((value) => value + 1);
    };

    const onChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, []);

  async function handleConnect() {
    try {
      const address = await connectWallet();
      await hydrate(address);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Wallet connection failed.");
    }
  }

  function handleRefresh() {
    hydrate(wallet);
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Complete blockchain KYC registry</p>
          <h1>KYC Chain</h1>
          <p className="hero-copy">
            A full Ethereum-based KYC workflow with applicant submission, verifier review,
            institution checks, on-chain status tracking, and IPFS-backed document storage.
          </p>
        </div>

        <div className="hero-side">
          <button className="primary-button" onClick={handleConnect}>
            {wallet ? "Wallet Connected" : "Connect MetaMask"}
          </button>
          <div className="wallet-card">
            <span>Active wallet</span>
            <strong>{wallet ? shorten(wallet) : "Not connected"}</strong>
            <small>{roleLabel(isAdmin, isVerifier)}</small>
          </div>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}

      <section className="stats-grid">
        <StatCard label="Applications" value={stats.submissions} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Verified" value={stats.verified} />
        <StatCard label="Rejected" value={stats.rejected} />
        <StatCard label="Verifiers" value={stats.verifiers} />
      </section>

      <main className="content-grid">
        <SubmitKYC wallet={wallet} onSubmitted={handleRefresh} />
        <StatusPage key={`status-${refreshKey}`} wallet={wallet} />
        <InstitutionCheck key={`institution-${refreshKey}`} />
        {isVerifier ? (
          <AdminPanel
            key={`admin-${refreshKey}`}
            canManageVerifiers={isAdmin}
            onAction={handleRefresh}
          />
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function shorten(value) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function roleLabel(isAdmin, isVerifier) {
  if (isAdmin) {
    return "Admin verifier";
  }
  if (isVerifier) {
    return "Verifier";
  }
  return "Applicant / Institution";
}
