# Pointer forms the walkthrough walks, by location

Made by src/engine/walkthrough/coverage.test.ts (UPDATE_GOLDEN=1).
Each cell counts the pointers that walk and fold into steps: the
format's schema examples (`schema`) and our builds' pointers. A
blank cell: no pointer of that form in that location. A form counts
in each location its pointer's regions are in.

| form | storage | memory | stack | calldata | returndata | transient | code |
|---|---|---|---|---|---|---|---|
| .length | walks: schema 4 | walks: schema 4 | walks: schema 2 |  |  |  |  |
| .offset | walks: schema 5 | walks: schema 5 | walks: schema 2 |  |  |  |  |
| conditional | walks: schema 1, solc 3, bugc O0 state 2, bugc O2 state 2 | walks: schema 1 |  |  |  |  |  |
| group | walks: schema 8, solc 4, vyper rule 1, bugc O0 state 3, bugc O2 state 3 | walks: schema 8, bugc O0 locals 9 | walks: schema 3 |  |  |  |  |
| list | walks: schema 1, solc 1, bugc O0 state 1, bugc O2 state 1 | walks: schema 3 | walks: schema 2 |  |  |  |  |
| literal | walks: schema 38, solc 6, vyper rule 1, bugc O0 state 5, bugc O2 state 5 | walks: schema 13, bugc O0 locals 13, bugc O2 locals 13 | walks: schema 5, bugc O0 locals 1, bugc O2 locals 1 | walks: schema 1 | walks: schema 1 | walks: schema 3 | walks: schema 1 |
| reference | walks: schema 2, solc 4, vyper rule 1 |  |  |  |  |  |  |
| reference (yields) | walks: schema 1, solc 2, vyper rule 1 |  |  |  |  |  |  |
| region | walks: schema 38, solc 6, vyper rule 1, bugc O0 state 5, bugc O2 state 5 | walks: schema 13, bugc O0 locals 13, bugc O2 locals 13 | walks: schema 5, bugc O0 locals 1, bugc O2 locals 1 | walks: schema 1 | walks: schema 1 | walks: schema 3 | walks: schema 1 |
| scope (define/in) | walks: schema 5, solc 4, vyper rule 1, bugc O0 state 2, bugc O2 state 2 | walks: schema 2 | walks: schema 1 |  |  |  |  |
| templates | walks: schema 3, bugc O0 state 1, bugc O2 state 1 |  |  |  |  |  |  |
| variable | walks: schema 5, solc 4, vyper rule 1, bugc O0 state 3, bugc O2 state 3 | walks: schema 4 | walks: schema 2 |  |  |  |  |
| ~concat | walks: schema 3 |  |  |  |  |  |  |
| ~difference | walks: schema 6, solc 4, bugc O0 state 2, bugc O2 state 2 |  |  |  |  |  |  |
| ~keccak256 | walks: schema 4, solc 4, vyper rule 1, bugc O0 state 3, bugc O2 state 3 | walks: schema 1 |  |  |  |  |  |
| ~product | walks: schema 5, solc 1 | walks: schema 3 | walks: schema 3 |  |  | walks: schema 1 |  |
| ~quotient | walks: schema 4, solc 4, bugc O0 state 2, bugc O2 state 2 |  |  |  |  | walks: schema 1 |  |
| ~read | walks: schema 3, solc 4, vyper rule 1, bugc O0 state 3, bugc O2 state 3 | walks: schema 4, bugc O0 locals 9 | walks: schema 3 |  |  |  |  |
| ~remainder | walks: schema 2, solc 4, bugc O0 state 2, bugc O2 state 2 |  |  |  |  |  |  |
| ~sizedN | walks: schema 2 |  |  |  |  |  |  |
| ~sum | walks: schema 4, solc 4, vyper rule 1, bugc O0 state 3, bugc O2 state 3 | walks: schema 4, bugc O0 locals 9 | walks: schema 2 |  |  |  |  |
| ~this | walks: schema 3 | walks: schema 2 | walks: schema 2 |  |  |  |  |
| ~wordsize | walks: schema 9, solc 4, bugc O0 state 2, bugc O2 state 2 | walks: schema 3 | walks: schema 3 |  |  | walks: schema 2 |  |
| ~wordsized | walks: schema 5, solc 4, vyper rule 1, bugc O0 state 3, bugc O2 state 3 | walks: schema 1 |  |  |  |  |  |

## Skipped

- pointer/collection/reference #0 (reference): references a template no example defines (string-storage-pointer)
- pointer/collection/reference #1 (reference): references a template no example defines (string-storage-pointer)
- pointer/identifier #0 (identifier): an identifier, not a pointer
- pointer/identifier #1 (identifier): an identifier, not a pointer
- pointer/identifier #2 (identifier): an identifier, not a pointer
- pointer/identifier #3 (identifier): an identifier, not a pointer
- pointer/region/base #0 (base): the base every region extends: no location's own fields (the library takes no region without them)
