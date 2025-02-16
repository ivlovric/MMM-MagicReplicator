/* global Module */

/* Magic Mirror
 * Module: MMM-MagicReplicator
 *
 * By Ivica Lovrić
 * MIT Licensed.
 */

Module.register("MMM-MagicReplicator", {
	requiresVersion: "2.1.0", // Required version of MagicMirror
	favorites: false,
	favorites_content: "",
	random: false,

	defaults: {
		email: "",
		password: "",
		updateInterval: 60, //How frequent to refresh recipes info in minutes.
		updateFadeSpeed: 500,
		message: "",
		source: "local" // "local" or "paprika"
	},

	getScripts: function () {
		Log.info('Loading external scripts: ' + this.name);
		console.log('Loading external scripts: ' + this.name);

		return [
			//			'script.js', // will try to load it from the vendor folder, otherwise it will load is from the module folder.
			//			'moment.js', // this file is available in the vendor folder, so it doesn't need to be available in the module folder.
			//this.file('scripts/listeners.js'),
			//			'https://code.jquery.com/jquery-2.2.3.min.js',  // this file will be loaded from the jquery servers.
		]
	},

	getStyles: function () {
		return [
			"MMM-MagicReplicator.css",
		];
	},

	// Load translations files
	getTranslations: function () {
		//FIXME: This can be load a one file javascript definition
		return {
			en: "translations/en.json",
			es: "translations/es.json"
		};
	},

	start: function () {
		Log.info('Starting module: ' + this.name);

		var self = this;
		setInterval(function () {

			self.getData();
		},
			this.config.updateInterval * 60 * 1000); // Convert minutes to milliseconds

		this.getData();

	},

	/*
	 * getData
	 * function example return data and show it in the module wrapper
	 * get a URL request
	 *
	 */
	getData: function () {
		console.log("Configured source is", this.config.source);

		if (this.config.source == "paprika") {
			console.log("Paprika API recipe list config detected");
			this.sendSocketNotification("PAPRIKA_RECIPE_GET", {
				instanceId: this.identifier,
				email: this.config.email,
				password: this.config.password,
			});
		}
		else {
			console.log("Local recipe list config detected");
			this.sendSocketNotification("LOCAL_RECIPE_GET", {
				instanceId: this.identifier,
			});
		}
	},



	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update.
	 *  If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function (delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}
		nextLoad = nextLoad;
		var self = this;
		setTimeout(function () {
			self.getData();
		}, nextLoad);
	},

	getDom: function () {
		console.log("DOM entered");

		var container = document.createElement("div");
		container.id = "container";

		console.log("State of fav toggle in main", this.favorites)
		console.log("Recipes content in getDom", this.defaults.message);
		console.log("Recipes FAVS content in getDom", this.favorites_content);

		if (this.defaults.message == "NULL") {
			console.log('No recipes found or error loading');
			this.sendNotification("SHOW_ALERT", { type: "notification", title: "No Recipes Found", timer: 10000 });
			return container;
		}


		if (this.favorites === false) {
			console.log('anonymous default');
			let fav_filter = this.defaults.message;
			console.log('Type of fav switch variable is', typeof (fav_filter));
			cardsCreate(fav_filter);

		}
		else {
			console.log('anonymous favourutes');
			let fav_filter = this.favorites_content;
			console.log('Type of fav switch variable is', typeof (x));
			cardsCreate(fav_filter);

		}

		function cardsCreate(c) {
			console.log("createCards entered ", c);
			var self = this;
			console.log("c var type", typeof (c));


			Object.values(c).forEach(function (element) {
				console.log(element);

				const card = document.createElement('div');
				card.id = element.name;

				card.classList.add('card');

				if (element.photo_url) {
					card.innerHTML = `<h3>${element.name}</h3>  <img class = "recipe-image" img src=${element.photo_url}>`;
					console.log("cards", card);
				} else {
					card.innerHTML = `<h3>${element.name}</h3> <img class = "recipe-image" img src="modules/MMM-MagicReplicator/assets/empty_recipe_picture.jpg">`;

					console.log("cards", card);
				}
				cardFav = document.createElement('div');
				cardFav.id = "cardfav";

				if (element.on_favorites == true) {
					cardFav.innerHTML = `<img class = "fav_on_card" src="modules/MMM-MagicReplicator/assets/favorite_recipes.jpg">`;

				}


				card.appendChild(cardFav);

				container.appendChild(card);

				card.addEventListener("click", function () {

					container.classList.add(`${this.name}-blur`);
					console.log("NAME OF THE MODULE", this.name);

					const modal2 = document.createElement('div');
					modal2.classList.add('modal');
					modal2.id = "myModal";
					//this.recipeDetails(modal,element.recipes.uid);
					const content = document.createElement('div');
					content.classList.add('modal-content');
					content.innerHTML = `<span class="close">&times;</span>`;
					//content.appendChild(`<span class="close">&times;</span>`)

					const contentInner = document.createElement('p');
					contentInner.classList.add('modal-inner-content');

					contentInner.innerHTML = `<div class="recipe-container">
					<h1>${element.name}</h1>

					<img class="recipe-image" src="${element.photo_url}" alt="Recipe Image">

					<div class="ingredients">
					  <h2>Ingredients:</h2>
					  <p>${element.ingredients}</p>
					</div>

					<div class="directions">
					  <h2>Directions:</h2>
					  <p>${element.directions}</p>
					</div>

					<p>Source: ${element.source} </p>
				  </div>

				  <div class="footer-detail">
				  <div class="footer-column-detail">
				  Rating
					<p>${element.rating}</p>
				  </div>
				  <div class="footer-column-detail">
				  Favorite
					<p>${element.on_favorites}</p>
				  </div>
				</div> `

					content.appendChild(contentInner);

					modal2.content = `${element.name}`;
					modal2.appendChild(content);


					document.body.appendChild(modal2);

					// Get the modal
					var modal = document.getElementById("myModal");

					// Get the <span> element that closes the modal
					var span = document.getElementsByClassName("close")[0];

					//Show the modal
					modal.style.display = "block";

					// When the user clicks on <span> (x), close the modal
					span.onclick = function () {
						modal.style.display = "none";
						container.classList.remove((`${this.name}-blur` || "undefined-blur"));
						modal.remove();

					}

					//	// When the user clicks anywhere outside of the modal, close it - not working well
					//	window.onclick = function (event) {
					//		if (event.target == modal) {
					//			modal.style.display = "none";
					//			container.classList.remove((`${this.name}-blur` || "undefined-blur"));
					//			modal.remove();
					//		}
					//	}

				});

			})


		}

		var footer = this.addFooter();
		container.appendChild(footer);

		return container;

	},

	processData: function (data) {
		var self = this;
		this.dataRequest = data;
		if (this.loaded === false) {
			self.updateDom(self.config.animationSpeed);
		}
		this.loaded = true;
		this.sendSocketNotification("MMM-MagicReplicator-NOTIFICATION_TEST", data);
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		console.log("Return socket notification received in main:", notification);

		if (notification == "PAPRIKA_RECIPE_DATA" || notification == "LOCAL_RECIPE_DATA") {

			this.dataRefreshTimeStamp = moment().format("x");

			console.log("payload received", payload);
			this.defaults.message = payload;

			this.favorites_content = this.defaults.message.filter(fav =>
				fav.on_favorites
			);

			console.log(this.defaults.message);
			console.log(this.favorites_content);

			this.updateDom(this.config.updateFadeSpeed);
		}
		else if (notification == "NULL") {
			console.log("NULL ENTERED", notification);

			this.defaults.message = notification;
			this.updateDom(this.config.updateFadeSpeed);
		}
	},


	addFooter: function () {
		console.log("Add footer func entered");
		var self = this;
		var container_below = document.createElement("div");
		//var breakrow = document.createElement("br");

		container_below.id = "container_below";
		container_below.classList.add('container_below');

		container_below.innerHTML = `<div id="container_below"> <img class="image_below" id = "1" src="modules/MMM-MagicReplicator/assets/favorite_recipes.jpg"> </div>`;

		let favsToggle = container_below.getElementsByClassName('image_below');
		//let randomShow = document.getElementsByClassName('div_random_show');
		console.log("Favourite toggle type is", typeof (favsToggle));
		console.log("Favourite toggle  is", favsToggle[0]);

		favsToggle[0].addEventListener("click", function onClick() {

			console.log("Favourite toggle before is", self.favorites);
			self.favorites = !self.favorites;
			self.updateDom(self.config.updateFadeSpeed);
			this.favorites = self.favorites;

		});

		//randomShow[0].addEventListener("click", function () {
		//
		//			console.log("Random image before is", self.random);
		//			//self.favorites = "true";
		//			self.random = true;
		//			self.updateDom(self.config.updateFadeSpeed);
		//			this.random = self.random;
		//
		//		});

		return container_below;

	},

});
