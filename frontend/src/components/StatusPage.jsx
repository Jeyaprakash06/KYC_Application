import { useEffect, useState } from "react";
import { formatTimestamp, getMyRecord, getStatusLabel } from "../utils/blockchain";

export default function StatusPage({ wallet }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRecord() {
      if (!wallet) {
        setRecord(null);
        setError("");
        return;
      }

      try {
        setLoading(true);
        const result = await getMyRecord();
        setRecord(result);
        setError("");
      } catch (err) {
        setRecord(null);
        setError(err.message || "Unable to fetch your KYC record.");
      } finally {
        setLoading(false);
      }
    }

    loadRecord();
  }, [wallet]);

  const status = record?.status ?? 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Applicant</p>
        <h2>My KYC Status</h2>
        <p className="muted">Track your latest on-chain review state and document reference.</p>
      </div>

      {!wallet ? <p className="muted">Connect a wallet to load your application status.</p> : null}
      {loading ? <p className="muted">Loading your KYC record...</p> : null}

      {record ? (
        <div className="status-stack">
          <div className={`status-pill status-${status}`}>{getStatusLabel(status)}</div>

          <dl className="detail-grid">
            <RecordItem label="Full name" value={record.fullName} />
            <RecordItem label="Email" value={record.email} />
            <RecordItem label="Date of birth" value={record.dateOfBirth} />
            <RecordItem label="Address" value={record.residentialAddress} />
            <RecordItem label="Document type" value={record.documentType} />
            <RecordItem label="IPFS CID" value={record.ipfsCID} className="hash-wrap" />
            <RecordItem label="Status hash" value={record.statusHash} className="hash-wrap" />
            <RecordItem label="Submitted" value={formatTimestamp(record.submittedAt)} />
            <RecordItem label="Reviewed" value={formatTimestamp(record.reviewedAt)} />
            <RecordItem label="Reviewer" value={record.reviewer || "Not reviewed yet"} className="hash-wrap" />
            <RecordItem label="Reviewer note" value={record.reviewerNote || "No reviewer note yet"} />
            {record.rejectionReason ? <RecordItem label="Rejection reason" value={record.rejectionReason} /> : null}
          </dl>
        </div>
      ) : null}

      {error ? <div className="banner error">{error}</div> : null}
    </section>
  );
}

function RecordItem({ label, value, className = "" }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}
