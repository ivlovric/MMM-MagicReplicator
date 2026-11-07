/* Magic Mirror
 * Node Helper: MMM-MagicReplicator
 *
 * By 
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var PaprikaApi = require("paprika-api");
var RecipeSync = require("./lib/recipeSync");

module.exports = NodeHelper.create({

	start: function () {
		console.log("Starting node_helper for module [" + this.name + "]");
		this.paprikaApi = null;
		this.RecipeFile = null;
		this.outstandingRequest = false;
	},


	getData: function () {


	},

	// Override socketNotificationReceived method.

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function (notification, payload) {
		// The payload is never logged: for Paprika it holds the account email
		// and password.
		console.log(this.name + " received a socket notification: " + notification);

		var self = this;

		if (notification === "PAPRIKA_RECIPE_GET" || notification === "START") {
			console.log("Working notification system. Notification:", notification);
			console.log("Geting data for module [" + this.name + "]");

			if (payload.email == null || payload.email == "") {
				console.log(this.name + " ** ERROR ** No email set");
				this.sendRecipeError("No Paprika email configured");
			} else if (payload.password == null || payload.password == "") {
				console.log(this.name + " ** ERROR ** No password set");
				this.sendRecipeError("No Paprika password configured");
			} else {
				if (this.paprikaApi == null) {
					this.paprikaApi = new PaprikaApi.PaprikaApi(payload.email, payload.password);
				}

				if (this.outstandingRequest == true) {
					console.log(this.name + " Outstanding request, try later");
					return;
				}

				this.outstandingRequest = true;

				RecipeSync.syncRecipes({
					api: this.paprikaApi,
					options: {
						concurrency: payload.maxConcurrentRequests,
						maxRetries: payload.maxRetries,
						retryBaseDelayMs: payload.retryBaseDelayMs
					},
					logger: {
						log: function (message) {
							console.log(self.name + " " + message);
						},
						warn: function (message) {
							console.log(self.name + " " + message);
						}
					}
				})
					.then((result) => {
						var failedCount = result.failures.length;
						console.log(self.name + " Recipe sync finished: " + result.recipes.length + " of " + result.requestedCount + " recipes loaded, " + failedCount + " failed");

						if (result.aborted) {
							console.log(self.name + " Sync aborted early: " + result.abortReason);
						}
						if (failedCount > 0) {
							console.log(self.name + " Failure reasons: " + self.summarizeFailures(result.failures));
						}

						if (result.recipes.length === 0) {
							self.sendRecipeError(result.requestedCount === 0
								? "Paprika returned no recipes"
								: "All " + result.requestedCount + " Paprika recipe details failed: " + self.summarizeFailures(result.failures));
							return;
						}

						self.sendSocketNotification("PAPRIKA_RECIPE_DATA", result.recipes);
					})
					.catch((error) => {
						// Only a log-safe description is printed: the raw error
						// carries the authenticated request options, including
						// the Paprika email and password.
						var reason = RecipeSync.describeError(error);
						console.log(self.name + " Exception syncing recipe list: " + reason);
						self.sendRecipeError("Could not reach Paprika (" + reason + ")");
					})
					.then(() => {
						self.outstandingRequest = false;
					});
			}
		}
		else if (notification === "LOCAL_RECIPE_GET") {

			try {
				// Resolved relative to this file, so the module keeps working
				// when the install directory has been renamed.
				var recipeList = require("./local_recipes.json");

				//console.log(this.name + " Local recipes list: ",recipeList );
				console.log(this.name + " Local recipes list type is: ", typeof (recipeList));

				console.log(this.name + " All LOCAL recipes returned");

				var recipeCount = recipeList.length
				console.log(this.name + " LOCAL Recipe count is ", recipeCount);

				var resp = [];

				for (const recipeResult of recipeList) {
					console.log(this.name + " LOCAL Recipe name is ", recipeResult.name);

					if (recipeResult.name != "") {
						resp.push(recipeResult);
					}
				}
				self.sendSocketNotification("LOCAL_RECIPE_DATA", resp);

			}
			catch (err) {
				console.log("LOCAL recipe file loading error", err);
				self.sendSocketNotification("NULL", "NULL");
			}


		}
		else {
			console.log(this.name + " NO recipe sources found for notification: " + notification);
			self.sendSocketNotification("NULL", "NULL");
		}

	},

	/* summarizeFailures(failures)
	 * Group failures by their log-safe reason so a long outage prints one line
	 * per distinct cause instead of one line per recipe.
	 */
	summarizeFailures: function (failures) {
		var counts = {};
		for (var i = 0; i < failures.length; i++) {
			var reason = failures[i].reason;
			counts[reason] = (counts[reason] || 0) + 1;
		}
		return Object.keys(counts).map(function (reason) {
			return counts[reason] + "x " + reason;
		}).join(", ");
	},

	/* sendRecipeError(reason)
	 * Tell the frontend that this sync produced no usable recipes, so it can
	 * surface a message instead of rendering an empty screen.
	 */
	sendRecipeError: function (reason) {
		this.sendSocketNotification("PAPRIKA_RECIPE_ERROR", { reason: reason });
	},

	// Example function send notification test
	sendNotificationTest: function (payload) {
		this.sendSocketNotification("MMM-MagicReplicator-NOTIFICATION_TEST", payload);
	},

	// this you can create extra routes for your module
	extraRoutes: function () {
		var self = this;
		this.expressApp.get("/MMM-MagicReplicator/extra_route", function (req, res) {
			// call another function
			values = self.anotherFunction();
			res.send(values);
		});
	},

	// Test another function
	anotherFunction: function () {
		return { date: new Date() };
	},

});
