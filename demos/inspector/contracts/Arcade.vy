# pragma version ~=0.4.3

struct Player:
    score: uint64
    combo: uint32
    active: bool

players: public(HashMap[address, Player])
hits: public(DynArray[uint256, 100])   # every hit's points, in order
motd: public(String[100])              # the server's message of the day
total: public(uint128)                 # all players' points
rounds: public(uint64)                 # the number of hits

@deploy
def __init__(m: String[100]):
    self.motd = m

@external
def play():
    self.players[msg.sender].active = True
    if not self._rolled_hit():
        self._reset_combo(msg.sender)  # a miss
        return
    self.players[msg.sender].combo += 1
    gained: uint64 = self._multiplied(10, self.players[msg.sender].combo)
    self.players[msg.sender].score += gained
    self.hits.append(convert(gained, uint256))
    self.total += convert(gained, uint128)
    self.rounds += 1

@external
def setMotd(text: String[100]):
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
def _multiplied(points: uint64, combo: uint32) -> uint64:
    return points * convert(combo if combo < 5 else 5, uint64)
