/* Magic Mirror
 * Recipe sync helper: MMM-MagicReplicator
 *
 * Fetches Paprika recipe details with bounded concurrency and bounded retries
 * so that a single transient network failure cannot discard a whole sync.
 *
 * MIT Licensed.
 */

var DEFAULTS = {
	concurrency: 4,
	maxRetries: 3,
	retryBaseDelayMs: 500,
	retryMaxDelayMs: 8000
};

var TRANSIENT_CODES = [
	"EAI_AGAIN",
	"ECONNABORTED",
	"ECONNREFUSED",
	"ECONNRESET",
	"EHOSTDOWN",
	"EHOSTUNREACH",
	"ENETDOWN",
	"ENETRESET",
	"ENETUNREACH",
	"ENOTFOUND",
	"EPIPE",
	"ESOCKETTIMEDOUT",
	"ETIMEDOUT",
	"ERR_SOCKET_CONNECTION_TIMEOUT"
];

var TRANSIENT_STATUS = [408, 425, 429, 500, 502, 503, 504, 507, 509, 521, 522, 523, 524];

var NOOP_LOGGER = {
	log: function () { },
	warn: function () { }
};

function toPositiveInt(value, fallback, minimum) {
	var parsed = parseInt(value, 10);
	if (isNaN(parsed) || parsed < minimum) {
		return fallback;
	}
	return parsed;
}

function normalizeOptions(options) {
	var opts = options || {};
	return {
		concurrency: toPositiveInt(opts.concurrency, DEFAULTS.concurrency, 1),
		maxRetries: toPositiveInt(opts.maxRetries, DEFAULTS.maxRetries, 0),
		retryBaseDelayMs: toPositiveInt(opts.retryBaseDelayMs, DEFAULTS.retryBaseDelayMs, 0),
		retryMaxDelayMs: toPositiveInt(opts.retryMaxDelayMs, DEFAULTS.retryMaxDelayMs, 0)
	};
}

function errorStatus(error) {
	if (!error || typeof error !== "object") {
		return 0;
	}
	if (typeof error.statusCode === "number") {
		return error.statusCode;
	}
	if (error.response && typeof error.response.statusCode === "number") {
		return error.response.statusCode;
	}
	return 0;
}

function errorCode(error) {
	if (!error || typeof error !== "object") {
		return "";
	}
	if (error.cause && typeof error.cause === "object" && typeof error.cause.code === "string") {
		return error.cause.code;
	}
	if (typeof error.code === "string") {
		return error.code;
	}
	return "";
}

/* describeError(error)
 * Build a short, log-safe description of a failure.
 *
 * Only the error name, network code/syscall and HTTP status are included. The
 * message, stack, `options` and `response` fields are deliberately dropped:
 * request-promise attaches the full authenticated request options (including
 * the Paprika email and password) to every RequestError, and the message of a
 * StatusCodeError is the raw response body, which holds recipe contents.
 */
function describeError(error) {
	if (error === null || error === undefined) {
		return "unknown error";
	}
	if (typeof error !== "object") {
		return "non-error rejection";
	}

	var parts = [];
	parts.push(typeof error.name === "string" && error.name !== "" ? error.name : "Error");

	var code = errorCode(error);
	if (code !== "") {
		parts.push("code=" + code);
	}

	var syscall = error.cause && typeof error.cause === "object" && error.cause.syscall ? error.cause.syscall : error.syscall;
	if (typeof syscall === "string" && syscall !== "") {
		parts.push("syscall=" + syscall);
	}

	var status = errorStatus(error);
	if (status !== 0) {
		parts.push("status=" + status);
	}

	return parts.join(" ");
}

function isAuthError(error) {
	var status = errorStatus(error);
	return status === 401 || status === 403;
}

function isTransientError(error) {
	if (isAuthError(error)) {
		return false;
	}

	var code = errorCode(error);
	if (code !== "" && TRANSIENT_CODES.indexOf(code) !== -1) {
		return true;
	}

	var status = errorStatus(error);
	if (status !== 0) {
		return TRANSIENT_STATUS.indexOf(status) !== -1;
	}

	// A RequestError without a status is a transport-level failure from the
	// request library, which is worth one more attempt.
	return code === "" && error !== null && typeof error === "object" && error.name === "RequestError";
}

function defaultDelay(ms) {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});
}

