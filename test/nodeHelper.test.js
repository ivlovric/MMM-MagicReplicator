const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const { describe, it } = require("node:test");

const {
	FAKE_EMAIL,
	FAKE_PASSWORD,
	createFakeApi,
	makeNetworkError,
	makeStatusError
} = require("./helpers/fakePaprikaApi");

const HELPER_PATH = path.join(__dirname, "..", "node_helper.js");

/* loadHelperDefinition(paprikaModule)
 * Load node_helper.js with `node_helper` and `paprika-api` stubbed out, so the
 * helper can be exercised without MagicMirror or network access.
 */
function loadHelperDefinition(paprikaModule) {
	delete require.cache[require.resolve(HELPER_PATH)];
	const originalRequire = Module.prototype.require;
	Module.prototype.require = function (id) {
		if (id === "node_helper") {
			return { create: (definition) => definition };
		}
		if (id === "paprika-api") {
			return paprikaModule;
		}
		return originalRequire.apply(this, arguments);
	};
	try {
		return require(HELPER_PATH);
	} finally {
		Module.prototype.require = originalRequire;
	}
}

function fakePaprikaModule(api) {
	const created = [];
	class PaprikaApi {
		constructor(email, password) {
			created.push({ email, password });
			this.recipes = () => api.recipes();
			this.recipe = (uid) => api.recipe(uid);
		}
	}
	return { module: { PaprikaApi }, created };
}

/* createHelper(api)
 * Build a helper instance wired to `api`, capturing every socket notification
 * and every console line the helper writes.
 */
function createHelper(api) {
	const paprika = fakePaprikaModule(api);
	const definition = loadHelperDefinition(paprika.module);

	const notifications = [];
	const logLines = [];
	const helper = Object.create(definition);
	helper.name = "MMM-MagicReplicator";
	helper.sendSocketNotification = (notification, payload) => {
		notifications.push({ notification, payload });
	};

	const originalLog = console.log;
	console.log = (...args) => {
		logLines.push(args.map((arg) => (typeof arg === "string" ? arg : require("node:util").inspect(arg, { depth: 10 }))).join(" "));
	};
	try {
		helper.start();
	} finally {
		console.log = originalLog;
	}

	const receive = (notification, payload) => {
		const previousLog = console.log;
		console.log = (...args) => {
			logLines.push(args.map((arg) => (typeof arg === "string" ? arg : require("node:util").inspect(arg, { depth: 10 }))).join(" "));
		};
		try {
			helper.socketNotificationReceived(notification, payload);
		} finally {
			// Async continuations keep logging after this returns, so the
			// capture stays installed until the test tears it down.
			helper.restoreLog = () => {
				console.log = previousLog;
			};
		}
	};

	return {
		helper,
		notifications,
		logLines,
		created: paprika.created,
		receive,
		restore: () => {
			console.log = originalLog;
		}
	};
}

