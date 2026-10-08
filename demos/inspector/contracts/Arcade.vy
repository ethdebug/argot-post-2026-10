# pragma version ~=0.4.3

struct Player:
    score: uint64
    combo: uint32
    bestCombo: uint32
    plays: uint32
    hits: uint32
    lastBlock: uint64  # when they last played
    name: String[64]

playerList: public(DynArray[address, 100])  # who joined, in order (a mapping can't list its keys)
motd: public(String[100])                  # the message of the day
totalScore: public(uint128)                # every player's points
totalHits: public(uint64)                  # every player's hits
players: public(HashMap[address, Player])

@deploy
def __init__(initial_motd: String[100]):
    self.motd = initial_motd

@external
def join(name: String[64]):  # pick a name, once
    assert len(name) > 0 and len(self.players[msg.sender].name) == 0
    self.players[msg.sender].name = name
    self.playerList.append(msg.sender)

@external
def play():
    assert len(self.players[msg.sender].name) > 0  # joined
    self.players[msg.sender].plays += 1
    self.players[msg.sender].lastBlock = convert(block.number, uint64)
    if not self._rolled_hit():
        self._reset_combo(msg.sender)  # a miss
        return
    self.players[msg.sender].combo += 1
    self.players[msg.sender].hits += 1
    if self.players[msg.sender].combo > self.players[msg.sender].bestCombo:
        self.players[msg.sender].bestCombo = self.players[msg.sender].combo
    gained: uint64 = self._apply_combo(10, self.players[msg.sender].combo)
    self.players[msg.sender].score += gained
    self.totalScore += convert(gained, uint128)
    self.totalHits += 1

@external
def setMotd(text: String[100]):  # anyone may
    self.motd = text

# a toy roll (not safe randomness): 2 in 3 is a hit
@internal
@view
def _rolled_hit() -> bool:
    return convert(keccak256(abi_encode(block.prevrandao, msg.sender)), uint256) % 3 != 0

@internal
def _reset_combo(who: address):
    self.players[who].combo = 0

@internal
@pure
def _apply_combo(points: uint64, combo: uint32) -> uint64:
    return points * convert(combo if combo < 5 else 5, uint64)  # the multiplier stops at 5
