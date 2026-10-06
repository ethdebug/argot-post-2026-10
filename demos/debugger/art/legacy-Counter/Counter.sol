// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    address public owner;
    uint256 public count;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner(address who) {
        require(who == owner, "not owner");
        _;
    }

    function increment(uint256 by) external onlyOwner(msg.sender) {
        count = add(count, by);
    }

    function add(uint256 x, uint256 y) internal pure returns (uint256) {
        uint256 z = x + y;
        return z;
    }
}
