declare module "argon2-browser" {
  export const ArgonType: { Argon2d: number; Argon2i: number; Argon2id: number };
  export function hash(options: {
    pass: string;
    salt: string;
    time?: number;
    mem?: number;
    parallelism?: number;
    hashLen?: number;
    type?: number;
  }): Promise<{ hash: Uint8Array; hashHex: string; encoded: string }>;
}

declare module "argon2-browser/dist/argon2-bundled.min.js" {
  export const ArgonType: { Argon2d: number; Argon2i: number; Argon2id: number };
  export function hash(options: {
    pass: string;
    salt: string;
    time?: number;
    mem?: number;
    parallelism?: number;
    hashLen?: number;
    type?: number;
  }): Promise<{ hash: Uint8Array; hashHex: string; encoded: string }>;
}
