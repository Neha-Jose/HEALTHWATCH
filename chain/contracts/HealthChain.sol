// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthChain {
    enum Role { NONE, PATIENT, NURSE, DOCTOR, ADMIN }

    mapping(address => Role) public roles;
    mapping(uint256 => address) public patientOwner;

    event RoleAssigned(address indexed user, Role role);
    event PatientLinked(uint256 indexed patientId, address indexed patient);
    event PatientRegistered(uint256 indexed patientId, address indexed owner);
    event PatientUnregistered(uint256 indexed patientId, address indexed oldOwner);
    event AuditLog(
        uint256 indexed patientId,
        string action,
        bytes32 recordHash,
        address indexed actor,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(roles[msg.sender] == Role.ADMIN, "Not admin");
        _;
    }

    function setInitialAdmin(address admin) external {
        require(roles[admin] == Role.NONE, "Already set");
        roles[admin] = Role.ADMIN;
        emit RoleAssigned(admin, Role.ADMIN);
    }

    function assignRole(address user, Role role) external onlyAdmin {
        roles[user] = role;
        emit RoleAssigned(user, role);
    }

    function linkPatient(uint256 patientId, address patient) external onlyAdmin {
    require(patientId > 0, "Bad id");
    require(patient != address(0), "Bad patient");
    require(patientOwner[patientId] == address(0), "Already linked");

    patientOwner[patientId] = patient;
    roles[patient] = Role.PATIENT;

    emit PatientLinked(patientId, patient);
    emit RoleAssigned(patient, Role.PATIENT);
}

    function unlinkPatient(uint256 patientId) external onlyAdmin {
    address old = patientOwner[patientId];
    require(old != address(0), "Not linked");

    patientOwner[patientId] = address(0);

    // OPTIONAL: do not downgrade role automatically (safe)
    // roles[old] = Role.NONE;

    emit PatientUnregistered(patientId, old);
    }

    function writeAudit(uint256 patientId, string calldata action, bytes32 recordHash) external {
        Role r = roles[msg.sender];

        if (r == Role.PATIENT) {
            require(patientOwner[patientId] == msg.sender, "Not your record");
        } else {
            require(r == Role.ADMIN || r == Role.DOCTOR || r == Role.NURSE, "No permission");
        }

        emit AuditLog(patientId, action, recordHash, msg.sender, block.timestamp);
    }
}