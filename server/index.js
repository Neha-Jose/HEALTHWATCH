import "dotenv/config";
import fs from "fs";
import https from "https";
import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { ethers } from "ethers";
import crypto from "crypto";

/**
 * HealthChain Server
 * - HTTPS + CORS
 * - MetaMask login via signature (nonce)
 * - Encrypted storage (AES-256-GCM)
 * - Role checks on-chain
 * - Admin can link patients on-chain via /admin/link
 * - Doctor can edit diagnosis
 * - Nurse can edit medication
 * - Doctor can also edit medication
 * - Patient can view diagnosis and medication but cannot edit them
 */

// ===== HealthChain ABI for admin actions =====
const HC_ABI = [
  "function linkPatient(uint256 patientId, address patient) external",
  "function patientOwner(uint256) view returns (address)",
  "function roles(address) view returns (uint8)",
];

function getAdminContract() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:7545";
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const adminPk = process.env.ADMIN_PK;

  if (!contractAddress) throw new Error("Missing CONTRACT_ADDRESS");
  if (!adminPk) throw new Error("Missing ADMIN_PK");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const adminWallet = new ethers.Wallet(adminPk, provider);
  return new ethers.Contract(contractAddress, HC_ABI, adminWallet);
}

// ===== ENV / Setup =====
const PORT = Number(process.env.PORT || "8443");
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const TLS_CERT = process.env.TLS_CERT;
const TLS_KEY = process.env.TLS_KEY;

const DATA_KEY = Buffer.from(process.env.DATA_KEY_HEX || "", "hex");

if (!RPC_URL || !CONTRACT_ADDRESS) throw new Error("Missing RPC_URL/CONTRACT_ADDRESS in .env");
if (!TLS_CERT || !TLS_KEY) throw new Error("Missing TLS_CERT/TLS_KEY in .env");
if (DATA_KEY.length !== 32) throw new Error("DATA_KEY_HEX must be 32 bytes (64 hex chars)");

// ===== Crypto helpers (AES-256-GCM) =====
function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", DATA_KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("hex"), tag: tag.toString("hex"), ct: ciphertext.toString("hex") };
}

