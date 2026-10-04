// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Calls {
  uint256 public total;
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    require(a < 1000, "too big");
    return a + b;
  }
  function twice(uint256 x) internal pure returns (uint256) {
    return add(x, x);
  }
  function run(uint256 x) external {
    total = twice(x) + add(x, 1);
  }
}
