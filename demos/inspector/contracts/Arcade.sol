// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Arcade {
    struct Player {
        uint64 score;       // ┐
        uint32 combo;       // │
        uint32 bestCombo;   // │ one full slot: 8+4+4+4+4+8 = 32 bytes
        uint32 plays;       // │
        uint32 hitCount;    // │
        uint64 lastBlock;   // ┘ when they last played
        string name;        //   the next slot
    }
    address[] public roster;   // everyone who has joined (a mapping can't list its keys)
    string public motd;        // the server's message of the day
    uint128 public total;      // all players' points, packed with
    uint64 public rounds;      //   the number of hits
    mapping(address => Player) public players;
    constructor(string memory m) { motd = m; }
    function join(string calldata name) external {   // pick a name, once
        require(bytes(name).length > 0 && bytes(players[msg.sender].name).length == 0);
        players[msg.sender].name = name;
        roster.push(msg.sender);
    }
    function play() external {
        Player storage p = players[msg.sender];
        require(bytes(p.name).length > 0);   // joined
        p.plays += 1;
        p.lastBlock = uint64(block.number);
        if (!rolledHit()) { resetCombo(p); return; }   // a miss
        p.combo += 1;
        p.hitCount += 1;
        if (p.combo > p.bestCombo) p.bestCombo = p.combo;
        uint64 gained = multiplied(10, p.combo);
        p.score += gained; total += gained; rounds += 1;
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
