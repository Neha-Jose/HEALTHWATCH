import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:7545";
const CONTRACT = process.env.CONTRACT_ADDRESS;
const ADMIN_PK = process.env.ADMIN_PK;

// Usage:
// node scripts/unlink-patient.mjs 2
const patientId = Number(process.argv[2]);

if (!CONTRACT) throw new Error("Missing CONTRACT_ADDRESS in chain/.env");
if (!ADMIN_PK) throw new Error("Missing ADMIN_PK in chain/.env");
if (!Number.isInteger(patientId) || patientId <= 0) throw new Error("Usage: node scripts/unlink-patient.mjs <patientId>");

const ABI = [
  "function unlinkPatient(uint256) external",
  "function patientOwner(uint256) view returns (address)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const admin = new ethers.Wallet(ADMIN_PK, provider);
const c = new ethers.Contract(CONTRACT, ABI, admin);

const existing = await c.patientOwner(patientId);
if (existing === ethers.ZeroAddress) {
  console.log(`patientId ${patientId} is not linked`);
  process.exit(0);
}

const tx = await c.unlinkPatient(patientId);
console.log("Tx:", tx.hash);
await tx.wait();

console.log(`Unlinked ✅ patientId ${patientId} (was ${existing})`);