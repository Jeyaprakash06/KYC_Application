import { useState } from "react";
import { getExplorerTxUrl, submitKYC, uploadDocument } from "../utils/blockchain";

const INITIAL_FORM = {
  fullName: "",
  email: "",
  dateOfBirth: "",
  residentialAddress: "",
  documentType: "Passport",
  file: null
};

export default function SubmitKYC({ wallet, isVerifier, onSubmitted }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [txInfo, setTxInfo] = useState(null);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value, files } = event.target;
    setForm((current) => ({
      ...current,
      [name]: files ? files[0] : value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setTxInfo(null);
    setError("");

    if (!wallet) {
      setError("Connect MetaMask before submitting KYC.");
      return;
    }

    if (isVerifier) {
      setError("Verifier wallets cannot submit KYC applications.");
      return;
    }

    if (!form.file) {
      setError("Upload a supporting KYC document before submitting.");
      return;
    }

    try {
      setLoading(true);
      const cid = await uploadDocument(form.file, {
        fullName: form.fullName,
        email: form.email,
        dateOfBirth: form.dateOfBirth,
        residentialAddress: form.residentialAddress,
        documentType: form.documentType,
        wallet
      });

      const tx = await submitKYC({
        fullName: form.fullName,
        email: form.email,
        dateOfBirth: form.dateOfBirth,
        residentialAddress: form.residentialAddress,
        documentType: form.documentType,
        ipfsCID: cid
      });

      setMessage("Saved on-chain.");
      setTxInfo({
        ...tx,
        explorerUrl: getExplorerTxUrl(tx.hash),
        cid
      });
      setForm(INITIAL_FORM);
      onSubmitted();
    } catch (err) {
      setError(err.message || "Failed to submit KYC.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Submit</h2>
      </div>

      {isVerifier ? (
        <div className="banner error">
          This wallet is registered as a verifier, so the applicant submission form is locked.
        </div>
      ) : null}

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          <span>Full name</span>
          <input name="fullName" value={form.fullName} onChange={updateField} required disabled={isVerifier} />
        </label>

        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            required
            disabled={isVerifier}
          />
        </label>

        <label>
          <span>Date of birth</span>
          <input
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={updateField}
            required
            disabled={isVerifier}
          />
        </label>

        <label>
          <span>Residential address</span>
          <textarea
            name="residentialAddress"
            value={form.residentialAddress}
            onChange={updateField}
            rows="3"
            required
            disabled={isVerifier}
          />
        </label>

        <label>
          <span>Document type</span>
          <select name="documentType" value={form.documentType} onChange={updateField} disabled={isVerifier}>
            <option>Passport</option>
            <option>Driver License</option>
            <option>National ID</option>
            <option>Utility Bill</option>
          </select>
        </label>

        <label>
          <span>Document upload</span>
          <input
            name="file"
            type="file"
            accept=".pdf,image/*"
            onChange={updateField}
            required
            disabled={isVerifier}
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading || isVerifier}>
          {loading ? "Submitting..." : "Submit Application"}
        </button>
      </form>

      {message ? <div className="banner success">{message}</div> : null}
      {txInfo ? (
        <div className="proof-card">
          <div>
            <span>transaction</span>
            <strong className="hash-wrap">{txInfo.hash}</strong>
          </div>
          <div>
            <span>block</span>
            <strong>{txInfo.blockNumber || "pending"}</strong>
          </div>
          <div>
            <span>document cid</span>
            <strong className="hash-wrap">{txInfo.cid}</strong>
          </div>
          {txInfo.explorerUrl ? (
            <a className="proof-link" href={txInfo.explorerUrl} target="_blank" rel="noreferrer">
              view on etherscan
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? <div className="banner error">{error}</div> : null}
    </section>
  );
}
