// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Arcade {
    struct Player { uint64 score; uint32 combo; bool active; }
    mapping(address => Player) public players;
    uint256[] public hits;     // every hit's points, in order
    string public motd;        // the server's message of the day
    uint128 public total;      // all players' points, packed with
    uint64 public rounds;      //   the number of hits
    constructor(string memory m) { motd = m; }
    function play() external {
        Player storage p = players[msg.sender];
        p.active = true;
        if (!rolledHit()) { resetCombo(p); return; }   // a miss
        p.combo += 1;
        uint64 gained = multiplied(10, p.combo);
        p.score += gained; hits.push(gained); total += gained; rounds += 1;
    }
    function setMotd(string calldata text) external { motd = text; }
    // a toy roll (not safe randomness): 2 in 3 is a hit
    function rolledHit() internal view returns (bool) {
        return uint256(keccak256(abi.encode(block.prevrandao, msg.sender))) % 3 != 0;
    }
    function resetCombo(Player storage p) internal { p.combo = 0; }
    function multiplied(uint64 points, uint32 combo) internal pure returns (uint64) {
        return points * (combo < 5 ? combo : 5);
    }
}
