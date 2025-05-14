export function patchBytecode(bytecode: string, linkRefs: any, libAddress: string): string {
  const patched = bytecode.slice(0, linkRefs["@inco/lightning/src/Lib.sol"].e[0].start*2+2) +
    libAddress.slice(2).toLowerCase().padStart(linkRefs["@inco/lightning/src/Lib.sol"].e[0].length*2, '0') +
    bytecode.slice(linkRefs["@inco/lightning/src/Lib.sol"].e[0].start*2 + linkRefs["@inco/lightning/src/Lib.sol"].e[0].length*2+2);
  return patched;
}