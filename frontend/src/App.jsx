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
  const [activePage, setActivePage] = useState(() => getPageFromHash(window.location.hash));
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

    const onHashChange = () => {
      setActivePage(getPageFromHash(window.location.hash));
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);
    window.addEventListener("hashchange", onHashChange);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
      window.removeEventListener("hashchange", onHashChange);
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

  function navigate(nextPage) {
    window.location.hash = nextPage;
  }

  const allowedPages = getAllowedPages(isVerifier);
  const fallbackPage = getDefaultPage(isVerifier);
  const pageTitle = PAGE_TITLES[activePage] || PAGE_TITLES.applicant;

  useEffect(() => {
    if (!allowedPages.some((page) => page.id === activePage)) {
      navigate(fallbackPage);
    }
  }, [activePage, allowedPages, fallbackPage]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy-block reveal-up">
          <h1>KYC Chain</h1>
          <p className="hero-copy">{pageTitle}</p>

          <div className="hero-actions">
            <button className="primary-button" onClick={handleConnect}>
              {wallet ? "Wallet Ready" : "Connect MetaMask"}
            </button>
          </div>

          <div className="hero-meta">
            <div className="wallet-card spotlight-card">
              <span>Wallet</span>
              <strong>{wallet ? shorten(wallet) : "No wallet connected"}</strong>
              <small>{roleLabel(isAdmin, isVerifier)}</small>
            </div>

              <div className="metric-row">
              {[
                { label: "submissions", value: stats.submissions },
                { label: "pending", value: stats.pending },
                { label: "verified", value: stats.verified },
                { label: "rejected", value: stats.rejected },
                { label: "verifiers", value: stats.verifiers }
              ].map((item) => (
                <MetricChip key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>
        </div>

        <div className="hero-stage reveal-up">
          <div className="hero-orb hero-orb-a" />
          <div className="hero-orb hero-orb-b" />
          <div className="hero-grid" />
          <div className="hero-visual">
            <div className="signal-ring signal-ring-outer" />
            <div className="signal-ring signal-ring-inner" />
            <div className="signal-core">
              <small>Live registry</small>
              <strong>{stats.verified}</strong>
              <span>verified wallets</span>
            </div>

            <VisualTag
              title="Submit"
              subtitle="documents"
              state={activePage === "applicant" ? "active" : ""}
              position="tag-submit"
            />
            <VisualTag
              title="Review"
              subtitle="verifier action"
              state={activePage === "verifier" ? "active" : ""}
              position="tag-review"
            />
            <VisualTag
              title="Check"
              subtitle="institution"
              state={activePage === "institution" ? "active" : ""}
              position="tag-check"
            />

            <div className="signal-arc signal-arc-a" />
            <div className="signal-arc signal-arc-b" />
            <div className="signal-arc signal-arc-c" />
          </div>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}

      <nav className="page-nav" aria-label="Workflow pages">
        {allowedPages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={page.id === activePage ? "nav-pill nav-pill-active" : "nav-pill"}
            onClick={() => navigate(page.id)}
          >
            <span>{page.label}</span>
          </button>
        ))}
      </nav>

      <main className="content-grid page-layout">
        {activePage === "applicant" ? (
          <>
            <SubmitKYC wallet={wallet} isVerifier={isVerifier} onSubmitted={handleRefresh} />
            <StatusPage key={`status-${refreshKey}`} wallet={wallet} />
          </>
        ) : null}

        {activePage === "verifier" ? (
          <>
            {isVerifier ? (
              <AdminPanel
                key={`admin-${refreshKey}`}
                canManageVerifiers={isAdmin}
                onAction={handleRefresh}
              />
            ) : (
              <section className="panel panel-wide empty-state">
                <h3>Switch to the verifier wallet</h3>
              </section>
            )}
          </>
        ) : null}

        {activePage === "institution" ? (
          <InstitutionCheck key={`institution-${refreshKey}`} />
        ) : null}
      </main>
    </div>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="metric-chip">
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
    return "admin";
  }
  if (isVerifier) {
    return "verifier";
  }
  return "user";
}

function VisualTag({ title, subtitle, state, position }) {
  return (
    <div className={`visual-tag ${position} ${state}`}>
      <span>{title}</span>
      <strong>{subtitle}</strong>
    </div>
  );
}

const PAGES = [
  { id: "applicant", label: "Applicant" },
  { id: "verifier", label: "Verifier" },
  { id: "institution", label: "Institution" }
];

const PAGE_TITLES = {
  applicant: "Submit and track",
  verifier: "Review requests",
  institution: "Check a wallet"
};

function getAllowedPages(isVerifier) {
  return isVerifier
    ? PAGES.filter((page) => page.id !== "applicant")
    : PAGES.filter((page) => page.id !== "verifier");
}

function getDefaultPage(isVerifier) {
  return isVerifier ? "verifier" : "applicant";
}

function getPageFromHash(hash) {
  const normalized = hash.replace("#", "");
  return PAGES.some((page) => page.id === normalized) ? normalized : "applicant";
}
