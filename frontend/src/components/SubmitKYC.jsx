import { useState } from "react";
import { submitKYC, uploadDocument } from "../utils/blockchain";

const INITIAL_FORM = {
  fullName: "",
  email: "",
  dateOfBirth: "",
  residentialAddress: "",
  documentType: "Passport",
  file: null
};

export default function SubmitKYC({ wallet, onSubmitted }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
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
    setError("");

    if (!wallet) {
      setError("Connect MetaMask before submitting KYC.");
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

      await submitKYC({
        fullName: form.fullName,
        email: form.email,
        dateOfBirth: form.dateOfBirth,
        residentialAddress: form.residentialAddress,
        documentType: form.documentType,
        ipfsCID: cid
      });

      setMessage(`Application submitted successfully. IPFS CID: ${cid}`);
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
        <p className="eyebrow">Applicant</p>
        <h2>Submit KYC</h2>
        <p className="muted">Create or resubmit your KYC application with your latest documents.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          <span>Full name</span>
          <input name="fullName" value={form.fullName} onChange={updateField} required />
        </label>

        <label>
          <span>Email</span>
          <input name="email" type="email" value={form.email} onChange={updateField} required />
        </label>

        <label>
          <span>Date of birth</span>
          <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={updateField} required />
        </label>

        <label>
          <span>Residential address</span>
          <textarea
            name="residentialAddress"
            value={form.residentialAddress}
            onChange={updateField}
            rows="3"
            required
          />
        </label>

        <label>
          <span>Document type</span>
          <select name="documentType" value={form.documentType} onChange={updateField}>
            <option>Passport</option>
            <option>Driver License</option>
            <option>National ID</option>
            <option>Utility Bill</option>
          </select>
        </label>

        <label>
          <span>Document upload</span>
          <input name="file" type="file" accept=".pdf,image/*" onChange={updateField} required />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Application"}
        </button>
      </form>

      {message ? <div className="banner success">{message}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}
    </section>
  );
}
