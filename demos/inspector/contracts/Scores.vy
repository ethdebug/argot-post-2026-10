# pragma version ^0.4.3
struct Player:
    score: uint64
    streak: uint32
    active: bool

players: public(HashMap[address, Player])
history: public(DynArray[uint256, 100])
motto: public(String[100])
total: public(uint128)
rounds: public(uint64)

@internal
@pure
def _bonus(points: uint256, streak: uint256) -> uint256:
    b: uint256 = points * streak
    if b > 100:
        b = 100
    return b

@external
def record(points: uint256) -> uint256:
    streak: uint256 = convert(self.players[msg.sender].streak, uint256)
    gained: uint256 = points + self._bonus(points, streak)
    self.players[msg.sender].score += convert(gained, uint64)
    self.players[msg.sender].streak += 1
    self.players[msg.sender].active = True
    self.history.append(gained)
    self.total += convert(gained, uint128)
    self.rounds += 1
    return gained

@external
def setMotto(m: String[100]):
    self.motto = m
