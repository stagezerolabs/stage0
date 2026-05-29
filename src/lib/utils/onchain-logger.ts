type HexAddress = `0x${string}`;

function shortAddr(addr?: string): string {
  if (!addr) return 'unknown';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function serializeArgs(args: unknown): unknown {
  if (args === undefined || args === null) return args;
  if (Array.isArray(args)) return args.map(serializeArgs);
  if (typeof args === 'bigint') return `${args.toString()} (bigint)`;
  if (typeof args === 'object') {
    return Object.fromEntries(
      Object.entries(args as Record<string, unknown>).map(([k, v]) => [k, serializeArgs(v)])
    );
  }
  return args;
}

const NS = '%c[onchain]%c';
const STYLE_TAG = 'color:#a78bfa;font-weight:bold';
const STYLE_RESET = 'color:inherit;font-weight:normal';

export const onchainLog = {
  submit(
    address: HexAddress | string,
    functionName: string,
    args?: readonly unknown[],
    value?: bigint
  ) {
    console.groupCollapsed(
      `${NS} 📤 submit  ${functionName}`,
      STYLE_TAG, STYLE_RESET
    );
    console.log('contract :', address, `(${shortAddr(address)})`);
    console.log('function :', functionName);
    if (args !== undefined) console.log('args     :', serializeArgs(args));
    if (value !== undefined && value > 0n)
      console.log('value    :', `${value.toString()} wei`);
    console.groupEnd();
  },

  hash(hash: string, functionName?: string | null) {
    console.log(
      `${NS} 🔗 hash     ${functionName ?? '?'} →`,
      STYLE_TAG, STYLE_RESET,
      hash
    );
  },

  confirming(hash: string, functionName?: string | null) {
    console.log(
      `${NS} ⏳ confirming  ${functionName ?? '?'} →`,
      STYLE_TAG, STYLE_RESET,
      hash
    );
  },

  success(hash: string, functionName?: string | null) {
    console.log(
      `${NS} ✅ success   ${functionName ?? '?'} →`,
      STYLE_TAG, STYLE_RESET,
      hash
    );
  },

  error(functionName?: string | null, error?: unknown) {
    console.group(
      `${NS} ❌ error     ${functionName ?? '?'}`,
      STYLE_TAG, STYLE_RESET
    );
    console.error(error);
    console.groupEnd();
  },

  reset(functionName?: string | null) {
    console.log(
      `${NS} 🔄 reset      ${functionName ?? '?'}`,
      STYLE_TAG, STYLE_RESET
    );
  },
};
