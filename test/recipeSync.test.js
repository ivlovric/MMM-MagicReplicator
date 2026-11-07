const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const RecipeSync = require("../lib/recipeSync");
const {
	FAKE_EMAIL,
	FAKE_PASSWORD,
	createFakeApi,
	makeNetworkError,
	makeStatusError
} = require("./helpers/fakePaprikaApi");

const FAST = { concurrency: 4, maxRetries: 3, retryBaseDelayMs: 0 };

function silentLogger() {
	const lines = [];
	return {
		lines,
		log: (message) => lines.push(message),
		warn: (message) => lines.push(message)
	};
}

describe("syncRecipes - full success", () => {
	it("returns all 223 recipes in list order", async () => {
		const api = createFakeApi({ recipeCount: 223 });

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.requestedCount, 223);
		assert.equal(result.recipes.length, 223);
		assert.deepEqual(result.failures, []);
		assert.equal(result.aborted, false);
		assert.equal(api.detailCalls, 223);
		assert.equal(result.recipes[0].uid, "uid-0");
		assert.equal(result.recipes[222].uid, "uid-222");
		assert.deepEqual(
			result.recipes.map((recipe) => recipe.uid),
			api.list.map((entry) => entry.uid)
		);
	});

	it("drops recipes with an empty name, as before", async () => {
		const api = createFakeApi({
			recipeCount: 3,
			detailHandler: (uid) => ({ uid, name: uid === "uid-1" ? "" : "Recipe " + uid })
		});

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.requestedCount, 3);
		assert.deepEqual(result.recipes.map((recipe) => recipe.uid), ["uid-0", "uid-2"]);
	});

	it("ignores list entries without a usable uid", async () => {
		const api = createFakeApi({ list: [{ uid: "uid-0" }, { uid: "" }, {}, null, { uid: "uid-1" }] });

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.requestedCount, 2);
		assert.equal(api.detailCalls, 2);
	});
});

describe("syncRecipes - concurrency bound", () => {
	for (const concurrency of [1, 4, 8]) {
		it(`keeps at most ${concurrency} detail requests in flight for 223 recipes`, async () => {
			const api = createFakeApi({ recipeCount: 223 });

			const result = await RecipeSync.syncRecipes({
				api,
				options: { concurrency, maxRetries: 0, retryBaseDelayMs: 0 },
				logger: silentLogger()
			});

			assert.equal(result.recipes.length, 223);
			assert.ok(api.maxInFlight <= concurrency, `peak in-flight ${api.maxInFlight} exceeded ${concurrency}`);
			assert.equal(api.maxInFlight, concurrency, "pool should saturate the configured concurrency");
		});
	}

	it("does not start more workers than there are recipes", async () => {
		const api = createFakeApi({ recipeCount: 2 });

		await RecipeSync.syncRecipes({ api, options: { concurrency: 16, maxRetries: 0, retryBaseDelayMs: 0 }, logger: silentLogger() });

		assert.equal(api.maxInFlight, 2);
	});

	it("falls back to the default concurrency for invalid values", async () => {
		const api = createFakeApi({ recipeCount: 223 });

		await RecipeSync.syncRecipes({
			api,
			options: { concurrency: 0, maxRetries: 0, retryBaseDelayMs: 0 },
			logger: silentLogger()
		});

		assert.equal(api.maxInFlight, RecipeSync.DEFAULTS.concurrency);
	});
});