async function waitForNotification(notifications, timeoutMs = 10000) {
	const started = Date.now();
	while (notifications.length === 0) {
		if (Date.now() - started > timeoutMs) {
			throw new Error("timed out waiting for a socket notification");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	return notifications[0];
}

const PAPRIKA_PAYLOAD = {
	instanceId: "module_1",
	email: FAKE_EMAIL,
	password: FAKE_PASSWORD,
	maxConcurrentRequests: 4,
	maxRetries: 3,
	retryBaseDelayMs: 0
};

function assertNoSecretsLeaked(logLines) {
	const combined = logLines.join("\n");
	assert.ok(!combined.includes(FAKE_PASSWORD), "password leaked into the logs");
	assert.ok(!combined.includes(FAKE_EMAIL), "email leaked into the logs");
	assert.ok(!combined.includes("secret-ingredient"), "recipe ingredients leaked into the logs");
	assert.ok(!combined.includes("secret-directions"), "recipe directions leaked into the logs");
	assert.ok(!combined.includes("paprikaapp.com"), "authenticated request options leaked into the logs");
}

describe("node_helper PAPRIKA_RECIPE_GET", () => {
	it("delivers all 223 recipes to the frontend", async () => {
		const api = createFakeApi({ recipeCount: 223 });
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		const sent = await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(sent.notification, "PAPRIKA_RECIPE_DATA");
		assert.equal(sent.payload.length, 223);
		assert.equal(ctx.created.length, 1);
		assert.deepEqual(ctx.created[0], { email: FAKE_EMAIL, password: FAKE_PASSWORD });
		assertNoSecretsLeaked(ctx.logLines);
	});

	it("honours the configured concurrency bound", async () => {
		const api = createFakeApi({ recipeCount: 223 });
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", Object.assign({}, PAPRIKA_PAYLOAD, { maxConcurrentRequests: 2 }));
		await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(api.maxInFlight, 2);
	});

	it("still delivers 223 recipes when every request resets once", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid, attempt) => (attempt === 1 ? makeNetworkError("ECONNRESET", "recipe/" + uid) : { uid, name: "Recipe " + uid })
		});
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		const sent = await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(sent.notification, "PAPRIKA_RECIPE_DATA");
		assert.equal(sent.payload.length, 223);
		assert.equal(api.detailCalls, 223 * 2);
		assertNoSecretsLeaked(ctx.logLines);
	});

	it("reports a sanitized error when every recipe detail fails permanently", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid) => makeNetworkError("ECONNRESET", "recipe/" + uid)
		});
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", Object.assign({}, PAPRIKA_PAYLOAD, { maxRetries: 1 }));
		const sent = await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(sent.notification, "PAPRIKA_RECIPE_ERROR");
		assert.match(sent.payload.reason, /All 223 Paprika recipe details failed/);
		assert.match(sent.payload.reason, /223x RequestError code=ECONNRESET syscall=read/);
		assert.ok(!sent.payload.reason.includes(FAKE_PASSWORD));
		assert.equal(api.detailCalls, 223 * 2);
		assertNoSecretsLeaked(ctx.logLines);
	});

	it("reports a sanitized error when the recipe list itself is unreachable", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			listHandler: () => makeNetworkError("ECONNRESET", "recipes")
		});
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", Object.assign({}, PAPRIKA_PAYLOAD, { maxRetries: 1 }));
		const sent = await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(sent.notification, "PAPRIKA_RECIPE_ERROR");
		assert.equal(sent.payload.reason, "Could not reach Paprika (RequestError code=ECONNRESET syscall=read)");
		assert.equal(api.listCalls, 2);
		assertNoSecretsLeaked(ctx.logLines);
	});

	it("delivers the recipes that loaded when only some fail permanently", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid) => (uid === "uid-7" ? makeNetworkError("ECONNRESET", "recipe/" + uid) : { uid, name: "Recipe " + uid })
		});
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		const sent = await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(sent.notification, "PAPRIKA_RECIPE_DATA");
		assert.equal(sent.payload.length, 222);
		assertNoSecretsLeaked(ctx.logLines);
	});

	it("reports bad credentials without retrying every recipe", async () => {
		const api = createFakeApi({
			recipeCount: 223,
			detailHandler: (uid) => makeStatusError(401, { error: { message: "Unauthorized" } }, "recipe/" + uid)
		});
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		const sent = await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(sent.notification, "PAPRIKA_RECIPE_ERROR");
		assert.match(sent.payload.reason, /StatusCodeError status=401/);
		assert.ok(api.detailCalls <= 4, `expected at most 4 requests, saw ${api.detailCalls}`);
		assertNoSecretsLeaked(ctx.logLines);
	});

	it("notifies the frontend instead of crashing when credentials are missing", async () => {
		const api = createFakeApi({ recipeCount: 223 });
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", { instanceId: "module_1", email: "", password: "" });
		ctx.restore();

		assert.deepEqual(ctx.notifications, [{ notification: "PAPRIKA_RECIPE_ERROR", payload: { reason: "No Paprika email configured" } }]);
		assert.equal(ctx.created.length, 0);
		assert.equal(api.listCalls, 0);
	});

	it("notifies the frontend when the password is missing", async () => {
		const api = createFakeApi({ recipeCount: 223 });
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", { instanceId: "module_1", email: FAKE_EMAIL, password: "" });
		ctx.restore();

		assert.deepEqual(ctx.notifications, [{ notification: "PAPRIKA_RECIPE_ERROR", payload: { reason: "No Paprika password configured" } }]);
		assert.equal(api.listCalls, 0);
	});

	it("ignores a refresh while a sync is still running, and accepts the next one", async () => {
		const api = createFakeApi({ recipeCount: 20 });
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		ctx.helper.socketNotificationReceived("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		await waitForNotification(ctx.notifications);

		assert.equal(ctx.notifications.length, 1);
		assert.equal(api.listCalls, 1, "the overlapping refresh must not start a second sync");
		assert.equal(ctx.helper.outstandingRequest, false, "the guard must be released after the sync");

		ctx.notifications.length = 0;
		ctx.helper.socketNotificationReceived("PAPRIKA_RECIPE_GET", PAPRIKA_PAYLOAD);
		await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(api.listCalls, 2);
	});

	it("releases the guard after a failed sync so the next refresh can retry", async () => {
		const api = createFakeApi({
			recipeCount: 5,
			listHandler: () => makeNetworkError("ECONNRESET", "recipes")
		});
		const ctx = createHelper(api);

		ctx.receive("PAPRIKA_RECIPE_GET", Object.assign({}, PAPRIKA_PAYLOAD, { maxRetries: 0 }));
		await waitForNotification(ctx.notifications);
		ctx.restore();

		assert.equal(ctx.helper.outstandingRequest, false);
	});
});

describe("node_helper other notifications", () => {
	it("loads the bundled local recipe file", async () => {
		const ctx = createHelper(createFakeApi({ recipeCount: 0 }));

		ctx.receive("LOCAL_RECIPE_GET", { instanceId: "module_1" });
		ctx.restore();

		const sent = ctx.notifications[0];
		assert.equal(sent.notification, "LOCAL_RECIPE_DATA");
		assert.ok(sent.payload.length > 0);
		assert.ok(sent.payload.every((recipe) => recipe.name !== ""));
	});

	it("falls back to NULL for an unknown notification without throwing", async () => {
		const ctx = createHelper(createFakeApi({ recipeCount: 0 }));

		ctx.receive("SOMETHING_ELSE", {});
		ctx.restore();

		assert.deepEqual(ctx.notifications, [{ notification: "NULL", payload: "NULL" }]);
	});
});
