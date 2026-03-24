import { useState } from "react";
import { checkInstitutionStatus, getStatusLabel } from "../utils/blockchain";

export default function InstitutionCheck() {
  const [walletAddress, setWalletAddress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCheck(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await checkInstitutionStatus(walletAddress.trim());
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err.message || "Unable to validate wallet status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Check wallet</h2>
      </div>

      <form className="form-stack" onSubmit={handleCheck}>
        <label>
          <span>Wallet address</span>
          <input
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="0x..."
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Checking..." : "Check Verification"}
        </button>
      </form>

      {result ? (
        <div className="status-stack top-gap">
          <div className={`status-pill status-${result.status}`}>{getStatusLabel(result.status)}</div>
          <dl className="detail-grid">
            <div>
              <dt>Wallet</dt>
              <dd className="hash-wrap">{result.wallet}</dd>
            </div>
            <div>
              <dt>Verified</dt>
              <dd>{result.verified ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Status hash</dt>
              <dd className="hash-wrap">{result.statusHash || "Not available"}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {error ? <div className="banner error">{error}</div> : null}
    </section>
  );
}