describe("syncRecipes - transient failure recovery", () => {
	it("recovers all 223 recipes when every detail request resets twice first", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid, attempt) => {
				if (attempt <= 2) {
					return makeNetworkError("ECONNRESET", "recipe/" + uid);
				}
				return { uid, name: "Recipe " + uid };
			}
		});

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.recipes.length, 223);
		assert.deepEqual(result.failures, []);
		assert.equal(api.detailCalls, 223 * 3);
	});

	it("recovers the recipe list itself after a transient reset", async () => {
		const api = createFakeApi({
			recipeCount: 5,
			listHandler: (attempt) => (attempt === 1 ? makeNetworkError("ECONNRESET", "recipes") : api.list)
		});

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(api.listCalls, 2);
		assert.equal(result.recipes.length, 5);
	});

	it("retries a 503 and a 429 but not a 404", async () => {
		const api = createFakeApi({
			recipeCount: 3,
			detailHandler: (uid, attempt) => {
				if (uid === "uid-0") {
					return attempt === 1 ? makeStatusError(503, "busy", "recipe/" + uid) : { uid, name: "Recipe " + uid };
				}
				if (uid === "uid-1") {
					return attempt === 1 ? makeStatusError(429, "slow down", "recipe/" + uid) : { uid, name: "Recipe " + uid };
				}
				return makeStatusError(404, "missing", "recipe/" + uid);
			}
		});

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.deepEqual(result.recipes.map((recipe) => recipe.uid), ["uid-0", "uid-1"]);
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].uid, "uid-2");
		// uid-2 must be attempted exactly once: a 404 is not transient.
		assert.equal(api.attemptsByUid.get("uid-2"), 1);
	});

	it("backs off exponentially with jitter, capped at retryMaxDelayMs", async () => {
		const waits = [];
		const api = createFakeApi({
			recipeCount: 1,
			detailHandler: (uid, attempt) => (attempt <= 4 ? makeNetworkError("ECONNRESET") : { uid, name: "ok" })
		});

		const result = await RecipeSync.syncRecipes({
			api,
			options: { concurrency: 1, maxRetries: 4, retryBaseDelayMs: 100, retryMaxDelayMs: 400 },
			logger: silentLogger(),
			delayFn: (ms) => {
				waits.push(ms);
				return Promise.resolve();
			}
		});

		assert.equal(result.recipes.length, 1);
		assert.equal(waits.length, 4);
		const bounds = [[50, 100], [100, 200], [200, 400], [200, 400]];
		waits.forEach((wait, index) => {
			const [low, high] = bounds[index];
			assert.ok(wait >= low && wait <= high, `wait ${wait} outside [${low}, ${high}] at retry ${index + 1}`);
		});
	});
});

describe("syncRecipes - permanent failure", () => {
	it("stops after the retry budget and reports every failed recipe", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid) => makeNetworkError("ECONNRESET", "recipe/" + uid)
		});

		const result = await RecipeSync.syncRecipes({
			api,
			options: { concurrency: 4, maxRetries: 2, retryBaseDelayMs: 0 },
			logger: silentLogger()
		});

		assert.equal(result.recipes.length, 0);
		assert.equal(result.requestedCount, 223);
		assert.equal(result.failures.length, 223);
		// 1 initial attempt + 2 retries per recipe, and no more.
		assert.equal(api.detailCalls, 223 * 3);
		assert.equal(api.attemptsByUid.get("uid-0"), 3);
		assert.equal(result.failures[0].reason, "RequestError code=ECONNRESET syscall=read");
	});

	it("keeps the recipes that did load when only some fail permanently", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid) => {
				const index = Number(uid.split("-")[1]);
				if (index % 10 === 0) {
					return makeNetworkError("ECONNRESET", "recipe/" + uid);
				}
				return { uid, name: "Recipe " + uid };
			}
		});

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.failures.length, 23);
		assert.equal(result.recipes.length, 200);
		assert.equal(result.aborted, false);
	});

	it("rejects when the recipe list cannot be fetched at all", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			listHandler: () => makeNetworkError("ECONNRESET", "recipes")
		});

		await assert.rejects(
			RecipeSync.syncRecipes({ api, options: { concurrency: 4, maxRetries: 3, retryBaseDelayMs: 0 }, logger: silentLogger() }),
			(error) => error.name === "RequestError"
		);

		assert.equal(api.listCalls, 4);
		assert.equal(api.detailCalls, 0);
	});

	it("aborts immediately on an auth failure instead of hammering 223 recipes", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid) => makeStatusError(401, "Unauthorized", "recipe/" + uid)
		});

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.aborted, true);
		assert.equal(result.abortReason, "StatusCodeError status=401");
		assert.equal(result.recipes.length, 0);
		assert.ok(api.detailCalls <= FAST.concurrency, `expected at most ${FAST.concurrency} requests, saw ${api.detailCalls}`);
		assert.equal(api.attemptsByUid.get("uid-0"), 1, "auth failures must not be retried");
	});

	it("handles an empty recipe collection", async () => {
		const api = createFakeApi({ list: [] });

		const result = await RecipeSync.syncRecipes({ api, options: FAST, logger: silentLogger() });

		assert.equal(result.requestedCount, 0);
		assert.equal(result.recipes.length, 0);
		assert.equal(api.detailCalls, 0);
	});
});

