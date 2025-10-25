/* Magic Mirror
 * Node Helper: MMM-MagicReplicator
 *
 * By 
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var PaprikaApi = require("paprika-api");

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
		console.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);

		var self = this;

		if (notification === "PAPRIKA_RECIPE_GET" || notification === "START") {
			console.log("Working notification system. Notification:", notification, "payload: ", payload);
			console.log("Geting data for module [" + this.name + "]");

			if (payload.email == null || payload.email == "") {
				console.log(moment().format("D-MMM-YY HH:mm") + " ** ERROR ** No email set");
			} else if (payload.password == null || payload.password == "") {
				console.log(moment().format("D-MMM-YY HH:mm") + " ** ERROR ** No password set");
			} else {
				if (this.paprikaApi == null) {
					this.paprikaApi = new PaprikaApi.PaprikaApi(payload.email, payload.password);
				}

				if (this.outstandingRequest == true) {
					console.log(this.name + " Outstanding request, try later");
					return;
				}

				this.paprikaApi.recipes()
					.then((recipes) => {
						var recipeCount = recipes.length
						//console.log("recepti sve ",recipes)
						console.log(this.name + " Recipe count is ", recipeCount);

						var recipePromises = [];

						for (const uid of recipes) {
							recipePromises.push(self.paprikaApi.recipe(uid.uid));
							//console.log('UID IS',uid.uid);

						}

						console.log(this.name + " Waiting on " + recipes.length + "Paprika recipe data");
						//console.log(" RECIPE is ",recipePromises);

						return Promise.all(recipePromises);

					})
					.then((recipe) => {
						//console.log("TYPE of RECIPE2 is ",typeof(recipe));
						var resp = [];

						console.log(this.name + " All recipes returned");

						for (const recipeResult of recipe) {
							console.log(this.name + " Recipe name is ", recipeResult.name);

							// Log nutrition info for debugging
							if (recipeResult.nutritional_info) {
								console.log(this.name + " Recipe has nutritional_info");
								console.log(this.name + " Nutritional info:", recipeResult.nutritional_info);
							}
							if (recipeResult.servings) {
								console.log(this.name + " Servings:", recipeResult.servings);
							}

							if (recipeResult.name != "") {
								resp.push(recipeResult);
							}
						}
						self.sendSocketNotification("PAPRIKA_RECIPE_DATA", resp);

					})

					.catch((error) => {
						console.log(this.name + " Exception syncing");
						console.log(error);
					})

			}
		}
		else if (notification === "LOCAL_RECIPE_GET") {

			try {
				var recipeList = require("../MMM-MagicReplicator/local_recipes.json");

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
			console.log("NO recipe sources found", err);
			self.sendSocketNotification("NULL", "NULL");
		}

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
