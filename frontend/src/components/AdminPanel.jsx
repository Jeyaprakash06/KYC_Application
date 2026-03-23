import { useEffect, useState } from "react";
import {
  addVerifier,
  approveUser,
  fetchPendingApplications,
  formatTimestamp,
  getStatusLabel,
  getVerifiers,
  rejectUser,
  removeVerifier
} from "../utils/blockchain";

export default function AdminPanel({ canManageVerifiers, onAction }) {
  const [pendingApplications, setPendingApplications] = useState([]);
  const [verifiers, setVerifiers] = useState([]);
  const [reasonMap, setReasonMap] = useState({});
  const [noteMap, setNoteMap] = useState({});
  const [newVerifier, setNewVerifier] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAdminData() {
    try {
      setLoading(true);
      const [pending, verifierList] = await Promise.all([
        fetchPendingApplications(),
        getVerifiers()
      ]);
      setPendingApplications(pending);
      setVerifiers(verifierList);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load verifier dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function handleApprove(address) {
    try {
      await approveUser(address, noteMap[address] || "Approved after verifier review.");
      setMessage(`Approved application for ${address}.`);
      await loadAdminData();
      onAction();
    } catch (err) {
      setError(err.message || "Approval failed.");
    }
  }

  async function handleReject(address) {
    const reason = reasonMap[address] || "";
    if (!reason.trim()) {
      setError("Enter a rejection reason before rejecting an application.");
      return;
    }

    try {
      await rejectUser(address, reason, noteMap[address] || "Please update the submitted details.");
      setMessage(`Rejected application for ${address}.`);
      await loadAdminData();
      onAction();
    } catch (err) {
      setError(err.message || "Rejection failed.");
    }
  }

  async function handleAddVerifier(event) {
    event.preventDefault();
    if (!newVerifier.trim()) {
      setError("Enter a wallet address to add as verifier.");
      return;
    }

    try {
      await addVerifier(newVerifier.trim());
      setMessage(`Added verifier ${newVerifier.trim()}.`);
      setNewVerifier("");
      await loadAdminData();
      onAction();
    } catch (err) {
      setError(err.message || "Failed to add verifier.");
    }
  }

  async function handleRemoveVerifier(address) {
    try {
      await removeVerifier(address);
      setMessage(`Removed verifier ${address}.`);
      await loadAdminData();
      onAction();
    } catch (err) {
      setError(err.message || "Failed to remove verifier.");
    }
  }

  return (
    <section className="panel panel-wide admin-panel">
      <div className="panel-header">
        <p className="eyebrow">Verifier</p>
        <h2>Review & Governance</h2>
        <p className="muted">Approve, reject, and manage verifier access from the on-chain registry.</p>
      </div>

      {loading ? <p className="muted">Loading verifier dashboard...</p> : null}
      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      <div className="admin-section-grid">
        <div className="section-card">
          <h3>Pending Applications</h3>
          {pendingApplications.length === 0 ? (
            <p className="muted">No pending applications right now.</p>
          ) : (
            <div className="admin-list">
              {pendingApplications.map((candidate) => (
                <article key={candidate.wallet} className="admin-card">
                  <div className="admin-card-content">
                    <strong>{candidate.fullName}</strong>
                    <p>{candidate.wallet}</p>
                    <p>Status: {getStatusLabel(candidate.status)}</p>
                    <p>Document: {candidate.documentType}</p>
                    <p>Submitted: {formatTimestamp(candidate.submittedAt)}</p>
                    <p className="hash-wrap">CID: {candidate.ipfsCID}</p>
                  </div>

                  <div className="admin-actions">
                    <textarea
                      placeholder="Reviewer note"
                      rows="2"
                      value={noteMap[candidate.wallet] || ""}
                      onChange={(event) =>
                        setNoteMap((current) => ({
                          ...current,
                          [candidate.wallet]: event.target.value
                        }))
                      }
                    />
                    <textarea
                      placeholder="Reason if rejecting"
                      rows="2"
                      value={reasonMap[candidate.wallet] || ""}
                      onChange={(event) =>
                        setReasonMap((current) => ({
                          ...current,
                          [candidate.wallet]: event.target.value
                        }))
                      }
                    />
                    <button className="primary-button" onClick={() => handleApprove(candidate.wallet)}>
                      Approve
                    </button>
                    <button className="secondary-button" onClick={() => handleReject(candidate.wallet)}>
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <h3>Verifier Directory</h3>
          <div className="verifier-list">
            {verifiers.map((address) => (
              <div key={address} className="verifier-row">
                <span className="hash-wrap">{address}</span>
                {canManageVerifiers ? (
                  <button className="secondary-button" onClick={() => handleRemoveVerifier(address)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {canManageVerifiers ? (
            <form className="form-stack verifier-form" onSubmit={handleAddVerifier}>
              <label>
                <span>Add verifier wallet</span>
                <input
                  value={newVerifier}
                  onChange={(event) => setNewVerifier(event.target.value)}
                  placeholder="0x..."
                />
              </label>
              <button className="primary-button" type="submit">
                Add Verifier
              </button>
            </form>
          ) : (
            <p className="muted">Only admin wallets can add or remove verifiers.</p>
          )}
        </div>
      </div>
    </section>
  );
}
