# HEALTHWATCH

#  Secure Blockchain-Based Health Record System

## Project Overview

Healthwatch is a decentralized healthcare record management system designed to demonstrate how blockchain technology, cryptographic authentication, and encrypted data storage can be combined to build a secure medical information platform.

The system integrates a blockchain smart contract layer with a web-based application that allows hospitals to manage patient records with strict role-based access control. Unlike traditional centralized hospital databases, HealthChain ensures that access permissions are enforced on-chain while sensitive medical data is securely stored off-chain using strong cryptographic encryption.

The system uses Ethereum-compatible blockchain infrastructure (Ganache) for smart contract execution and MetaMask wallet signatures for identity authentication. Medical records are encrypted before storage using modern symmetric encryption to prevent unauthorized access.

The goal of the project is to demonstrate a secure and scalable architecture for digital health systems that protects patient data privacy while enabling authorized medical professionals to update and retrieve records in a controlled manner.

---

# System Architecture

The Healthwatch platform follows a **hybrid architecture**, combining decentralized blockchain verification with secure off-chain encrypted data storage.

The architecture consists of four main layers:

1. **Blockchain Layer (Ethereum Smart Contract)**
2. **Backend Server Layer**
3. **Encrypted Database Storage Layer**
4. **Frontend Web Application Layer**

Each component plays a distinct role in ensuring security, integrity, and usability.

---

# Blockchain Layer

The blockchain layer is implemented using a smart contract deployed on an Ethereum-compatible network. For development and testing purposes, the project uses **Ganache**, which simulates a local Ethereum blockchain environment.

The smart contract is responsible for maintaining the authorization structure of the system.

Specifically, the contract manages:

• Role assignments for each wallet address
• Mapping of patient IDs to patient wallet addresses
• Access control validation for different roles

The roles defined in the system are:

0 – NONE
1 – PATIENT
2 – NURSE
3 – DOCTOR
4 – ADMIN

Each role has different permissions within the system.

For example:

• Doctors can add diagnoses
• Nurses can update medications
• Patients can view but not modify their own records
• Admins can register patients and manage roles

Because role information is stored on-chain, it cannot be tampered with by the application server.

---

# Backend Server Layer

The backend is implemented using **Node.js with Express.js**.

The server performs several important tasks:

• Wallet authentication verification
• Encryption and decryption of medical data
• Secure communication with the blockchain
• API services for the frontend application
• Database interaction

The backend exposes several REST API endpoints such as:

/auth/nonce
/auth/verify
/admin/link
/patient/:id

These endpoints allow the frontend to authenticate users, retrieve patient records, and update information depending on the user’s role.

The backend also signs blockchain transactions using an admin wallet private key stored securely in environment variables.

---

# Authentication Mechanism

The system uses **MetaMask wallet authentication via ECDSA signature verification**.

The login process follows a secure challenge-response mechanism.

Step 1
The frontend requests a nonce from the backend.

Step 2
The backend generates a random cryptographic nonce and sends a login message.

Step 3
The user signs the message using MetaMask.

Step 4
The backend verifies the signature using the Ethereum cryptography library.

If the recovered address matches the requesting wallet address, authentication is successful.

This method ensures that no passwords are required and the user proves ownership of their blockchain identity.

---

# Encrypted Data Storage

Patient medical records are not stored directly on the blockchain. Instead, they are stored in a local database after encryption.

The project uses **SQLite (via better-sqlite3)** as the storage engine.

Before storing medical records, the backend encrypts the data using:

AES-256-GCM

AES-256-GCM provides:

• Confidentiality (data cannot be read without the key)
• Integrity (tampering detection using authentication tags)
• Strong cryptographic security

Each encrypted record contains:

Initialization Vector (IV)
Authentication Tag
Ciphertext

The encryption key is stored securely in the server environment variables.

---

# Frontend Application

The frontend is implemented using:

React
Vite
Tailwind-style CSS layout
Framer Motion animations

The frontend acts as a user-friendly dashboard for interacting with the HealthChain backend.

The interface includes:

Wallet connection panel
User role display
Patient record editor
Structured patient summary view
Admin registration panel

The system dynamically changes available features based on the authenticated user role.

For example:

Patients can only view records.

Doctors can edit diagnosis fields.

Nurses can update medication fields.

Admins can register and link new patients.

---

# Patient Record Structure

Each patient record contains the following fields:

Patient Name
Age
Height
Blood Pressure
Diagnosis
Medication

The system also includes intelligent UI features such as automatic classification of blood pressure values into categories.

Normal
Borderline
High

These are visually represented using color-coded indicators:

Green – Normal
Orange – Borderline
Red – High

This improves usability for healthcare staff.

---

# Smart Contract Deployment

The smart contract is deployed using **Ethers.js deployment scripts**.

Deployment process:

node scripts/deploy-ethers.mjs

After deployment, the contract address is stored in the environment configuration file.

The admin account is then initialized using:

node scripts/admin-setup.mjs

This script assigns roles and links patient IDs to wallet addresses.

---

# Software and Technologies Used

Frontend Technologies

React.js
Vite
Framer Motion
Lucide Icons
CSS / Tailwind-style layout

Backend Technologies

Node.js
Express.js
Ethers.js
Better-SQLite3
Crypto module

Blockchain Technologies

Ethereum Smart Contracts
Ganache Local Blockchain
MetaMask Wallet

Cryptographic Technologies

ECDSA Wallet Signatures
AES-256-GCM Data Encryption
TLS/HTTPS Secure Communication

---

# Security Features

HealthWatch incorporates several layers of security.

Transport Security

HTTPS ensures encrypted communication between the frontend and backend.

Authentication Security

Users authenticate using cryptographic wallet signatures rather than passwords.

Authorization Security

Role permissions are enforced on-chain through smart contract logic.

Data Privacy

Medical records are encrypted before being stored in the database.

Data Integrity

AES-GCM authentication tags detect any modification to encrypted records.

Blockchain Integrity

Smart contract data cannot be altered without consensus from the blockchain network.

---

# Functional Capabilities

The HealthWatch system supports the following operations:

Wallet-based user login
Role-based medical data access
Encrypted patient record storage
Blockchain verification of user roles
Doctor diagnosis entry
Nurse medication updates
Patient record viewing
Admin patient registration

---

# Future Improvements

The system can be further enhanced by adding:

IPFS storage for decentralized medical files
Multi-hospital distributed blockchain network
Advanced analytics dashboards
FHIR-compliant healthcare data formats
AI-assisted clinical recommendations
Multi-factor authentication
Smart contract audit and gas optimization

---

# Conclusion

HealthWatch demonstrates how modern blockchain infrastructure can be combined with secure web technologies to build a trustworthy digital healthcare platform.

By separating authorization logic on the blockchain from encrypted medical data stored off-chain, the system achieves both privacy and integrity. The architecture ensures that only authorized healthcare professionals can update patient records while allowing patients to maintain visibility into their own medical data.

The project serves as a prototype illustrating the potential of decentralized technologies in secure healthcare information management systems.
