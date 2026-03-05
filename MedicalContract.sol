// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicalRegistry {
    struct Record { string dataHash; address doctor; uint256 timestamp; }
    mapping(string => Record[]) private patientNodes;
    mapping(string => mapping(address => bool)) private permissions;

    function grantAccess(string memory _pId, address _dr) public {
        permissions[_pId][_dr] = true;
    }

    function addRecord(string memory _pId, string memory _hash) public {
        require(permissions[_pId][msg.sender], "Unauthorized");
        patientNodes[_pId].push(Record(_hash, msg.sender, block.timestamp));
    }

    function getRecords(string memory _pId) public view returns (Record[] memory) {
        return patientNodes[_pId];
    }
}