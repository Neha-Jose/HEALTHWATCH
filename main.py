from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import hashlib

app = FastAPI()


nodes = {
    "P001": {"name": "Alice", "auth_docs": [], "ledger": []},
    "P002": {"name": "Bob", "auth_docs": [], "ledger": []},
    "P003": {"name": "Charlie", "auth_docs": [], "ledger": []},
    "P004": {"name": "David", "auth_docs": [], "ledger": []}\
    
}

class RecordData(BaseModel):
    patient_id: str
    doctor_id: str
    diagnosis: str

@app.get("/")
def root():
    return {"status": "Healthcare System Online", "nodes": list(nodes.keys())}

@app.post("/grant")
def grant_access(p_id: str, dr_id: str):
    if p_id not in nodes: raise HTTPException(404, "Node not found")
    nodes[p_id]["auth_docs"].append(dr_id)
    return {"msg": f"Access granted to {dr_id}"}

@app.post("/add_record")
def add(data: RecordData):
    node = nodes.get(data.patient_id)
    if data.doctor_id not in node["auth_docs"]:
        return {"error": "Access Denied: Doctor not authorized for this node."}
    
    h = hashlib.sha3_256(data.diagnosis.encode()).hexdigest()
    node["ledger"].append({"hash": h, "diagnosis": data.diagnosis})
    return {"msg": "Verified & Added to Patient Node", "hash": h}

@app.get("/node/{p_id}")
def get_node(p_id: str):
    return nodes.get(p_id)