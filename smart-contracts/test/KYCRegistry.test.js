const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KYCRegistry", function () {
  async function deployFixture() {
    const [owner, user, verifier, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("KYCRegistry");
    const registry = await Factory.deploy(verifier.address);
    await registry.waitForDeployment();
    return { registry, owner, user, verifier, other };
  }

  async function submitDefault(registry, signer) {
    await registry.connect(signer).submitKYC(
      "Alice Johnson",
      "alice@example.com",
      "1997-01-12",
      "221B Baker Street",
      "Passport",
      "bafy123"
    );
  }

  async function expectRevert(promise, expectedMessage) {
    try {
      await promise;
      expect.fail("Expected transaction to revert");
    } catch (error) {
      const message = error?.message || "";
      if (expectedMessage) {
        expect(message).to.include(expectedMessage);
      } else {
        expect(message.toLowerCase()).to.include("revert");
      }
    }
  }

  it("assigns admin and verifier roles on deployment", async function () {
    const { registry, owner, verifier } = await deployFixture();

    expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
    expect(await registry.hasVerifierRole(owner.address)).to.equal(true);
    expect(await registry.hasVerifierRole(verifier.address)).to.equal(true);

    const verifiers = await registry.getVerifierAddresses();
    expect(verifiers).to.have.length(2);
  });

  it("accepts a complete KYC submission and tracks pending stats", async function () {
    const { registry, user } = await deployFixture();
    await submitDefault(registry, user);

    const record = await registry.connect(user).getMyRecord();
    expect(record.fullName).to.equal("Alice Johnson");
    expect(record.documentType).to.equal("Passport");
    expect(record.status).to.equal(1n);

    const stats = await registry.getDashboardStats();
    expect(stats[0]).to.equal(1n);
    expect(stats[1]).to.equal(1n);
    expect(stats[2]).to.equal(0n);
    expect(stats[3]).to.equal(0n);
  });

  it("rejects incomplete submissions", async function () {
    const { registry, user } = await deployFixture();

    await expectRevert(
      registry.connect(user).submitKYC(
        "",
        "alice@example.com",
        "1997-01-12",
        "221B Baker Street",
        "Passport",
        "bafy123"
      ),
      "Full name is required"
    );
  });

  it("allows verifier to approve a pending user with a note", async function () {
    const { registry, user, verifier } = await deployFixture();
    await submitDefault(registry, user);

    await registry.connect(verifier).verifyUser(user.address, "Documents match the supplied wallet.");

    const record = await registry.connect(verifier).getRecord(user.address);
    expect(record.status).to.equal(2n);
    expect(record.reviewer).to.equal(verifier.address);
    expect(record.reviewerNote).to.equal("Documents match the supplied wallet.");
    expect(await registry.isVerified(user.address)).to.equal(true);

    const stats = await registry.getDashboardStats();
    expect(stats[1]).to.equal(0n);
    expect(stats[2]).to.equal(1n);
  });

  it("allows verifier to reject a pending user with a reason and reviewer note", async function () {
    const { registry, user, verifier } = await deployFixture();
    await submitDefault(registry, user);

    await registry
      .connect(verifier)
      .rejectUser(user.address, "Name mismatch on uploaded document", "Please resubmit with matching ID.");

    const record = await registry.connect(verifier).getRecord(user.address);
    expect(record.status).to.equal(3n);
    expect(record.rejectionReason).to.equal("Name mismatch on uploaded document");
    expect(record.reviewerNote).to.equal("Please resubmit with matching ID.");

    const stats = await registry.getDashboardStats();
    expect(stats[1]).to.equal(0n);
    expect(stats[3]).to.equal(1n);
  });

  it("supports resubmission after rejection and resets back to pending", async function () {
    const { registry, user, verifier } = await deployFixture();
    await submitDefault(registry, user);
    await registry.connect(verifier).rejectUser(user.address, "Blurry scan", "Upload a clearer document.");

    await registry.connect(user).submitKYC(
      "Alice Johnson",
      "alice@example.com",
      "1997-01-12",
      "221B Baker Street",
      "National ID",
      "bafy999"
    );

    const record = await registry.connect(user).getMyRecord();
    expect(record.status).to.equal(1n);
    expect(record.documentType).to.equal("National ID");
    expect(record.rejectionReason).to.equal("");

    const stats = await registry.getDashboardStats();
    expect(stats[0]).to.equal(2n);
    expect(stats[1]).to.equal(1n);
    expect(stats[3]).to.equal(0n);
  });

  it("preserves a per-wallet history across submissions and reviews", async function () {
    const { registry, user, verifier } = await deployFixture();
    await submitDefault(registry, user);
    await registry.connect(verifier).verifyUser(user.address, "First submission approved.");

    await registry.connect(user).submitKYC(
      "Alice Johnson",
      "alice@example.com",
      "1997-01-12",
      "221B Baker Street",
      "National ID",
      "bafy999"
    );
    await registry.connect(verifier).rejectUser(user.address, "Address mismatch", "Use your latest address.");

    const history = await registry.connect(user).getMyRecordHistory();
    expect(history).to.have.length(2);

    expect(history[0].documentType).to.equal("Passport");
    expect(history[0].status).to.equal(2n);
    expect(history[0].reviewerNote).to.equal("First submission approved.");

    expect(history[1].documentType).to.equal("National ID");
    expect(history[1].status).to.equal(3n);
    expect(history[1].rejectionReason).to.equal("Address mismatch");

    const verifierHistory = await registry.connect(verifier).getRecordHistory(user.address);
    expect(verifierHistory).to.have.length(2);
  });

  it("returns pending applicants to verifiers", async function () {
    const { registry, user, other } = await deployFixture();
    await submitDefault(registry, user);
    await registry.connect(other).submitKYC(
      "Bob Smith",
      "bob@example.com",
      "1991-04-03",
      "742 Evergreen Terrace",
      "Driver License",
      "bafy456"
    );

    const pending = await registry.getPendingApplicants();
    expect(pending).to.have.length(2);
    expect(pending).to.include(user.address);
    expect(pending).to.include(other.address);
  });

  it("prevents non-verifiers from reviewing or reading protected records", async function () {
    const { registry, user, other } = await deployFixture();
    await submitDefault(registry, user);

    await expectRevert(registry.connect(other).verifyUser(user.address, "ok"));
    await expectRevert(registry.connect(other).getRecord(user.address));
  });

  it("prevents verifier wallets from submitting applications", async function () {
    const { registry, verifier } = await deployFixture();

    await expectRevert(
      registry.connect(verifier).submitKYC(
        "Verifier User",
        "verifier@example.com",
        "1990-01-01",
        "Compliance Desk",
        "Passport",
        "bafy-verifier"
      ),
      "Verifiers cannot submit applications"
    );
  });

  it("allows admin to add and remove verifiers", async function () {
    const { registry, other } = await deployFixture();

    await registry.addVerifier(other.address);
    expect(await registry.hasVerifierRole(other.address)).to.equal(true);

    await registry.removeVerifier(other.address);
    expect(await registry.hasVerifierRole(other.address)).to.equal(false);
  });
});
