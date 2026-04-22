import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const RPC_URL = "http://127.0.0.1:7545";
const PRIVATE_KEY = "0xed37cf26b40ea38fece365574bc5086ac666e3a20b1b5b0432f091892000f88d"; // keep only on your PC

const artifactPath = path.join(
  process.cwd(),
  "artifacts",
  "contracts",
  "HealthChain.sol",
  "HealthChain.json"
);

async function main() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);

  const bal = await provider.getBalance(wallet.address);
  console.log("Balance (ETH):", ethers.formatEther(bal));

  // Always use the PENDING nonce to avoid Ganache mismatch
  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log("Starting nonce (pending):", nonce);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const contract = await factory.deploy({ nonce: nonce++ });
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("Contract deployed to:", addr);

  const tx = await contract.setInitialAdmin(wallet.address, { nonce: nonce++ });
  console.log("setInitialAdmin tx:", tx.hash);
  await tx.wait();

  console.log("Initial admin set:", wallet.address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});