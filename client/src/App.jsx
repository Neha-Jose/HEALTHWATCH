import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Activity,
  Stethoscope,
  User,
  LogIn,
  LogOut,
  Trash2,
  Save,
  Search,
  HeartPulse,
  ClipboardList,
  Pill,
  Link as LinkIcon,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE;

function roleName(r) {
  switch (Number(r)) {
    case 1: return "PATIENT";
    case 2: return "NURSE";
    case 3: return "DOCTOR";
    case 4: return "ADMIN";
    default: return "NONE";
  }
}

function roleIcon(role) {
  const r = Number(role);
  if (r === 4) return <ShieldCheck size={16} />;
  if (r === 3) return <Stethoscope size={16} />;
  if (r === 2) return <Activity size={16} />;
  if (r === 1) return <User size={16} />;
  return <User size={16} />;
}

function getRoleTone(role) {
  switch (Number(role)) {
    case 4: return "amber";
    case 3: return "blue";
    case 2: return "green";
    case 1: return "teal";
    default: return "slate";
  }
}

function Badge({ tone = "slate", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function parseBP(bp) {
  if (!bp || typeof bp !== "string") return null;
  const match = bp.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

function getBPStatus(bp) {
  const parsed = parseBP(bp);
  if (!parsed) {
    return { label: "Unknown", tone: "slate" };
  }

  const { systolic, diastolic } = parsed;

  if (systolic < 120 && diastolic < 80) {
    return { label: "Normal", tone: "green" };
  }

  if ((systolic >= 120 && systolic <= 129) && diastolic < 80) {
    return { label: "Borderline", tone: "amber" };
  }

  if (systolic >= 130 || diastolic >= 80) {
    return { label: "High", tone: "red" };
  }

  return { label: "Borderline", tone: "amber" };
}

function SummaryItem({ label, value, icon = null, extra = null }) {
  return (
    <div className="summary-item">
      <div className="summary-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="summary-value">{value || "-"}</div>
      {extra ? <div className="summary-extra">{extra}</div> : null}
    </div>
  );
}

export default function App() {
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");

  const [token, setToken] = useState("");
  const [role, setRole] = useState(0);

  const [patientId, setPatientId] = useState("1");

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bp, setBp] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [medication, setMedication] = useState("");

  const [regId, setRegId] = useState("2");
  const [regAddr, setRegAddr] = useState("");

  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const connected = useMemo(() => !!address, [address]);
  const authed = useMemo(() => !!token, [token]);

  const roleLabel = roleName(role);
  const roleTone = getRoleTone(role);
  const bpStatus = getBPStatus(bp);

  const diagnosisEditable = Number(role) === 3 || Number(role) === 4;
  const medicationEditable = Number(role) === 2 || Number(role) === 3 || Number(role) === 4;

  async function connectWallet() {
    setErr("");
    setResult("");

    if (!window.ethereum) {
      setErr("MetaMask not found. Install MetaMask extension first.");
      return;
    }

    const p = new ethers.BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const signer = await p.getSigner();
    const addr = await signer.getAddress();
    const network = await p.getNetwork();

    setProvider(p);
    setAddress(addr);
    setChainId(String(network.chainId));
  }

  async function login() {
    setErr("");
    setResult("");

    if (!provider || !address) {
      setErr("Connect wallet first.");
      return;
    }

    setBusy(true);
    try {
      const nonceRes = await fetch(`${API_BASE}/auth/nonce/${address}`);
      const nonceJson = await nonceRes.json();

      if (!nonceRes.ok) {
        setErr(nonceJson.error || "Failed to get nonce");
        return;
      }

      const signer = await provider.getSigner();
      const signature = await signer.signMessage(nonceJson.message);

      const verRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });

      const verJson = await verRes.json();

      if (!verRes.ok) {
        setErr(verJson.error || "Login failed");
        return;
      }

      setToken(verJson.token);
      setRole(verJson.role);
      setResult(`Logged in as ${roleName(verJson.role)} ✅`);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setRole(0);
    setResult("Logged out.");
    setErr("");
  }

  async function adminLinkPatient() {
    setErr("");
    setResult("");

    if (!authed) return setErr("Login first.");
    if (Number(role) !== 4) return setErr("Admin only.");

    const id = Number(regId);
    const addr = regAddr.trim();

    if (!Number.isInteger(id) || id <= 0) return setErr("Bad Patient ID");
    if (!ethers.isAddress(addr)) return setErr("Bad patient wallet address");

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Address": address,
        },
        body: JSON.stringify({
          patientId: id,
          patientAddress: addr,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErr(json.error || "Link failed");
        return;
      }

      setResult(`Linked ✅ patientId ${id} -> ${addr}\nTx: ${json.txHash}`);
    } finally {
      setBusy(false);
    }
  }

  async function addOrUpdatePatient() {
    setErr("");
    setResult("");

    if (!authed) return setErr("Login first.");

    const body = {
      name: name.trim(),
      age: Number(age),
      heightCm: Number(heightCm),
      bp: bp.trim(),
      diagnosis: diagnosis.trim(),
      medication: medication.trim(),
    };

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/patient/${patientId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Address": address,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setErr(json.error || "Failed to save patient");
        return;
      }

      if (json.saved) {
        setName(json.saved.name ?? "");
        setAge(String(json.saved.age ?? ""));
        setHeightCm(String(json.saved.heightCm ?? ""));
        setBp(json.saved.bp ?? "");
        setDiagnosis(json.saved.diagnosis ?? "");
        setMedication(json.saved.medication ?? "");
      }

      setResult("Patient record saved ✅");
    } finally {
      setBusy(false);
    }
  }

  async function getPatient() {
    setErr("");
    setResult("");

    if (!authed) return setErr("Login first.");

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/patient/${patientId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Address": address,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        setErr(json.error || "Failed to fetch patient");
        return;
      }

      setName(json.name ?? "");
      setAge(String(json.age ?? ""));
      setHeightCm(String(json.heightCm ?? ""));
      setBp(json.bp ?? "");
      setDiagnosis(json.diagnosis ?? "");
      setMedication(json.medication ?? "");

      setResult(JSON.stringify(json, null, 2));
    } finally {
      setBusy(false);
    }
  }

  async function deletePatient() {
    setErr("");
    setResult("");

    if (!authed) return setErr("Login first.");

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/patient/${patientId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Address": address,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        setErr(json.error || "Delete failed");
        return;
      }

      setName("");
      setAge("");
      setHeightCm("");
      setBp("");
      setDiagnosis("");
      setMedication("");

      setResult("Patient record deleted ✅");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccounts = (accs) => {
      const a = accs && accs[0] ? accs[0] : "";
      setAddress(a);
      setToken("");
      setRole(0);
      setResult("");
      setErr("");
    };

    const onChain = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="app-container">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="hero-card"
        >
          <div className="hero-copy">
            <div className="eyebrow">Secure Healthcare Records</div>
            <h1>HealthChain</h1>
            <p>
              A hospital-style blockchain health record interface with wallet authentication,
              encrypted storage, and role-based medical access.
            </p>
          </div>

          <div className="hero-side">
            <Badge tone={connected ? "green" : "slate"}>
              <span className="status-dot" />
              {connected ? "Wallet Connected" : "Disconnected"}
            </Badge>

            <Badge tone={roleTone}>
              {roleIcon(role)}
              {roleLabel}
            </Badge>
          </div>
        </motion.header>

        <div className="main-grid">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="card"
          >
            <div className="card-header">
              <h2>Connection & Session</h2>
              <p>Authenticate securely using your MetaMask wallet.</p>
            </div>

            <div className="meta-list">
              <div className="meta-row">
                <span>Wallet Address</span>
                <strong className="mono">{address || "-"}</strong>
              </div>
              <div className="meta-row">
                <span>Chain ID</span>
                <strong className="mono">{chainId || "-"}</strong>
              </div>
              <div className="meta-row">
                <span>Current Role</span>
                <strong>{roleLabel}</strong>
              </div>
            </div>

            <div className="action-row">
              <button className="btn btn-dark" onClick={connectWallet} disabled={connected || busy}>
                {connected ? "Connected" : "Connect MetaMask"}
              </button>

              <button className="btn btn-blue" onClick={login} disabled={!connected || authed || busy}>
                <LogIn size={16} />
                Login
              </button>

              <button className="btn btn-soft" onClick={logout} disabled={!authed || busy}>
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="card"
          >
            <div className="card-header">
              <h2>Patient Snapshot</h2>
              <p>Structured view of the selected patient record.</p>
            </div>

            <div className="summary-grid">
              <SummaryItem label="Patient ID" value={patientId} icon={<User size={14} />} />
              <SummaryItem label="Name" value={name || "-"} icon={<ClipboardList size={14} />} />
              <SummaryItem label="Age" value={age ? `${age} years` : "-"} icon={<Activity size={14} />} />
              <SummaryItem label="Height" value={heightCm ? `${heightCm} cm` : "-"} icon={<Activity size={14} />} />
              <SummaryItem
                label="Blood Pressure"
                value={bp || "-"}
                icon={<HeartPulse size={14} />}
                extra={<Badge tone={bpStatus.tone}>{bpStatus.label}</Badge>}
              />
              <SummaryItem
                label="Diagnosis"
                value={diagnosis || "-"}
                icon={<ClipboardList size={14} />}
              />
              <SummaryItem
                label="Medication"
                value={medication || "-"}
                icon={<Pill size={14} />}
              />
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14 }}
          className="card form-card"
        >
          <div className="card-header">
            <h2>Patient Record Editor</h2>
            <p>Structured medical input with role-sensitive editing controls.</p>
          </div>

          <div className="form-grid">
            <div className="field field-full">
              <label>Patient ID</label>
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} />
            </div>

            <div className="field field-full">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="field">
              <label>Age</label>
              <input value={age} onChange={(e) => setAge(e.target.value)} />
            </div>

            <div className="field">
              <label>Height (cm)</label>
              <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>

            <div className="field field-full">
              <label>Blood Pressure</label>
              <input
                value={bp}
                onChange={(e) => setBp(e.target.value)}
                placeholder="e.g., 120/80"
              />
              <div className="field-note">
                Current BP status: <span className={`status-text status-${bpStatus.tone}`}>{bpStatus.label}</span>
              </div>
            </div>

            <div className="field field-full">
              <label>Diagnosis</label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                disabled={!diagnosisEditable}
                placeholder="Doctor/Admin can edit diagnosis"
                rows={3}
              />
            </div>

            <div className="field field-full">
              <label>Medication</label>
              <textarea
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
                disabled={!medicationEditable}
                placeholder="Nurse/Doctor/Admin can edit medication"
                rows={3}
              />
            </div>
          </div>

          <div className="action-row">
            <button className="btn btn-green" onClick={addOrUpdatePatient} disabled={!authed || busy}>
              <Save size={16} />
              Add / Update
            </button>

            <button className="btn btn-dark" onClick={getPatient} disabled={!authed || busy}>
              <Search size={16} />
              Retrieve
            </button>

            <button className="btn btn-red" onClick={deletePatient} disabled={!authed || busy}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>

          <div className="role-help">
            <Badge tone="blue">Doctor/Admin can edit diagnosis</Badge>
            <Badge tone="green">Nurse/Doctor/Admin can edit medication</Badge>
            <Badge tone="teal">Patient can view both only</Badge>
          </div>
        </motion.section>

        {Number(role) === 4 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18 }}
            className="card admin-card"
          >
            <div className="card-header">
              <h2>Admin Panel</h2>
              <p>Link a patient ID to a wallet directly from the interface.</p>
            </div>

            <div className="form-grid admin-grid">
              <div className="field">
                <label>Patient ID</label>
                <input value={regId} onChange={(e) => setRegId(e.target.value)} />
              </div>

              <div className="field">
                <label>Patient Wallet Address</label>
                <input
                  value={regAddr}
                  onChange={(e) => setRegAddr(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>

            <div className="action-row">
              <button className="btn btn-amber" onClick={adminLinkPatient} disabled={!authed || busy}>
                <LinkIcon size={16} />
                Link Patient
              </button>
            </div>
          </motion.section>
        )}

        <div className="feedback-zone">
          <AnimatePresence>
            {err && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="feedback feedback-error"
              >
                <div className="feedback-title">Error</div>
                <pre>{err}</pre>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && !err && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="feedback feedback-success"
              >
                <div className="feedback-title">Result</div>
                <pre>{result}</pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="app-footer">
          <p>
            Security model: HTTPS/TLS in transit, MetaMask ECDSA signature authentication,
            AES-256-GCM encrypted storage, and blockchain-enforced role verification.
          </p>
        </footer>
      </div>
    </div>
  );
}