function backoffDelayMs(attempt, opts) {
	if (opts.retryBaseDelayMs === 0) {
		return 0;
	}
	var exponential = opts.retryBaseDelayMs * Math.pow(2, attempt - 1);
	var capped = Math.min(exponential, opts.retryMaxDelayMs);
	// Full jitter over the lower half of the window, to avoid all workers
	// retrying against Paprika in lockstep.
	return Math.round(capped / 2 + Math.random() * (capped / 2));
}

/* withRetry(task, opts, label, logger, delayFn)
 * Run `task` and retry it on transient failures with exponential backoff.
 * Non-transient failures (bad credentials, 404, ...) reject immediately.
 */
function withRetry(task, opts, label, logger, delayFn) {
	var sleep = delayFn || defaultDelay;
	var attempt = 0;

	function run() {
		attempt += 1;
		return Promise.resolve()
			.then(task)
			.catch(function (error) {
				var retriesLeft = opts.maxRetries - (attempt - 1);
				if (retriesLeft <= 0 || !isTransientError(error)) {
					throw error;
				}
				var waitMs = backoffDelayMs(attempt, opts);
				logger.warn("Retrying " + label + " after " + describeError(error) + " (attempt " + attempt + "/" + (opts.maxRetries + 1) + ", wait " + waitMs + "ms)");
				return sleep(waitMs).then(run);
			});
	}

	return run();
}

/* mapWithConcurrency(items, limit, worker)
 * Resolve `worker` over every item with at most `limit` calls in flight.
 * Results keep the order of `items`.
 */
function mapWithConcurrency(items, limit, worker) {
	var results = new Array(items.length);
	var nextIndex = 0;
	var workerCount = Math.max(1, Math.min(limit, items.length));

	function pump() {
		if (nextIndex >= items.length) {
			return Promise.resolve();
		}
		var index = nextIndex;
		nextIndex += 1;
		return Promise.resolve()
			.then(function () {
				return worker(items[index], index);
			})
			.then(function (result) {
				results[index] = result;
				return pump();
			});
	}

	var runners = [];
	for (var i = 0; i < workerCount; i++) {
		runners.push(pump());
	}

	return Promise.all(runners).then(function () {
		return results;
	});
}

function collectUids(recipeList) {
	if (!Array.isArray(recipeList)) {
		return [];
	}
	var uids = [];
	for (var i = 0; i < recipeList.length; i++) {
		var entry = recipeList[i];
		if (entry && typeof entry.uid === "string" && entry.uid !== "") {
			uids.push(entry.uid);
		}
	}
	return uids;
}

/* syncRecipes({ api, options, logger, delayFn })
 * Fetch the recipe list and then every recipe detail.
 *
 * Rejects only when the recipe list itself cannot be fetched. Detail failures
 * are collected so that a partial sync still returns the recipes that loaded.
 * Resolves with { recipes, requestedCount, failures, aborted, abortReason }.
 */
function syncRecipes(params) {
	var api = params.api;
	var opts = normalizeOptions(params.options);
	var logger = params.logger || NOOP_LOGGER;
	var delayFn = params.delayFn;

	return withRetry(function () {
		return api.recipes();
	}, opts, "recipe list", logger, delayFn).then(function (recipeList) {
		var uids = collectUids(recipeList);
		logger.log("Recipe count is " + uids.length + ", fetching details with concurrency " + opts.concurrency);

		var state = { aborted: false, abortReason: null };
		var failures = [];

		return mapWithConcurrency(uids, opts.concurrency, function (uid) {
			if (state.aborted) {
				return null;
			}
			return withRetry(function () {
				return api.recipe(uid);
			}, opts, "recipe detail", logger, delayFn).catch(function (error) {
				var reason = describeError(error);
				if (isAuthError(error)) {
					// Credentials will not improve by hammering the remaining
					// recipes, so stop the sync here.
					state.aborted = true;
					state.abortReason = reason;
				}
				failures.push({ uid: uid, reason: reason });
				return null;
			});
		}).then(function (details) {
			var recipes = [];
			for (var i = 0; i < details.length; i++) {
				var recipe = details[i];
				if (recipe && recipe.name !== "") {
					recipes.push(recipe);
				}
			}
			return {
				recipes: recipes,
				requestedCount: uids.length,
				failures: failures,
				aborted: state.aborted,
				abortReason: state.abortReason
			};
		});
	});
}

module.exports = {
	DEFAULTS: DEFAULTS,
	describeError: describeError,
	isAuthError: isAuthError,
	isTransientError: isTransientError,
	mapWithConcurrency: mapWithConcurrency,
	normalizeOptions: normalizeOptions,
	syncRecipes: syncRecipes,
	withRetry: withRetry
};
