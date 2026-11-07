/* Test doubles for the Paprika API.
 *
 * The errors built here mirror the shape that request-promise-native actually
 * produces, including the `options` field that carries the authenticated
 * request (email + password) and the StatusCodeError message that embeds the
 * raw response body. Tests rely on that to prove nothing sensitive is logged.
 */

const FAKE_EMAIL = "mirror-owner@example.com";
const FAKE_PASSWORD = "sup3r-s3cret-paprika-pw";

function fakeRequestOptions(uri) {
	return {
		auth: { user: FAKE_EMAIL, pass: FAKE_PASSWORD },
		method: "GET",
		baseUrl: "https://www.paprikaapp.com/api/v1/sync/",
		uri: uri,
		json: true,
		headers: { "User-Agent": "PaprikaApi NodeJS library" }
	};
}

function makeNetworkError(code, uri) {
	const cause = new Error("read " + code);
	cause.code = code;
	cause.errno = -104;
	cause.syscall = "read";

	const error = new Error("Error: read " + code);
	error.name = "RequestError";
	error.cause = cause;
	error.error = cause;
	error.options = fakeRequestOptions(uri || "recipe/uid-0");
	error.response = undefined;
	return error;
}

function makeStatusError(statusCode, body, uri) {
	const error = new Error(statusCode + " - " + JSON.stringify(body));
	error.name = "StatusCodeError";
	error.statusCode = statusCode;
	error.error = body;
	error.options = fakeRequestOptions(uri || "recipe/uid-0");
	error.response = { statusCode: statusCode, body: body };
	return error;
}

function tick() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildRecipeList(count) {
	const list = [];
	for (let i = 0; i < count; i++) {
		list.push({ uid: "uid-" + i, hash: "hash-" + i });
	}
	return list;
}

function buildRecipe(uid) {
	return {
		uid: uid,
		name: "Recipe " + uid,
		ingredients: "secret-ingredient-" + uid,
		directions: "secret-directions-" + uid,
		nutritional_info: "Calories: 250\nTotal Fat: 10g",
		servings: "4 servings",
		on_favorites: uid.endsWith("0"),
		rating: 4
	};
}

/* createFakeApi({ recipeCount, listHandler, detailHandler })
 *
 * `listHandler(attempt)` and `detailHandler(uid, attempt)` return either a
 * value to resolve with or an Error to reject with. Both default to success.
 * The instance records call counts and the peak number of in-flight requests.
 */
function createFakeApi(config) {
	const options = config || {};
	const recipeCount = typeof options.recipeCount === "number" ? options.recipeCount : 223;
	const list = options.list || buildRecipeList(recipeCount);

	const api = {
		list: list,
		listCalls: 0,
		detailCalls: 0,
		attemptsByUid: new Map(),
		inFlight: 0,
		maxInFlight: 0,

		recipes: async function () {
			api.listCalls += 1;
			const attempt = api.listCalls;
			await tick();
			const outcome = options.listHandler ? options.listHandler(attempt) : list;
			if (outcome instanceof Error) {
				throw outcome;
			}
			return outcome;
		},

		recipe: async function (uid) {
			api.detailCalls += 1;
			const attempt = (api.attemptsByUid.get(uid) || 0) + 1;
			api.attemptsByUid.set(uid, attempt);

			api.inFlight += 1;
			api.maxInFlight = Math.max(api.maxInFlight, api.inFlight);
			try {
				// Two macrotask hops, so a concurrency breach is observable
				// rather than hidden by microtask ordering.
				await tick();
				await tick();
				const outcome = options.detailHandler ? options.detailHandler(uid, attempt) : buildRecipe(uid);
				if (outcome instanceof Error) {
					throw outcome;
				}
				return outcome;
			} finally {
				api.inFlight -= 1;
			}
		}
	};

	return api;
}

module.exports = {
	FAKE_EMAIL,
	FAKE_PASSWORD,
	buildRecipe,
	buildRecipeList,
	createFakeApi,
	makeNetworkError,
	makeStatusError,
	tick
};
