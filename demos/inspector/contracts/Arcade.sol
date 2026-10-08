// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Arcade {
    struct Player {
        uint64 score;       // ┐
        uint32 combo;       // │
        uint32 bestCombo;   // │ one full slot: 8+4+4+4+4+8 = 32 bytes
        uint32 plays;       // │
        uint32 hits;        // │
        uint64 lastBlock;   // ┘ when they last played
        string name;        //   the next slot
    }
    address[] public playerList;  // who joined, in order (a mapping can't list its keys)
    string public motd;           // the message of the day
    uint128 public totalScore;    // ┐ one slot: every player's points
    uint64 public totalHits;      // ┘   and every player's hits
    mapping(address => Player) public players;
    constructor(string memory initialMotd) { motd = initialMotd; }
    function join(string calldata name) external {   // pick a name, once
        require(bytes(name).length > 0 && bytes(players[msg.sender].name).length == 0);
        players[msg.sender].name = name;
        playerList.push(msg.sender);
    }
    function play() external {
        Player storage player = players[msg.sender];
        require(bytes(player.name).length > 0);   // joined
        player.plays += 1;
        player.lastBlock = uint64(block.number);
        if (!_rolledHit()) { _resetCombo(player); return; }   // a miss
        player.combo += 1;
        player.hits += 1;
        if (player.combo > player.bestCombo) player.bestCombo = player.combo;
        uint64 gained = _applyCombo(10, player.combo);
        player.score += gained; totalScore += gained; totalHits += 1;
    }
    function setMotd(string calldata text) external { motd = text; }   // anyone may
    // a toy roll (not safe randomness): 2 in 3 is a hit
    function _rolledHit() internal view returns (bool) {
        return uint256(keccak256(abi.encode(block.prevrandao, msg.sender))) % 3 != 0;
    }
    function _resetCombo(Player storage player) internal { player.combo = 0; }
    function _applyCombo(uint64 points, uint32 combo) internal pure returns (uint64) {
        return points * (combo < 5 ? combo : 5);   // the multiplier stops at 5
    }
}
