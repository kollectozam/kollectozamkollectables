import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../frontend/data/m6a.json", import.meta.url), "utf8"));
const quickAdd = await readFile(new URL("../frontend/assets/js/quick-add.js", import.meta.url), "utf8");

test("bundles the complete Japanese M6a lookup index", () => {
  assert.equal(data.id, "M6a");
  assert.equal(data.provider, "bundled");
  assert.equal(data.cardCount.official, 103);
  assert.equal(data.cardCount.total, data.cards.length);
  assert.equal(data.cards.length, 176);
  assert.equal(new Set(data.cards.map((card) => card.localId)).size, data.cards.length);
  assert.deepEqual(data.cards[0], {
    id: "m6a-001",
    localId: "001",
    name: "タマタマ",
    rarity: "None",
    dexId: [102]
  });
});

test("uses bundled M6a data instead of the TCGGO endpoint", () => {
  assert.match(quickAdd, /\? "\/data\/m6a\.json"/);
  assert.doesNotMatch(quickAdd, /api\/admin\/tcggo/);
});
