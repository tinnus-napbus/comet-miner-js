import { createHash, randomBytes } from 'node:crypto';

import { Atom, dwim, jam, mat } from '@urbit/nockjs';
import { ed25519 } from '@noble/curves/ed25519.js';
import aura from '@urbit/aura';
import ob from 'urbit-ob';

const SUITE_B_SALT = Uint8Array.from([0x62, 0x66, 0x69, 0x67]);
const SUITE_C_SALT = Uint8Array.from([0x63, 0x66, 0x69, 0x67]);
const CURVE_ORDER = ed25519.Point.Fn.ORDER;

function sha256(bytes) {
  return Uint8Array.from(createHash('sha256').update(bytes).digest());
}

function sha512(bytes) {
  return Uint8Array.from(createHash('sha512').update(bytes).digest());
}

function shas(salt, message) {
  const mid = sha256(message);
  if (salt.length > 32) {
    const salted = Uint8Array.from(salt);
    for (let i = 0; i < 32; i += 1) {
      salted[i] ^= mid[i];
    }
    return sha256(salted);
  }

  const salted = Uint8Array.from(mid);
  for (let i = 0; i < salt.length; i += 1) {
    salted[i] ^= salt[i];
  }
  return sha256(salted);
}

function shaf(salt, message) {
  const full = shas(salt, message);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    out[i] = full[i] ^ full[i + 16];
  }
  return out;
}

function bytesToBigIntLE(bytes) {
  let out = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    out = (out << 8n) | BigInt(bytes[i]);
  }
  return out;
}

function bigIntToBytesLE(value, length = null) {
  if (value < 0n) {
    throw new Error('negative atoms are not supported');
  }

  if (value === 0n) {
    if (length === null) {
      return new Uint8Array([]);
    }
    return new Uint8Array(length);
  }

  const bytes = [];
  let remaining = value;
  while (remaining > 0n) {
    bytes.push(Number(remaining & 0xffn));
    remaining >>= 8n;
  }

  if (length === null) {
    return Uint8Array.from(bytes);
  }
  if (bytes.length > length) {
    throw new Error(`atom does not fit in ${length} bytes`);
  }

  const out = new Uint8Array(length);
  out.set(bytes);
  return out;
}

export function formatUw(value) {
  return aura.scot('uw', value);
}

function normalizePatpName(name) {
  return name.startsWith('~') ? name : `~${name}`;
}

export function parsePatpWord(name) {
  const normalized = normalizePatpName(name);
  const value = BigInt(ob.patp2dec(normalized));
  if (value > 0xffffn) {
    throw new Error(`${name} is not a star-sized @p`);
  }
  return Number(value);
}

function cometToPatp(cometAtom) {
  return ob.patp(cometAtom.toString(10));
}

function clampPrivateScalar(expanded) {
  const out = Uint8Array.from(expanded);
  out[0] &= 248;
  out[31] &= 63;
  out[31] |= 64;
  return out;
}

function keypairFromSeed(seed32) {
  const privateKey = clampPrivateScalar(sha512(seed32));
  const scalar = bytesToBigIntLE(privateKey.slice(0, 32)) % CURVE_ORDER;
  const publicKey = ed25519.Point.BASE.multiply(scalar).toBytes();
  return { publicKey, privateKey };
}

function addScalarToPrivate(privateKey, scalarBytes) {
  const n = Uint8Array.from(scalarBytes);
  n[31] &= 127;
  const oldScalar = bytesToBigIntLE(privateKey.slice(0, 32)) % CURVE_ORDER;
  const addScalar = bytesToBigIntLE(n) % CURVE_ORDER;
  const nextScalar = (oldScalar + addScalar) % CURVE_ORDER;

  const nextPrivate = Uint8Array.from(privateKey);
  nextPrivate.set(bigIntToBytesLE(nextScalar, 32), 0);

  const hashInput = new Uint8Array(64);
  hashInput.set(privateKey.slice(32, 64), 0);
  hashInput.set(scalarBytes, 32);
  nextPrivate.set(sha512(hashInput).slice(0, 32), 32);

  return nextPrivate;
}

function publicFromPrivate(privateKey) {
  const scalar = bytesToBigIntLE(privateKey.slice(0, 32)) % CURVE_ORDER;
  return ed25519.Point.BASE.multiply(scalar).toBytes();
}

