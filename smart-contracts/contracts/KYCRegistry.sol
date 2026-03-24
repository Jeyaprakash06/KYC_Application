// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract KYCRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum Status {
        None,
        Pending,
        Verified,
        Rejected
    }

    struct KYCRecord {
        string fullName;
        string email;
        string dateOfBirth;
        string residentialAddress;
        string documentType;
        string ipfsCID;
        string rejectionReason;
        string reviewerNote;
        uint64 submittedAt;
        uint64 reviewedAt;
        bytes32 statusHash;
        Status status;
        address reviewer;
        bool exists;
    }

    mapping(address => KYCRecord) private records;
    mapping(address => KYCRecord[]) private recordHistory;
    mapping(address => uint256) private verifierIndexPlusOne;

    address[] private applicants;
    address[] private verifiers;

    uint256 public totalSubmissions;
    uint256 public pendingCount;
    uint256 public verifiedCount;
    uint256 public rejectedCount;

    event KYCSubmitted(address indexed user, string ipfsCID, bytes32 statusHash);
    event KYCVerified(address indexed user, address indexed verifier, bytes32 statusHash);
    event KYCRejected(
        address indexed user,
        address indexed verifier,
        string reason,
        bytes32 statusHash
    );
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    constructor(address initialVerifier) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _addVerifier(msg.sender);

        if (initialVerifier != address(0) && initialVerifier != msg.sender) {
            _addVerifier(initialVerifier);
        }
    }

    function submitKYC(
        string calldata fullName,
        string calldata email,
        string calldata dateOfBirth,
        string calldata residentialAddress,
        string calldata documentType,
        string calldata ipfsCID
    ) external {
        require(bytes(fullName).length > 0, "Full name is required");
        require(bytes(email).length > 0, "Email is required");
        require(bytes(dateOfBirth).length > 0, "Date of birth is required");
        require(bytes(residentialAddress).length > 0, "Residential address is required");
        require(bytes(documentType).length > 0, "Document type is required");
        require(bytes(ipfsCID).length > 0, "IPFS CID is required");
        require(!hasRole(VERIFIER_ROLE, msg.sender), "Verifiers cannot submit applications");

        KYCRecord storage record = records[msg.sender];

        totalSubmissions += 1;

        if (!record.exists) {
            applicants.push(msg.sender);
        } else {
            _decrementStatusCount(record.status);
        }

        record.fullName = fullName;
        record.email = email;
        record.dateOfBirth = dateOfBirth;
        record.residentialAddress = residentialAddress;
        record.documentType = documentType;
        record.ipfsCID = ipfsCID;
        record.rejectionReason = "";
        record.reviewerNote = "";
        record.submittedAt = uint64(block.timestamp);
        record.reviewedAt = 0;
        record.status = Status.Pending;
        record.reviewer = address(0);
        record.exists = true;
        record.statusHash = _computeStatusHash(msg.sender, Status.Pending, ipfsCID, "");

        pendingCount += 1;

        emit KYCSubmitted(msg.sender, ipfsCID, record.statusHash);
        _syncHistoryEntry(msg.sender, record);
    }

    function verifyUser(address user, string calldata reviewerNote) external onlyRole(VERIFIER_ROLE) {
        KYCRecord storage record = _requirePendingRecord(user);

        _decrementStatusCount(record.status);

        record.status = Status.Verified;
        record.reviewedAt = uint64(block.timestamp);
        record.rejectionReason = "";
        record.reviewerNote = reviewerNote;
        record.reviewer = msg.sender;
        record.statusHash = _computeStatusHash(user, record.status, record.ipfsCID, reviewerNote);

        verifiedCount += 1;

        emit KYCVerified(user, msg.sender, record.statusHash);
        _syncHistoryEntry(user, record);
    }

    function rejectUser(
        address user,
        string calldata reason,
        string calldata reviewerNote
    ) external onlyRole(VERIFIER_ROLE) {
        require(bytes(reason).length > 0, "Reason is required");

        KYCRecord storage record = _requirePendingRecord(user);

        _decrementStatusCount(record.status);

        record.status = Status.Rejected;
        record.reviewedAt = uint64(block.timestamp);
        record.rejectionReason = reason;
        record.reviewerNote = reviewerNote;
        record.reviewer = msg.sender;
        record.statusHash = _computeStatusHash(user, record.status, record.ipfsCID, reason);

        rejectedCount += 1;

        emit KYCRejected(user, msg.sender, reason, record.statusHash);
        _syncHistoryEntry(user, record);
    }

    function checkStatus(address user) external view returns (Status) {
        return records[user].status;
    }

    function isVerified(address user) external view returns (bool) {
        return records[user].status == Status.Verified;
    }

    function getMyRecord() external view returns (KYCRecord memory) {
        require(records[msg.sender].exists, "Record does not exist");
        return records[msg.sender];
    }

    function getRecord(address user)
        external
        view
        onlyRole(VERIFIER_ROLE)
        returns (KYCRecord memory)
    {
        require(records[user].exists, "Record does not exist");
        return records[user];
    }

    function getMyRecordHistory() external view returns (KYCRecord[] memory) {
        return recordHistory[msg.sender];
    }

    function getRecordHistory(address user)
        external
        view
        onlyRole(VERIFIER_ROLE)
        returns (KYCRecord[] memory)
    {
        return recordHistory[user];
    }

    function getPendingApplicants() external view onlyRole(VERIFIER_ROLE) returns (address[] memory) {
        uint256 count;

        for (uint256 i = 0; i < applicants.length; i++) {
            if (records[applicants[i]].status == Status.Pending) {
                count += 1;
            }
        }

        address[] memory pendingApplicants = new address[](count);
        uint256 index;

        for (uint256 i = 0; i < applicants.length; i++) {
            address applicant = applicants[i];
            if (records[applicant].status == Status.Pending) {
                pendingApplicants[index] = applicant;
                index += 1;
            }
        }

        return pendingApplicants;
    }

    function getApplicantAddresses() external view onlyRole(VERIFIER_ROLE) returns (address[] memory) {
        return applicants;
    }

    function getVerifierAddresses() external view returns (address[] memory) {
        return verifiers;
    }

    function getDashboardStats()
        external
        view
        returns (
            uint256 submissions,
            uint256 pending,
            uint256 verified,
            uint256 rejected,
            uint256 verifierTotal
        )
    {
        return (totalSubmissions, pendingCount, verifiedCount, rejectedCount, verifiers.length);
    }

    function addVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(verifier != address(0), "Invalid verifier");
        require(!hasRole(VERIFIER_ROLE, verifier), "Already a verifier");
        _addVerifier(verifier);
    }

    function removeVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(verifier != address(0), "Invalid verifier");
        require(verifier != msg.sender, "Admin cannot remove self");
        require(hasRole(VERIFIER_ROLE, verifier), "Not a verifier");

        _revokeRole(VERIFIER_ROLE, verifier);
        _removeVerifierFromList(verifier);

        emit VerifierRemoved(verifier);
    }

    function hasVerifierRole(address account) external view returns (bool) {
        return hasRole(VERIFIER_ROLE, account);
    }

    function hasAdminRole(address account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function getStatusHash(address user) external view returns (bytes32) {
        require(records[user].exists, "Record does not exist");
        return records[user].statusHash;
    }

    function getApplicantCount() external view returns (uint256) {
        return applicants.length;
    }

    function _requirePendingRecord(address user) internal view returns (KYCRecord storage record) {
        record = records[user];
        require(record.exists, "Record does not exist");
        require(record.status == Status.Pending, "Record is not pending");
    }

    function _addVerifier(address verifier) internal {
        _grantRole(VERIFIER_ROLE, verifier);
        verifiers.push(verifier);
        verifierIndexPlusOne[verifier] = verifiers.length;
        emit VerifierAdded(verifier);
    }

    function _removeVerifierFromList(address verifier) internal {
        uint256 indexPlusOne = verifierIndexPlusOne[verifier];
        require(indexPlusOne != 0, "Verifier not indexed");

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = verifiers.length - 1;

        if (index != lastIndex) {
            address lastVerifier = verifiers[lastIndex];
            verifiers[index] = lastVerifier;
            verifierIndexPlusOne[lastVerifier] = index + 1;
        }

        verifiers.pop();
        delete verifierIndexPlusOne[verifier];
    }

    function _decrementStatusCount(Status status) internal {
        if (status == Status.Pending && pendingCount > 0) {
            pendingCount -= 1;
        } else if (status == Status.Verified && verifiedCount > 0) {
            verifiedCount -= 1;
        } else if (status == Status.Rejected && rejectedCount > 0) {
            rejectedCount -= 1;
        }
    }

    function _syncHistoryEntry(address user, KYCRecord storage record) internal {
        KYCRecord[] storage history = recordHistory[user];

        if (history.length == 0 || history[history.length - 1].submittedAt != record.submittedAt) {
            history.push();
        }

        KYCRecord storage snapshot = history[history.length - 1];
        snapshot.fullName = record.fullName;
        snapshot.email = record.email;
        snapshot.dateOfBirth = record.dateOfBirth;
        snapshot.residentialAddress = record.residentialAddress;
        snapshot.documentType = record.documentType;
        snapshot.ipfsCID = record.ipfsCID;
        snapshot.rejectionReason = record.rejectionReason;
        snapshot.reviewerNote = record.reviewerNote;
        snapshot.submittedAt = record.submittedAt;
        snapshot.reviewedAt = record.reviewedAt;
        snapshot.statusHash = record.statusHash;
        snapshot.status = record.status;
        snapshot.reviewer = record.reviewer;
        snapshot.exists = record.exists;
    }

    function _computeStatusHash(
        address user,
        Status status,
        string memory ipfsCID,
        string memory note
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(user, uint8(status), ipfsCID, note, block.chainid));
    }
}