describe("describeError", () => {
	it("never exposes credentials or the authenticated request", () => {
		const described = RecipeSync.describeError(makeNetworkError("ECONNRESET", "recipe/uid-0"));

		assert.equal(described, "RequestError code=ECONNRESET syscall=read");
		assert.ok(!described.includes(FAKE_PASSWORD));
		assert.ok(!described.includes(FAKE_EMAIL));
		assert.ok(!described.includes("auth"));
	});

	it("never exposes the response body of a status error", () => {
		const body = { result: { name: "Grandma's Secret Pie", ingredients: "4 secret apples" } };
		const described = RecipeSync.describeError(makeStatusError(500, body, "recipe/uid-0"));

		assert.equal(described, "StatusCodeError status=500");
		assert.ok(!described.includes("Grandma"));
		assert.ok(!described.includes("secret apples"));
		assert.ok(!described.includes(FAKE_PASSWORD));
	});

	it("degrades safely for odd rejection values", () => {
		assert.equal(RecipeSync.describeError(null), "unknown error");
		assert.equal(RecipeSync.describeError(undefined), "unknown error");
		assert.equal(RecipeSync.describeError("boom"), "non-error rejection");
		assert.equal(RecipeSync.describeError(new Error("plain")), "Error");
	});
});

describe("isTransientError", () => {
	const transient = ["ECONNRESET", "ETIMEDOUT", "EPIPE", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED", "ESOCKETTIMEDOUT"];
	for (const code of transient) {
		it(`treats ${code} as transient`, () => {
			assert.equal(RecipeSync.isTransientError(makeNetworkError(code)), true);
		});
	}

	for (const status of [408, 429, 500, 502, 503, 504]) {
		it(`treats HTTP ${status} as transient`, () => {
			assert.equal(RecipeSync.isTransientError(makeStatusError(status, "nope")), true);
		});
	}

	for (const status of [400, 401, 403, 404, 410]) {
		it(`treats HTTP ${status} as permanent`, () => {
			assert.equal(RecipeSync.isTransientError(makeStatusError(status, "nope")), false);
		});
	}

	it("flags 401 and 403 as auth errors", () => {
		assert.equal(RecipeSync.isAuthError(makeStatusError(401, "nope")), true);
		assert.equal(RecipeSync.isAuthError(makeStatusError(403, "nope")), true);
		assert.equal(RecipeSync.isAuthError(makeStatusError(500, "nope")), false);
	});

	it("does not retry a programming error", () => {
		assert.equal(RecipeSync.isTransientError(new TypeError("undefined is not a function")), false);
	});
});

describe("normalizeOptions", () => {
	it("applies defaults for missing and invalid values", () => {
		assert.deepEqual(RecipeSync.normalizeOptions(undefined), RecipeSync.DEFAULTS);
		assert.deepEqual(RecipeSync.normalizeOptions({ concurrency: -2, maxRetries: "abc" }), RecipeSync.DEFAULTS);
	});

	it("keeps valid overrides, including zero retries", () => {
		const opts = RecipeSync.normalizeOptions({ concurrency: 2, maxRetries: 0, retryBaseDelayMs: 0, retryMaxDelayMs: 50 });

		assert.deepEqual(opts, { concurrency: 2, maxRetries: 0, retryBaseDelayMs: 0, retryMaxDelayMs: 50 });
	});
});

describe("mapWithConcurrency", () => {
	it("preserves input order while running out of order", async () => {
		const items = [40, 10, 30, 20, 0];
		const results = await RecipeSync.mapWithConcurrency(items, 3, (value) =>
			new Promise((resolve) => setTimeout(() => resolve(value * 2), value))
		);

		assert.deepEqual(results, [80, 20, 60, 40, 0]);
	});

	it("handles an empty input list", async () => {
		assert.deepEqual(await RecipeSync.mapWithConcurrency([], 4, () => Promise.resolve(1)), []);
	});
});
