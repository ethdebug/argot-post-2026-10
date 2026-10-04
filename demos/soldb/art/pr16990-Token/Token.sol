// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    struct Account {
        uint256 balance;
        uint64 nonce;
        bool frozen;
    }

    mapping(address => Account) public accounts;
    uint256 public totalSupply;

    constructor(uint256 supply) {
        accounts[msg.sender].balance = supply;
        totalSupply = supply;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        Account storage from = accounts[msg.sender];
        require(!from.frozen, "frozen");
        require(from.balance >= amount, "balance");
        from.balance -= amount;
        from.nonce += 1;
        accounts[to].balance += amount;
        return true;
    }
}
