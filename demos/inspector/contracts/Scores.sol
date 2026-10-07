// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Scores {
    struct Player {
        uint64 score;
        uint32 streak;
        bool active;
    }

    mapping(address => Player) public players;
    uint256[] public history;
    string public motto;
    uint128 public total;
    uint64 public rounds;

    function bonus(uint256 points, uint256 streak)
        internal
        pure
        returns (uint256)
    {
        uint256 b = points * streak;
        if (b > 100) {
            b = 100;
        }
        return b;
    }

    function record(uint256 points) external {
        uint256 streak = players[msg.sender].streak;
        uint256 gained = points + bonus(points, streak);
        players[msg.sender].score = uint64(players[msg.sender].score + gained);
        players[msg.sender].streak = players[msg.sender].streak + 1;
        players[msg.sender].active = true;
        history.push(gained);
        total = uint128(total + gained);
        rounds = rounds + 1;
    }

    function setMotto(string calldata m) external {
        motto = m;
    }
}
