import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../frontend/functions/api/[[path]].js", import.meta.url), "utf8");
const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

class Database {
  constructor() { this.cache = new Map(); }
  prepare(sql) {
    const database = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes("INSERT INTO lookup_cache")) database.cache.set(this.values[0], { body: this.values[1], fetchedAt: this.values[2] });
        return { meta: { changes: 0 } };
      },
      async all() { return { results: [] }; },
      async first() { return sql.includes("SELECT body, fetched_at") ? database.cache.get(this.values[0]) || null : null; }
    };
  }
}

const database = new Database();
const origin = "https://catalogue.example";

async function session(env) {
  const response = await onRequest({
    request: new Request(`${origin}/api/admin/login`, {
      method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD })
    }), env, params: { path: ["admin", "login"] }
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

async function m6a(env, cookie) {
  return onRequest({
    request: new Request(`${origin}/api/admin/tcggo/sets/M6a`, { headers: { cookie } }),
    env, params: { path: ["admin", "tcggo", "sets", "M6a"] }
  });
}

test("explains how to recover when the TCGGO key is absent", async () => {
  const env = { ADMIN_PASSWORD: "a-secure-test-password", DB: database };
  const response = await m6a(env, await session(env));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Japanese 30th Celebration lookup is not configured yet" });
});

test("normalises and paginates the Japanese M6a response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const page = Number(new URL(input).searchParams.get("page"));
    const start = page === 1 ? 1 : 51;
    const length = page === 1 ? 50 : 1;
    const data = Array.from({ length }, (_, index) => ({
      id: start + index,
      name: index === 0 && page === 1 ? "ブラッキー (Umbreon)" : `Card ${start + index}`,
      card_number: String(start + index).padStart(3, "0"),
      rarity: index === 0 && page === 1 ? "Futuristic Rare" : "Common",
      image: `https://images.example/${start + index}.webp`
    }));
    return Response.json({ data, paging: { current: page, per_page: 50, results: 51 } });
  };

  try {
    const env = { ADMIN_PASSWORD: "a-secure-test-password", DB: database, TCGGO_API_KEY: "test-key" };
    const response = await m6a(env, await session(env));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.id, "M6a");
    assert.equal(body.cardCount.official, 103);
    assert.equal(body.cardCount.total, 51);
    assert.equal(body.cards.length, 51);
    assert.deepEqual(body.cards[0], {
      id: "tcggo-1", localId: "001", name: "ブラッキー (Umbreon)", englishName: "Umbreon",
      rarity: "Futuristic Rare", imageUrl: "https://images.example/1.webp", provider: "tcggo"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