function matAtom(atom) {
  const encoded = mat(new Atom(atom));
  return {
    bits: encoded.head.number,
    value: encoded.tail.number,
  };
}

function buildSuiteBRing(seedBytes) {
  const ringTail = sha512(seedBytes);
  const ringBytes = new Uint8Array(65);
  ringBytes[0] = 0x42;
  ringBytes.set(ringTail, 1);
  return {
    atom: bytesToBigIntLE(ringBytes),
    bytes: ringBytes,
  };
}

function buildSuiteCRing(ringBytes, tweakAtom) {
  const tweakEncoding = matAtom(tweakAtom);
  const atom =
    0x43n +
    (bytesToBigIntLE(ringBytes) << 8n) +
    (tweakEncoding.value << 520n);

  return {
    atom,
    bits: 520n + tweakEncoding.bits,
  };
}

function buildFeedAtom(cometBytes, rift, life, ringAtom) {
  const cometAtom = bytesToBigIntLE(cometBytes);
  const noun = dwim([[2, 0], cometAtom, rift, [[life, ringAtom], 0]]);
  return jam(noun).number;
}

function increment512LE(bytes) {
  for (let i = 0; i < 64; i += 8) {
    let word = bytesToBigIntLE(bytes.slice(i, i + 8));
    if (word !== 0xffffffffffffffffn) {
      word += 1n;
      bytes.set(bigIntToBytesLE(word, 8), i);
      return true;
    }
    bytes.fill(0, i, i + 8);
  }
  return false;
}

function ensureSeed64(seedBytes) {
  if (!(seedBytes instanceof Uint8Array) || seedBytes.length !== 64) {
    throw new Error('seed must be 64 bytes');
  }
}

function deriveSuiteB(seedBytes, { life = 1, rift = 0, materialize = true } = {}) {
  ensureSeed64(seedBytes);

  const pass = new Uint8Array(65);
  pass[0] = 0x62;
  pass.set(keypairFromSeed(seedBytes.slice(0, 32)).publicKey, 1);
  pass.set(keypairFromSeed(seedBytes.slice(32, 64)).publicKey, 33);

  const cometBytes = shaf(SUITE_B_SALT, pass);
  const cometAtom = bytesToBigIntLE(cometBytes);
  const star = Number(bytesToBigIntLE(cometBytes.slice(0, 2)));
  const prefix = Number(bytesToBigIntLE(cometBytes.slice(14, 16)));

  if (!materialize) {
    return { suite: 'b', cometAtom, star, prefix };
  }

  const ring = buildSuiteBRing(seedBytes);

  return {
    suite: 'b',
    feedAtom: buildFeedAtom(cometBytes, rift, life, ring.atom),
    cometAtom,
    comet: cometToPatp(cometAtom),
    star,
    prefix,
  };
}

function deriveSuiteC(seedBytes, { tweak = 0n, life = 1, rift = 0, materialize = true } = {}) {
  ensureSeed64(seedBytes);

  const ringBytes = sha512(seedBytes);
  const signSeed = ringBytes.slice(0, 32);
  const crySeed = ringBytes.slice(32, 64);
  const signPair = keypairFromSeed(signSeed);
  const cryPair = keypairFromSeed(crySeed);
  const tweakBytes = bigIntToBytesLE(tweak);
  const tweakMaterial = new Uint8Array(signPair.publicKey.length + tweakBytes.length);
  tweakMaterial.set(signPair.publicKey);
  tweakMaterial.set(tweakBytes, signPair.publicKey.length);
  const tweakScalar = sha256(tweakMaterial);
  const tweakedPrivateKey = addScalarToPrivate(signPair.privateKey, tweakScalar);
  const tweakedPublicKey = publicFromPrivate(tweakedPrivateKey);
  const cometBytes = shaf(SUITE_C_SALT, tweakedPublicKey);
  const cometAtom = bytesToBigIntLE(cometBytes);
  const star = Number(bytesToBigIntLE(cometBytes.slice(0, 2)));
  const prefix = Number(bytesToBigIntLE(cometBytes.slice(14, 16)));

  if (!materialize) {
    return { suite: 'c', cometAtom, star, prefix };
  }

  const ring = buildSuiteCRing(ringBytes, tweak);

  return {
    suite: 'c',
    feedAtom: buildFeedAtom(cometBytes, rift, life, ring.atom),
    cometAtom,
    comet: cometToPatp(cometAtom),
    star,
    prefix,
    passAtom:
      0x63n +
      (bytesToBigIntLE(signPair.publicKey) << 8n) +
      (bytesToBigIntLE(cryPair.publicKey) << 264n) +
      (matAtom(tweak).value << 520n),
  };
}

