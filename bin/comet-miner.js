#!/usr/bin/env node

import {
  mineComet,
  parsePatpWord,
  renderResult,
} from '../src/cometMiner.js';

function printHelp() {
  console.log('Usage: comet-miner [-b | -c] [options] [star ...]');
  console.log('');
  console.log('Options:');
  console.log('  -b, --suite-b         Mine a crypto suite B comet');
  console.log('  -c, --suite-c         Mine a crypto suite C comet');
  console.log('  -t, --tweak <atom>    Tweak atom for suite C');
  console.log('  -l, --life <n>        Life value (default: 1)');
  console.log('  -r, --rift <n>        Rift value (default: 0)');
  console.log('  -p, --prefix <star>   Require the final 16-bit chunk to match a star');
  console.log('  -a, --any-star        Ignore positional star filters');
  console.log('  -h, --help            Show this help');
}

function parseArgs(argv) {
  const out = {
    suite: null,
    tweak: 0n,
    life: 1,
    rift: 0,
    prefix: null,
    anyStar: false,
    stars: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      case '-b':
      case '--suite-b':
        out.suite = 'b';
        break;
      case '-c':
      case '--suite-c':
        out.suite = 'c';
        break;
      case '-t':
      case '--tweak':
        i += 1;
        out.tweak = argv[i];
        break;
      case '-l':
      case '--life':
        i += 1;
        out.life = Number.parseInt(argv[i], 10);
        break;
      case '-r':
      case '--rift':
        i += 1;
        out.rift = Number.parseInt(argv[i], 10);
        break;
      case '-p':
      case '--prefix':
        i += 1;
        out.prefix = parsePatpWord(argv[i]);
        break;
      case '-a':
      case '--any-star':
        out.anyStar = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`unknown option: ${arg}`);
        }
        out.stars.push(parsePatpWord(arg));
        break;
    }
  }

  if (out.suite === null) {
    throw new Error('choose exactly one of --suite-b or --suite-c');
  }
  if (out.suite === 'b' && out.tweak !== 0n) {
    throw new Error('tweak is only valid with suite C');
  }
  if (out.anyStar && out.stars.length > 0) {
    throw new Error('positional stars cannot be combined with --any-star');
  }

  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = mineComet({
    suite: args.suite,
    tweak: args.tweak,
    life: args.life,
    rift: args.rift,
    prefix: args.prefix,
    stars: args.anyStar || args.stars.length === 0 ? null : new Set(args.stars),
  });
  const rendered = renderResult(result);

  console.log(`tries: ${rendered.tries}`);
  console.log(`feed: ${rendered.feed}`);
  console.log(`comet: ${rendered.comet}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
