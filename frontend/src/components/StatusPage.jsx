import { useEffect, useState } from "react";
import {
  formatTimestamp,
  getContractInfo,
  getExplorerAddressUrl,
  getMyRecord,
  getMyRecordHistory,
  getStatusLabel
} from "../utils/blockchain";

export default function StatusPage({ wallet }) {
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const contract = getContractInfo();
  const contractUrl = getExplorerAddressUrl(contract.address);
  const previousHistory = history.length > 1 ? history.slice(0, -1).reverse() : [];
  const rejectionCount = history.filter((entry) => Number(entry.status) === 3).length;

  useEffect(() => {
    async function loadRecord() {
      if (!wallet) {
        setRecord(null);
        setHistory([]);
        setError("");
        setEmpty(false);
        return;
      }

      try {
        setLoading(true);
        const [result, historyResult] = await Promise.all([getMyRecord(), getMyRecordHistory()]);
        setRecord(result);
        setHistory(historyResult);
        setError("");
        setEmpty(false);
      } catch (err) {
        setRecord(null);
        setHistory([]);
        const message = err?.message || "";
        if (message.includes("Record does not exist")) {
          setEmpty(true);
          setError("");
        } else {
          setEmpty(false);
          setError("Unable to load your status.");
        }
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
        <h2>Status</h2>
      </div>

      {!wallet ? <p className="muted">Connect your wallet.</p> : null}
      {loading ? <p className="muted">Loading...</p> : null}
      {empty ? <p className="muted">No submission yet.</p> : null}

      {record ? (
        <div className="status-stack">
          <div className={`status-pill status-${status}`}>{getStatusLabel(status)}</div>

          <div className="proof-card compact-proof">
            <div>
              <span>network</span>
              <strong>{contract.network || "unknown"}</strong>
            </div>
            <div>
              <span>contract</span>
              <strong className="hash-wrap">{contract.address || "not deployed"}</strong>
            </div>
            <div>
              <span>status hash</span>
              <strong className="hash-wrap">{record.statusHash}</strong>
            </div>
            <div>
              <span>rejections</span>
              <strong>{rejectionCount}</strong>
            </div>
            {contractUrl ? (
              <a className="proof-link" href={contractUrl} target="_blank" rel="noreferrer">
                view contract
              </a>
            ) : null}
          </div>

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

          <div className="history-section">
            <h3>Submission History</h3>
            {history.length <= 1 ? (
              <p className="muted">Your future resubmissions will appear here.</p>
            ) : (
              <div className="history-list">
                <article className="history-card history-card-current">
                  <div className="history-card-header">
                    <div>
                      <span className="history-label">Current record</span>
                      <strong>{record.documentType}</strong>
                    </div>
                    <span className={`status-pill status-${record.status}`}>
                      {getStatusLabel(record.status)}
                    </span>
                  </div>
                  <dl className="detail-grid history-grid">
                    <RecordItem label="Submitted" value={formatTimestamp(record.submittedAt)} />
                    <RecordItem label="Reviewed" value={formatTimestamp(record.reviewedAt)} />
                    <RecordItem label="Document CID" value={record.ipfsCID} className="hash-wrap" />
                    <RecordItem label="Reviewer" value={record.reviewer || "Not reviewed yet"} className="hash-wrap" />
                    <RecordItem label="Reviewer note" value={record.reviewerNote || "No reviewer note yet"} />
                    {record.rejectionReason ? (
                      <RecordItem label="Rejection reason" value={record.rejectionReason} />
                    ) : null}
                  </dl>
                </article>

                {previousHistory.map((entry, index) => (
                    <article className="history-card" key={`${entry.submittedAt}-${index}`}>
                      <div className="history-card-header">
                        <div>
                          <span className="history-label">Past submission #{previousHistory.length - index}</span>
                          <strong>{entry.documentType}</strong>
                        </div>
                        <span className={`status-pill status-${entry.status}`}>
                          {getStatusLabel(entry.status)}
                        </span>
                      </div>
                      <dl className="detail-grid history-grid">
                        <RecordItem label="Submitted" value={formatTimestamp(entry.submittedAt)} />
                        <RecordItem label="Reviewed" value={formatTimestamp(entry.reviewedAt)} />
                        <RecordItem label="Document CID" value={entry.ipfsCID} className="hash-wrap" />
                        <RecordItem
                          label="Reviewer"
                          value={entry.reviewer || "Not reviewed yet"}
                          className="hash-wrap"
                        />
                        <RecordItem
                          label="Reviewer note"
                          value={entry.reviewerNote || "No reviewer note yet"}
                        />
                        {entry.rejectionReason ? (
                          <RecordItem label="Rejection reason" value={entry.rejectionReason} />
                        ) : null}
                      </dl>
                    </article>
                  ))}
              </div>
            )}
          </div>
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
