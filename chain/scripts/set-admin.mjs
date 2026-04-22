import { ethers } from "ethers";

const RPC_URL = "http://127.0.0.1:7545";
const CONTRACT_ADDRESS = "0xB55971d48a40F3789A70384AA400dDBB94a5530A";
const ADMIN_PRIVATE_KEY = "0xed37cf26b40ea38fece365574bc5086ac666e3a20b1b5b0432f091892000f88d";

const ABI = [
  "function setInitialAdmin(address admin)",
  "function roles(address) view returns (uint8)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const admin = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, admin);

  const pendingNonce = await provider.getTransactionCount(admin.address, "pending");
  console.log("Admin:", admin.address);
  console.log("Pending nonce:", pendingNonce);

  const tx = await c.setInitialAdmin(admin.address, { nonce: pendingNonce });
  console.log("Tx:", tx.hash);
  await tx.wait();

  const r = await c.roles(admin.address);
  console.log("Admin role (expect 4):", Number(r));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});