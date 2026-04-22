import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

const DOCTOR_ADDR = process.env.DOCTOR_ADDR;
const NURSE_ADDR = process.env.NURSE_ADDR;
const PATIENT_ADDR = process.env.PATIENT_ADDR;

const PATIENT_ID = Number(process.env.PATIENT_ID ?? "1");

// Minimal ABI
const ABI = [
  "function assignRole(address user, uint8 role)",
  "function linkPatient(uint256 patientId, address patient)",
  "function roles(address) view returns (uint8)",
  "function patientOwner(uint256) view returns (address)"
];

// Role enum: NONE=0 PATIENT=1 NURSE=2 DOCTOR=3 ADMIN=4

function must(v, name) {
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

async function main() {
  must(RPC_URL, "RPC_URL");
  must(CONTRACT_ADDRESS, "CONTRACT_ADDRESS");
  must(ADMIN_PRIVATE_KEY, "ADMIN_PRIVATE_KEY");
  must(DOCTOR_ADDR, "DOCTOR_ADDR");
  must(NURSE_ADDR, "NURSE_ADDR");
  must(PATIENT_ADDR, "PATIENT_ADDR");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const admin = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, admin);

  console.log("Admin:", admin.address);
  console.log("Contract:", CONTRACT_ADDRESS);

  const bal = await provider.getBalance(admin.address);
  console.log("Admin balance (ETH):", ethers.formatEther(bal));

  // Always use the pending nonce to avoid the nonce error you hit earlier
  let nonce = await provider.getTransactionCount(admin.address, "pending");

  console.log("Assign DOCTOR role...");
  await (await c.assignRole(DOCTOR_ADDR, 3, { nonce: nonce++ })).wait();

  console.log("Assign NURSE role...");
  await (await c.assignRole(NURSE_ADDR, 2, { nonce: nonce++ })).wait();

  console.log("Link patientId -> patient wallet (also sets PATIENT role)...");
  await (await c.linkPatient(PATIENT_ID, PATIENT_ADDR, { nonce: nonce++ })).wait();

  console.log("\nVerify:");
  console.log("DOCTOR role:", Number(await c.roles(DOCTOR_ADDR)));   // expect 3
  console.log("NURSE role :", Number(await c.roles(NURSE_ADDR)));    // expect 2
  console.log("PATIENT role:", Number(await c.roles(PATIENT_ADDR))); // expect 1
  console.log(`patientOwner(${PATIENT_ID}):`, await c.patientOwner(PATIENT_ID)); // expect patient addr

  console.log("\nDone ✅");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});