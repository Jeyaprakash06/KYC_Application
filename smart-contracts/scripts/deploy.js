const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("KYCRegistry");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("KYCRegistry deployed to:", address);

  const artifact = await hre.artifacts.readArtifact("KYCRegistry");
  const payload = {
    address,
    abi: artifact.abi,
    network: hre.network.name
  };

  const targetPath = path.resolve(
    __dirname,
    "../../frontend/src/utils/KYCRegistry.json"
  );

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));

  console.log("Saved ABI and address to:", targetPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
