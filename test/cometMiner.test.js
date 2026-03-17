import test from 'node:test';
import assert from 'node:assert/strict';

import { Atom, dwim, jam } from '@urbit/nockjs';

import { deriveSuiteB, deriveSuiteC, mineComet, normalizeStars, normalizeTweak, parseAtomText, parsePatpWord, renderResult } from '../src/cometMiner.js';

test('parsePatpWord parses star-sized names via urbit-ob', () => {
  assert.equal(parsePatpWord('marbud'), 258);
  assert.equal(parsePatpWord('~zod'), 0);
});

test('parseAtomText accepts a JSON array of atom literals and jams the resulting list', () => {
  const expected = jam(dwim([42n, 123456789n, 0n, Atom.zero])).number;
  assert.equal(parseAtomText('["42", "0w7mYQl", "~zod"]'), expected);
});

test('normalizeTweak accepts programmatic arrays of atom literals', () => {
  const expected = jam(dwim([42n, 123456789n, 0n, Atom.zero])).number;
  assert.equal(normalizeTweak(['42', '0w7mYQl', '~zod']), expected);
});

test('normalizeStars accepts single stars and lists of stars', () => {
  assert.deepEqual([...normalizeStars('marbud')], [258]);
  assert.deepEqual([...normalizeStars(['marbud', '~zod'])], [258, 0]);
});

test('mineComet accepts tweak arrays programmatically', () => {
  const seed = new Uint8Array(64);
  seed[0] = 1;
  const tweak = ['42', '0w7mYQl', '~zod'];
  const expectedSeed = Uint8Array.from(seed);
  expectedSeed[0] = 2;
  const expected = deriveSuiteC(expectedSeed, { tweak: normalizeTweak(tweak) });
  const actual = mineComet({
    suite: 'c',
    tweak,
    startSeed: Uint8Array.from(seed),
    stars: null,
  });

  assert.equal(actual.comet, expected.comet);
  assert.equal(actual.feedAtom, expected.feedAtom);
});

test('mineComet accepts star lists programmatically and matches any of them', () => {
  const seed = Uint8Array.from({ length: 64 }, (_, i) => i);
  const expectedSeed = Uint8Array.from(seed);
  expectedSeed[0] += 1;
  const expected = deriveSuiteB(expectedSeed);
  const actual = mineComet({
    suite: 'b',
    startSeed: Uint8Array.from(seed),
    stars: ['~zod', expected.star],
  });

  assert.equal(actual.comet, expected.comet);
  assert.equal(actual.feedAtom, expected.feedAtom);
});

test('prefix matches the leading comet word', () => {
  const seed = Uint8Array.from({ length: 64 }, (_, i) => i);
  const expectedSeed = Uint8Array.from(seed);
  expectedSeed[0] += 1;
  const expected = deriveSuiteB(expectedSeed);

  assert.equal(expected.prefix, parsePatpWord('sitsul'));

  const actual = mineComet({
    suite: 'b',
    startSeed: Uint8Array.from(seed),
    prefix: parsePatpWord('sitsul'),
    stars: null,
  });

  assert.equal(actual.comet, expected.comet);
  assert.equal(actual.feedAtom, expected.feedAtom);
});

test('suite B derivation matches the reference snapshot for a fixed seed', () => {
  const seed = Uint8Array.from({ length: 64 }, (_, i) => i);
  const rendered = renderResult({ ...deriveSuiteB(seed), tries: 1n });

  assert.deepEqual(rendered, {
    tries: '1',
    feed: '0w2ADc.fyjp5.ObENS.alE1O.H65OF.YLm3H.GaJia.2Yssw.v0XXi.zEQ5g.twSew.2~nEn.te7HN.77o00.V2pn1.ByvJD.ZvRA2.7T8g7.w0NpE.Tb2oE.pBavl.tom8a.NkOT1.-w3i5',
    comet: '~tabseb-havfep-labtyr-sicwyt--naprex-nopneb-saptev-bolduc',
  });
});

test('suite C derivation matches the reference snapshot for a fixed seed and tweak', () => {
  const seed = Uint8Array.from({ length: 64 }, (_, i) => i);
  const rendered = renderResult({ ...deriveSuiteC(seed, { tweak: 42n }), tries: 1n });

  assert.deepEqual(rendered, {
    tries: '1',
    feed: '0wa.Gx9eo.v4COb.AnhzI.kHg3B.mcbBj.VuI7n.klqAk.5UUV0.-1TSB.7hEaw.X1It0.5-LgK.Wsfny.eeM01.O4OK3.b4~rf.W~H84.fKgMF.01yPy.EYnnh.k~Rk0.QsIe0.AHFbg.~w3i5',
    comet: '~botsyl-hobdes-locnet-rossec--sabryt-havrem-livhut-docnyd',
  });
});
