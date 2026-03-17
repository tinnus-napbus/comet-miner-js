import { mineComet, parsePatpWord, renderResult } from '../src/cometMinerBrowser.js';

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (type !== 'start') {
    return;
  }

  try {
    const stars = payload.anyStar
      ? null
      : payload.stars
          .map((star) => star.trim())
          .filter(Boolean)
          .map(parsePatpWord);

    const result = mineComet({
      suite: payload.suite,
      tweak: payload.tweak,
      prefix: payload.prefix ? parsePatpWord(payload.prefix) : null,
      stars,
      onProgress: ({ tries }) => {
        self.postMessage({ type: 'progress', tries });
      },
    });

    self.postMessage({
      type: 'result',
      result: renderResult(result),
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
