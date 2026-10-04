// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Strings {
    string public grows;   // short, then long
    string public shrinks; // long, then short
    string public most;    // 31 bytes: the longest short string
    string public least;   // 32 bytes: the shortest long string

    function setAll(
        string calldata g,
        string calldata s,
        string calldata m,
        string calldata l
    ) external {
        grows = g;
        shrinks = s;
        most = m;
        least = l;
    }

    function update(string calldata g, string calldata s) external {
        grows = g;
        shrinks = s;
    }
}
