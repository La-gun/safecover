// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MicroInsurancePolicy {
    address public insurer;
    address public insured;
    uint public premium;
    string public coverage;
    bool public active;

    event PolicyBound(address insured, uint premium, string coverage);

    constructor(address _insured, uint _premium, string memory _coverage) {
        insurer = msg.sender;
        insured = _insured;
        premium = _premium;
        coverage = _coverage;
        active = true;
        emit PolicyBound(insured, premium, coverage);
    }

    function closePolicy() external {
        require(msg.sender == insurer, "Only insurer can close");
        active = false;
    }
}
