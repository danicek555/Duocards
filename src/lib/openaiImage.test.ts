import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIllustrationPrompt,
  parseImageTextCheckEnv,
} from "./openaiImage";

test("illustration prompt embeds the scene and stays positive-only", () => {
  const prompt = buildIllustrationPrompt(
    "  a small cozy house with a red roof...  ",
  );
  assert.ok(prompt.includes("a small cozy house with a red roof"));
  assert.ok(prompt.includes("Flat vector illustration"));
  assert.ok(prompt.includes("purely pictorial"));
  // No shouting negations — they make diffusion models render text more often.
  assert.ok(!prompt.includes("NO text"));
  assert.ok(!prompt.includes("CRITICAL"));
  // Whitespace and trailing dots collapsed
  assert.ok(!prompt.includes("  "));
  assert.ok(!prompt.includes("..."));
});

test("text check env defaults to enabled with one retry", () => {
  assert.deepEqual(parseImageTextCheckEnv({}), {
    enabled: true,
    maxRetries: 1,
  });
});

test("text check can be disabled and retries are clamped", () => {
  assert.equal(parseImageTextCheckEnv({ IMAGE_TEXT_CHECK: "off" }).enabled, false);
  assert.equal(parseImageTextCheckEnv({ IMAGE_TEXT_CHECK: " OFF " }).enabled, false);
  assert.equal(parseImageTextCheckEnv({ IMAGE_TEXT_CHECK: "on" }).enabled, true);
  assert.equal(
    parseImageTextCheckEnv({ IMAGE_TEXT_CHECK_MAX_RETRIES: "7" }).maxRetries,
    3,
  );
  assert.equal(
    parseImageTextCheckEnv({ IMAGE_TEXT_CHECK_MAX_RETRIES: "-2" }).maxRetries,
    0,
  );
  assert.equal(
    parseImageTextCheckEnv({ IMAGE_TEXT_CHECK_MAX_RETRIES: "abc" }).maxRetries,
    1,
  );
});