function decryptJson(payload) {
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const ct = Buffer.from(payload.ct, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", DATA_KEY, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

// ===== On-chain read-only contract (role + patient owner) =====
// Role enum: NONE=0 PATIENT=1 NURSE=2 DOCTOR=3 ADMIN=4
const ABI = [
  "function roles(address) view returns (uint8)",
  "function patientOwner(uint256) view returns (address)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

async function getRole(addr) {
  const r = await contract.roles(addr);
  return Number(r);
}

async function getPatientOwner(patientId) {
  return await contract.patientOwner(patientId);
}

// ===== Login: nonce -> sign -> verify =====
const nonces = new Map();

function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function loginMessage(nonce) {
  return `HealthChain Login\nNonce: ${nonce}`;
}

// ===== DB (encrypted storage) =====
const db = new Database("healthchain.db");
db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  address TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS patient_records (
  patient_id INTEGER PRIMARY KEY,
  owner_address TEXT NOT NULL,
  enc_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

// Requires BOTH headers:
// - Authorization: Bearer <token>
// - X-Address: <wallet address>
function requireAuth(req, res, next) {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  const addr = req.headers["x-address"];
  if (!token || !addr) return res.status(401).json({ error: "Missing auth headers" });

  const norm = String(addr).toLowerCase();
  const row = db.prepare("SELECT token FROM sessions WHERE address=?").get(norm);
  if (!row || row.token !== token) return res.status(401).json({ error: "Invalid session" });

  req.address = norm;
  next();
}

// ===== Express app =====
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --- Auth routes ---
app.get("/auth/nonce/:address", (req, res) => {
  const address = String(req.params.address).toLowerCase();
  const nonce = makeNonce();
  nonces.set(address, nonce);
  res.json({ nonce, message: loginMessage(nonce) });
});

app.post("/auth/verify", async (req, res) => {
  const { address, signature } = req.body || {};
  if (!address || !signature) return res.status(400).json({ error: "address & signature required" });

  const addr = String(address).toLowerCase();
  const nonce = nonces.get(addr);
  if (!nonce) return res.status(400).json({ error: "No nonce. Call /auth/nonce first." });

  const message = loginMessage(nonce);

  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature).toLowerCase();
  } catch {
    return res.status(400).json({ error: "Bad signature format" });
  }

  if (recovered !== addr) return res.status(401).json({ error: "Signature verification failed" });

  const token = makeToken();
  db.prepare("INSERT OR REPLACE INTO sessions(address, token, created_at) VALUES(?,?,?)").run(
    addr,
    token,
    Date.now()
  );

  nonces.delete(addr);

  const role = await getRole(addr);
  res.json({ token, role });
});

// --- Admin: link patient on-chain ---
app.post("/admin/link", requireAuth, async (req, res) => {
  try {
    const addr = req.address;
    const role = await getRole(addr);
    if (role !== 4) return res.status(403).json({ error: "Admin only" });

    const { patientId, patientAddress } = req.body || {};
    const id = Number(patientId);

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Bad patientId" });
    if (!ethers.isAddress(patientAddress)) return res.status(400).json({ error: "Bad patientAddress" });

    const c = getAdminContract();

    const existing = (await c.patientOwner(id)).toLowerCase();
    if (existing !== ethers.ZeroAddress) {
      return res.status(409).json({ error: "Already linked", existing });
    }

    const tx = await c.linkPatient(id, patientAddress);
    const receipt = await tx.wait();

    res.json({ ok: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Link failed" });
  }
});

// --- Patient record write (role-aware edit rules) ---
app.post("/patient/:id", requireAuth, async (req, res) => {
  const patientId = Number(req.params.id);
  const addr = req.address;

  const role = await getRole(addr);
  if (![2, 3, 4].includes(role)) return res.status(403).json({ error: "Not allowed" });

  const owner = (await getPatientOwner(patientId)).toLowerCase();
  if (owner === ethers.ZeroAddress) return res.status(404).json({ error: "patientId not linked on-chain" });

  // Load existing record if available
  const existingRow = db.prepare("SELECT enc_json FROM patient_records WHERE patient_id=?").get(patientId);

  let existing = {
    name: "",
    age: 0,
    heightCm: 0,
    bp: "",
    diagnosis: "",
    medication: "",
  };

  if (existingRow) {
    try {
      existing = decryptJson(JSON.parse(existingRow.enc_json));
    } catch {
      return res.status(500).json({ error: "Stored record could not be decrypted" });
    }
  }

  const body = req.body || {};
  const updated = { ...existing };

  // ADMIN: can edit everything
  if (role === 4) {
    if (typeof body.name === "string" && body.name.trim()) updated.name = body.name.trim();
    if (body.age !== undefined && body.age !== "") updated.age = Number(body.age);
    if (body.heightCm !== undefined && body.heightCm !== "") updated.heightCm = Number(body.heightCm);
    if (typeof body.bp === "string") updated.bp = body.bp.trim();
    if (typeof body.diagnosis === "string") updated.diagnosis = body.diagnosis.trim();
    if (typeof body.medication === "string") updated.medication = body.medication.trim();
  }

  // DOCTOR: can edit diagnosis + medication + base fields
  else if (role === 3) {
    if (typeof body.name === "string" && body.name.trim()) updated.name = body.name.trim();
    if (body.age !== undefined && body.age !== "") updated.age = Number(body.age);
    if (body.heightCm !== undefined && body.heightCm !== "") updated.heightCm = Number(body.heightCm);
    if (typeof body.bp === "string") updated.bp = body.bp.trim();
    if (typeof body.diagnosis === "string") updated.diagnosis = body.diagnosis.trim();
    if (typeof body.medication === "string") updated.medication = body.medication.trim();
  }

  // NURSE: can edit medication + base fields, but NOT diagnosis
  else if (role === 2) {
    if (typeof body.name === "string" && body.name.trim()) updated.name = body.name.trim();
    if (body.age !== undefined && body.age !== "") updated.age = Number(body.age);
    if (body.heightCm !== undefined && body.heightCm !== "") updated.heightCm = Number(body.heightCm);
    if (typeof body.bp === "string") updated.bp = body.bp.trim();
    if (typeof body.medication === "string") updated.medication = body.medication.trim();
  }

  if (!updated.name || !updated.age || !updated.heightCm || !updated.bp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const enc = encryptJson(updated);

  db.prepare(`
    INSERT OR REPLACE INTO patient_records(patient_id, owner_address, enc_json, updated_at)
    VALUES(?,?,?,?)
  `).run(patientId, owner, JSON.stringify(enc), Date.now());

  res.json({ ok: true, saved: updated });
});

// --- Patient record read (PATIENT own only OR NURSE/DOCTOR/ADMIN) ---
app.get("/patient/:id", requireAuth, async (req, res) => {
  const patientId = Number(req.params.id);
  const addr = req.address;

  const role = await getRole(addr);
  const owner = (await getPatientOwner(patientId)).toLowerCase();

  if (owner === ethers.ZeroAddress) return res.status(404).json({ error: "patientId not linked on-chain" });

  if (role === 1) {
    if (owner !== addr) return res.status(403).json({ error: "Patients can only read their own record" });
  } else if (![2, 3, 4].includes(role)) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const row = db.prepare("SELECT enc_json FROM patient_records WHERE patient_id=?").get(patientId);
  if (!row) return res.status(404).json({ error: "No record stored yet" });

  const dec = decryptJson(JSON.parse(row.enc_json));
  res.json({ patientId, owner, ...dec });
});

// --- Patient record delete (ADMIN only) ---
app.delete("/patient/:id", requireAuth, async (req, res) => {
  const patientId = Number(req.params.id);
  const addr = req.address;

  const role = await getRole(addr);
  if (role !== 4) return res.status(403).json({ error: "Admin only" });

  db.prepare("DELETE FROM patient_records WHERE patient_id=?").run(patientId);
  res.json({ ok: true });
});

// ===== HTTPS server =====
const tlsOptions = {
  key: fs.readFileSync(TLS_KEY),
  cert: fs.readFileSync(TLS_CERT),
};

https.createServer(tlsOptions, app).listen(PORT, () => {
  console.log(`HTTPS server running: https://localhost:${PORT}`);
});