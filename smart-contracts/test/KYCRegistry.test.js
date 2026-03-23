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
    expect(record.status).to.equal(1);

    const stats = await registry.getDashboardStats();
    expect(stats[0]).to.equal(1);
    expect(stats[1]).to.equal(1);
    expect(stats[2]).to.equal(0);
    expect(stats[3]).to.equal(0);
  });

  it("rejects incomplete submissions", async function () {
    const { registry, user } = await deployFixture();

    await expect(
      registry.connect(user).submitKYC(
        "",
        "alice@example.com",
        "1997-01-12",
        "221B Baker Street",
        "Passport",
        "bafy123"
      )
    ).to.be.revertedWith("Full name is required");
  });

  it("allows verifier to approve a pending user with a note", async function () {
    const { registry, user, verifier } = await deployFixture();
    await submitDefault(registry, user);

    await registry.connect(verifier).verifyUser(user.address, "Documents match the supplied wallet.");

    const record = await registry.connect(verifier).getRecord(user.address);
    expect(record.status).to.equal(2);
    expect(record.reviewer).to.equal(verifier.address);
    expect(record.reviewerNote).to.equal("Documents match the supplied wallet.");
    expect(await registry.isVerified(user.address)).to.equal(true);

    const stats = await registry.getDashboardStats();
    expect(stats[1]).to.equal(0);
    expect(stats[2]).to.equal(1);
  });

  it("allows verifier to reject a pending user with a reason and reviewer note", async function () {
    const { registry, user, verifier } = await deployFixture();
    await submitDefault(registry, user);

    await registry
      .connect(verifier)
      .rejectUser(user.address, "Name mismatch on uploaded document", "Please resubmit with matching ID.");

    const record = await registry.connect(verifier).getRecord(user.address);
    expect(record.status).to.equal(3);
    expect(record.rejectionReason).to.equal("Name mismatch on uploaded document");
    expect(record.reviewerNote).to.equal("Please resubmit with matching ID.");

    const stats = await registry.getDashboardStats();
    expect(stats[1]).to.equal(0);
    expect(stats[3]).to.equal(1);
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
    expect(record.status).to.equal(1);
    expect(record.documentType).to.equal("National ID");
    expect(record.rejectionReason).to.equal("");

    const stats = await registry.getDashboardStats();
    expect(stats[0]).to.equal(1);
    expect(stats[1]).to.equal(1);
    expect(stats[3]).to.equal(0);
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

    await expect(registry.connect(other).verifyUser(user.address, "ok")).to.be.reverted;
    await expect(registry.connect(other).getRecord(user.address)).to.be.reverted;
  });

  it("allows admin to add and remove verifiers", async function () {
    const { registry, other } = await deployFixture();

    await registry.addVerifier(other.address);
    expect(await registry.hasVerifierRole(other.address)).to.equal(true);

    await registry.removeVerifier(other.address);
    expect(await registry.hasVerifierRole(other.address)).to.equal(false);
  });
});
