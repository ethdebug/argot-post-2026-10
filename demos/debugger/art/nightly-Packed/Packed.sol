// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Packed {
    uint8 public a;
    uint16 public b;
    bool public flag;
    address public owner;
    uint128 public lo;
    uint128 public hi;
    bytes32 public tag;
    string public name;
    uint32[] public xs;

    function set(uint8 a_, uint16 b_, uint128 lo_) external {
        a = a_;
        b = b_;
        flag = !flag;
        owner = msg.sender;
        lo = lo_;
        hi = lo_ * 2;
        xs.push(uint32(a_) + b_);
    }

    function setName(string calldata n) external {
        name = n;
    }
}
