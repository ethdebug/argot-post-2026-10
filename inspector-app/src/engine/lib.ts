// The only import site of @ethdebug/pointers and @ethdebug/format,
// pinned by vendor/PIN (with @ethdebug/evm, which only the runner uses)
export { dereference, Data } from "@ethdebug/pointers";
export type { Cursor } from "@ethdebug/pointers";
export type { Machine } from "@ethdebug/pointers";
// the library's own expression evaluator (not in its public exports)
export { evaluate } from "@ethdebug/pointers/dist/src/evaluate.js";
export type { Pointer, Program, Type } from "@ethdebug/format";