function matchesFilters(result, stars, prefix) {
  if (stars && stars.size > 0 && !stars.has(result.star)) {
    return false;
  }
  if (prefix !== null && result.prefix !== prefix) {
    return false;
  }
  return true;
}

export function parseAtomText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    let parsedJson;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      throw new Error(`could not parse atom literal array: ${text}`);
    }

    return normalizeTweak(parsedJson);
  }

  const parsed = aura.nuck(text);
  if (parsed === null) {
    throw new Error(`could not parse atom literal: ${text}`);
  }
  if (parsed.type !== 'dime') {
    throw new Error(`expected atomic literal, got ${parsed.type}: ${text}`);
  }
  return parsed.atom;
}

function parseSingleAtomLiteral(value) {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`expected non-negative integer atom literal, got ${value}`);
    }
    return BigInt(value);
  }

  if (typeof value !== 'string') {
    throw new Error(`expected atom literal as string, number, or bigint; got ${typeof value}`);
  }

  const parsed = aura.nuck(value);
  if (parsed === null) {
    throw new Error(`could not parse atom literal: ${value}`);
  }
  if (parsed.type !== 'dime') {
    throw new Error(`expected atomic literal, got ${parsed.type}: ${value}`);
  }
  return parsed.atom;
}

export function normalizeTweak(value) {
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    let parsedJson;
    try {
      parsedJson = JSON.parse(value.trim());
    } catch {
      throw new Error(`could not parse atom literal array: ${value}`);
    }
    return normalizeTweak(parsedJson);
  }

  if (Array.isArray(value)) {
    const atoms = value.map((item) => parseSingleAtomLiteral(item));
    const noun = atoms.length === 0 ? Atom.zero : dwim([...atoms, Atom.zero]);
    return jam(noun).number;
  }

  return parseSingleAtomLiteral(value);
}

function parseSingleStar(value) {
  if (typeof value === 'bigint') {
    if (value < 0n || value > 0xffffn) {
      throw new Error(`${value} is not a star-sized @p`);
    }
    return Number(value);
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`${value} is not a star-sized @p`);
    }
    return value;
  }

  if (typeof value === 'string') {
    return parsePatpWord(value);
  }

  throw new Error(`expected star as string, number, or bigint; got ${typeof value}`);
}

export function normalizeStars(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Set) {
    return new Set(Array.from(value, parseSingleStar));
  }

  if (Array.isArray(value)) {
    return new Set(value.map(parseSingleStar));
  }

  return new Set([parseSingleStar(value)]);
}

export function mineComet(options) {
  const {
    suite,
    tweak: tweakInput = 0n,
    life = 1,
    rift = 0,
    stars: starsInput = null,
    prefix = null,
    startSeed = randomBytes(64),
  } = options;

  if (suite !== 'b' && suite !== 'c') {
    throw new Error('suite must be "b" or "c"');
  }

  const tweak = normalizeTweak(tweakInput);
  const stars = normalizeStars(starsInput);

  const seed = Uint8Array.from(startSeed);
  ensureSeed64(seed);

  let tries = 0n;
  for (;;) {
    tries += 1n;
    if (!increment512LE(seed)) {
      seed.set(randomBytes(64));
    }

    const preview =
      suite === 'b'
        ? deriveSuiteB(seed, { materialize: false })
        : deriveSuiteC(seed, { tweak, materialize: false });

    if (matchesFilters(preview, stars, prefix)) {
      const result =
        suite === 'b'
          ? deriveSuiteB(seed, { life, rift })
          : deriveSuiteC(seed, { tweak, life, rift });

      return {
        ...result,
        tries,
      };
    }
  }
}

export function renderResult(result) {
  return {
    tries: result.tries.toString(),
    feed: formatUw(result.feedAtom),
    comet: result.comet,
  };
}

export {
  deriveSuiteB,
  deriveSuiteC,
  buildFeedAtom,
  buildSuiteBRing,
  buildSuiteCRing,
  cometToPatp,
};
