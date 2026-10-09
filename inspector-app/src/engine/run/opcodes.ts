// EVM opcode names by byte (Prague), as @ethdebug/evm's trace steps name
// them; and bytes by name
const table: [number, string][] = [];
const run = (from: number, names: string) => names.split(" ")
  .forEach((n, k) => table.push([from + k, n]));
run(0x00, "STOP ADD MUL SUB DIV SDIV MOD SMOD ADDMOD MULMOD EXP " +
  "SIGNEXTEND");
run(0x10, "LT GT SLT SGT EQ ISZERO AND OR XOR NOT BYTE SHL SHR SAR");
run(0x20, "KECCAK256");
run(0x30, "ADDRESS BALANCE ORIGIN CALLER CALLVALUE CALLDATALOAD " +
  "CALLDATASIZE CALLDATACOPY CODESIZE CODECOPY GASPRICE EXTCODESIZE " +
  "EXTCODECOPY RETURNDATASIZE RETURNDATACOPY EXTCODEHASH");
run(0x40, "BLOCKHASH COINBASE TIMESTAMP NUMBER PREVRANDAO GASLIMIT " +
  "CHAINID SELFBALANCE BASEFEE BLOBHASH BLOBBASEFEE");
run(0x50, "POP MLOAD MSTORE MSTORE8 SLOAD SSTORE JUMP JUMPI PC MSIZE GAS " +
  "JUMPDEST TLOAD TSTORE MCOPY PUSH0");
for (let n = 1; n <= 32; n++) table.push([0x5f + n, `PUSH${n}`]);
for (let n = 1; n <= 16; n++) table.push([0x7f + n, `DUP${n}`]);
for (let n = 1; n <= 16; n++) table.push([0x8f + n, `SWAP${n}`]);
for (let n = 0; n <= 4; n++) table.push([0xa0 + n, `LOG${n}`]);
run(0xf0, "CREATE CALL CALLCODE RETURN DELEGATECALL CREATE2");
run(0xfa, "STATICCALL");
run(0xfd, "REVERT INVALID SELFDESTRUCT");

const names = new Map(table);
export const opName = (byte: number): string =>
  names.get(byte) ?? `0x${byte.toString(16).padStart(2, "0")}`;
const bytes = new Map(table.map(([b, n]) => [n, b]));
export function opByte(name: string): number {
  const b = bytes.get(name);
  if (b === undefined) throw new Error(`no opcode ${name}`);
  return b;
}
