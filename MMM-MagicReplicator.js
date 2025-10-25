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
	sortOrder: "recent", // "recent" or "alphabetical"

	defaults: {
		email: "",
		password: "",
		updateInterval: 60, //How frequent to refresh recipes info in minutes.
		updateFadeSpeed: 500,
		message: "",
		source: "local", // "local" or "paprika"
		cardSize: "M" // "XS", "S", "M", "L"
	},

	getScripts: function () {
		Log.info('Loading external scripts: ' + this.name);
		console.log('Loading external scripts: ' + this.name);

		return [
			'https://code.jquery.com/jquery-3.6.0.min.js',
			this.file('scripts/nutritionLabel.min.js')
		]
	},

	getStyles: function () {
		return [
			"MMM-MagicReplicator.css",
			this.file('styles/nutritionLabel.css')
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

//		var recognition =  window.SpeechRecognition();

//		recognition.onresult = (event) => {
//		  const transcript = event.results[0][0].transcript;
//		  console.log(`You said: ${transcript}`);
//		};
//		startButton.addEventListener('click', () => {
//		  recognition.start();
//		});
//
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
			cardsCreate(fav_filter, this);

		}
		else {
			console.log('anonymous favourutes');
			let fav_filter = this.favorites_content;
			console.log('Type of fav switch variable is', typeof (x));
			cardsCreate(fav_filter, this);

		}

		function cardsCreate(c, moduleInstance) {
			console.log("createCards entered ", c);
			var self = moduleInstance;
			console.log("c var type", typeof (c));

			// Sort the recipes based on current sort order
			let sortedRecipes = Object.values(c);
			if (self.sortOrder === "alphabetical") {
				sortedRecipes = sortedRecipes.sort((a, b) => a.name.localeCompare(b.name));
			} else {
				// For "recent" sorting, we'll keep the original order (assuming it's already sorted by date)
				// If you have a date field, you could sort by that instead
				sortedRecipes = sortedRecipes;
			}

			sortedRecipes.forEach(function (element) {
				console.log(element);

				const card = document.createElement('div');
				card.id = element.name;

				card.classList.add('card');
				// Apply card size class based on configuration
				card.classList.add('card-' + self.config.cardSize.toLowerCase());

				// Build card HTML with additional info
				var cardHTML = `<h3>${element.name}</h3>`;
				cardHTML += `<img src="${element.photo_url || 'modules/MMM-MagicReplicator/assets/empty_recipe_picture.jpg'}">`;

				// Add recipe metadata
				cardHTML += '<div class="card-metadata">';

				// Time info
				if (element.prep_time || element.cook_time) {
					cardHTML += '<div class="card-time-info">';
					if (element.prep_time) {
						cardHTML += `<span class="card-info-item">⏱️ Prep: ${element.prep_time}</span>`;
					}
					if (element.cook_time) {
						cardHTML += `<span class="card-info-item">🔥 Cook: ${element.cook_time}</span>`;
					}
					cardHTML += '</div>';
				}

				// Servings and difficulty
				if (element.servings || element.difficulty) {
					cardHTML += '<div class="card-details">';
					if (element.servings) {
						cardHTML += `<span class="card-info-item">🍽️ ${element.servings}</span>`;
					}
					if (element.difficulty) {
						cardHTML += `<span class="card-info-item">📊 ${element.difficulty}</span>`;
					}
					cardHTML += '</div>';
				}

				// Rating
				if (element.rating && element.rating > 0) {
					var stars = '';
					for (var i = 1; i <= 5; i++) {
						stars += i <= element.rating ? '⭐' : '☆';
					}
					cardHTML += `<div class="card-rating">${stars}</div>`;
				}

				cardHTML += '</div>'; // close card-metadata

				card.innerHTML = cardHTML;
				console.log("cards", card);

				// Add favorite icon overlay
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
					<div class="recipe-main-content">
						<div class="recipe-info">
							<h1>${element.name}</h1>

							<img class="recipe-image" src="${element.photo_url || 'modules/MMM-MagicReplicator/assets/empty_recipe_picture.jpg'}" alt="Recipe Image">

							<div class="recipe-meta-section">
								${element.prep_time ? `<span class="recipe-meta-item"><strong>⏱️ Prep Time:</strong> ${element.prep_time}</span>` : ''}
								${element.cook_time ? `<span class="recipe-meta-item"><strong>🔥 Cook Time:</strong> ${element.cook_time}</span>` : ''}
								${element.servings ? `<span class="recipe-meta-item"><strong>🍽️ Servings:</strong> ${element.servings}</span>` : ''}
								${element.difficulty ? `<span class="recipe-meta-item"><strong>📊 Difficulty:</strong> ${element.difficulty}</span>` : ''}
							</div>

							<div class="ingredients">
							  <h2>Ingredients:</h2>
							  <p>${element.ingredients}</p>
							</div>

							<div class="directions">
							  <h2>Directions:</h2>
							  <p>${element.directions}</p>
							</div>

							${element.notes ? `<div class="recipe-notes">
							  <h2>Notes:</h2>
							  <p>${element.notes}</p>
							</div>` : ''}

							<p>Source: ${element.source} </p>
						</div>

						<div class="nutrition-container">
							<div id="nutrition-label-${element.uid || element.name.replace(/\s+/g, '-')}"></div>
						</div>
					</div>

					<div class="footer-detail">
						<div class="footer-column-detail">
							<div class="footer-icon">⭐</div>
							<div class="footer-label">Rating</div>
							<div class="footer-value">${element.rating && element.rating > 0 ? (() => {
								let stars = '';
								for (let i = 1; i <= 5; i++) {
									stars += i <= element.rating ? '⭐' : '☆';
								}
								return stars;
							})() : '<span class="no-rating">Not rated</span>'}</div>
						</div>
						<div class="footer-column-detail">
							<div class="footer-icon">${element.on_favorites ? '❤️' : '🤍'}</div>
							<div class="footer-label">Favorite</div>
							<div class="footer-value">${element.on_favorites ? '<span class="is-favorite">Yes</span>' : '<span class="not-favorite">No</span>'}</div>
						</div>
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

					// Initialize nutrition label (always show, even with 0 values)
					var nutritionLabelId = '#nutrition-label-' + (element.uid || element.name.replace(/\s+/g, '-'));
					var nutritionData = self.parseNutritionData(element);

					// Wait for jQuery to be available
					setTimeout(function() {
						if (typeof $ !== 'undefined' && $.fn.nutritionLabel) {
							$(nutritionLabelId).nutritionLabel(nutritionData);
						}
					}, 100);

					// When the user clicks on <span> (x), close the modal
					span.onclick = function () {
						modal.style.display = "none";
						container.classList.remove((`${this.name}-blur` || "undefined-blur"));
						modal.remove();

					}

					// When the user clicks anywhere outside of the modal, close it
					modal.onclick = function (event) {
						if (event.target === modal) {
							modal.style.display = "none";
							container.classList.remove((`${this.name}-blur` || "undefined-blur"));
							modal.remove();
						}
					}

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

			this.dataRefreshTimeStamp = Date.now();

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


	parseNutritionInfoString: function (nutritionalInfoText, servings) {
		// Parse Paprika's nutritional_info string format
		// Example format: "Calories: 250\nFat: 10g\nCarbohydrates: 32g\nProtein: 12g"
		if (!nutritionalInfoText || nutritionalInfoText.trim() === '') {
			return null;
		}

		console.log("Parsing nutritional info:", nutritionalInfoText);

		var nutritionData = {};

		// Helper function to extract numeric value from text
		var extractValue = function (text, pattern) {
			var regex = new RegExp(pattern, 'i');
			var match = text.match(regex);
			if (match && match[1]) {
				var value = parseFloat(match[1].replace(/,/g, ''));
				return isNaN(value) ? 0 : value;
			}
			return 0;
		};

		// Extract nutrition values
		nutritionData.calories = extractValue(nutritionalInfoText, /calories[:\s]+(\d+\.?\d*)/);
		nutritionData.totalFat = extractValue(nutritionalInfoText, /total\s*fat[:\s]+(\d+\.?\d*)/);
		nutritionData.saturatedFat = extractValue(nutritionalInfoText, /saturated\s*fat[:\s]+(\d+\.?\d*)/);
		nutritionData.transFat = extractValue(nutritionalInfoText, /trans\s*fat[:\s]+(\d+\.?\d*)/);
		nutritionData.cholesterol = extractValue(nutritionalInfoText, /cholesterol[:\s]+(\d+\.?\d*)/);
		nutritionData.sodium = extractValue(nutritionalInfoText, /sodium[:\s]+(\d+\.?\d*)/);
		nutritionData.totalCarbohydrate = extractValue(nutritionalInfoText, /total\s*carbohydrate[:\s]+(\d+\.?\d*)/);
		nutritionData.dietaryFiber = extractValue(nutritionalInfoText, /dietary\s*fiber[:\s]+(\d+\.?\d*)/);
		nutritionData.sugars = extractValue(nutritionalInfoText, /sugars[:\s]+(\d+\.?\d*)/);
		nutritionData.protein = extractValue(nutritionalInfoText, /protein[:\s]+(\d+\.?\d*)/);
		nutritionData.vitaminD = extractValue(nutritionalInfoText, /vitamin\s*d[:\s]+(\d+\.?\d*)/);
		nutritionData.calcium = extractValue(nutritionalInfoText, /calcium[:\s]+(\d+\.?\d*)/);
		nutritionData.iron = extractValue(nutritionalInfoText, /iron[:\s]+(\d+\.?\d*)/);
		nutritionData.potassium = extractValue(nutritionalInfoText, /potassium[:\s]+(\d+\.?\d*)/);

		// Parse servings
		var servingSize = 1;
		var servingUnit = 'serving';
		if (servings) {
			var servingMatch = servings.match(/(\d+\.?\d*)\s*(.+)/);
			if (servingMatch) {
				servingSize = parseFloat(servingMatch[1]) || 1;
				servingUnit = servingMatch[2] || 'serving';
			}
		}

		nutritionData.servingSize = servingSize;
		nutritionData.servingUnit = servingUnit;
		nutritionData.servingsPerContainer = 1;

		console.log("Parsed nutrition data:", nutritionData);

		return nutritionData;
	},

	parseNutritionData: function (element) {
		var nutritionData = null;
		var hasData = false;

		// First, check if nutrition object exists (local recipes format)
		if (element.nutrition) {
			nutritionData = element.nutrition;
			hasData = true;
		}
		// Second, check if Paprika's nutritional_info exists
		else if (element.nutritional_info && element.nutritional_info.trim() !== '') {
			nutritionData = this.parseNutritionInfoString(element.nutritional_info, element.servings);
			hasData = true;
		}

		// Build the nutrition label configuration
		// If no data exists, use all 0 values and add a disclaimer
		var labelConfig = {
			// Explicitly set to use 2018 FDA label (default)
			showLegacyVersion: false,
			showUKVersion: false,

			// Label dimensions
			width: 280,

			// Serving information
			showServingUnitQuantity: true,
			valueServingUnitQuantity: hasData && nutritionData ? (nutritionData.servingSize || 1) : 1,
			valueServingSizeUnit: hasData && nutritionData ? (nutritionData.servingUnit || 'serving') : 'serving',
			valueServingPerContainer: hasData && nutritionData ? (nutritionData.servingsPerContainer || 1) : 1,

			// Calories
			valueCalories: hasData && nutritionData ? (nutritionData.calories || 0) : 0,
			valueFatCalories: hasData && nutritionData ? (nutritionData.caloriesFromFat || 0) : 0,

			// Fats
			valueTotalFat: hasData && nutritionData ? (nutritionData.totalFat || 0) : 0,
			valueSatFat: hasData && nutritionData ? (nutritionData.saturatedFat || 0) : 0,
			valueTransFat: hasData && nutritionData ? (nutritionData.transFat || 0) : 0,

			// Other nutrients
			valueCholesterol: hasData && nutritionData ? (nutritionData.cholesterol || 0) : 0,
			valueSodium: hasData && nutritionData ? (nutritionData.sodium || 0) : 0,
			valueTotalCarb: hasData && nutritionData ? (nutritionData.totalCarbohydrate || 0) : 0,
			valueFibers: hasData && nutritionData ? (nutritionData.dietaryFiber || 0) : 0,
			valueSugars: hasData && nutritionData ? (nutritionData.sugars || 0) : 0,
			valueProteins: hasData && nutritionData ? (nutritionData.protein || 0) : 0,

			// 2018 FDA required vitamins and minerals
			valueVitaminD: hasData && nutritionData ? (nutritionData.vitaminD || 0) : 0,
			valueCalcium: hasData && nutritionData ? (nutritionData.calcium || 0) : 0,
			valueIron: hasData && nutritionData ? (nutritionData.iron || 0) : 0,
			valuePotassium: hasData && nutritionData ? (nutritionData.potassium || 0) : 0,

			// Display options for 2018 label
			showVitaminD: true,
			showCalcium: true,
			showIron: true,
			showPotassium: true,
			showAddedSugars: false,
			showPolyFat: false,
			showMonoFat: false,

			// FDA rounding rules
			allowFDARounding: true,

			// Show daily values
			hidePercentDailyValues: false
		};

		// Add custom note when no data is available
		if (!hasData) {
			labelConfig.showCustomFooter = true;
			labelConfig.valueCustomFooter = '<strong>Note:</strong> This recipe has no nutrient data available. All values shown are 0.';
		}

		return labelConfig;
	},

	addFooter: function () {
		console.log("Add footer func entered");
		var self = this;
		var container_below = document.createElement("div");
		//var breakrow = document.createElement("br");

		container_below.id = "container_below";
		container_below.classList.add('container_below');

		container_below.innerHTML = `
			<div class="button-container">
				<img class="image_below" id="favorites-btn" src="modules/MMM-MagicReplicator/assets/favorite_recipes.jpg">
				<img class="image_below" id="sort-btn" src="modules/MMM-MagicReplicator/assets/sort_recipes.svg">
			</div>
		`;

		// Wait for DOM to be updated before accessing elements
		setTimeout(() => {
			let favsToggle = container_below.querySelector('#favorites-btn');
			let sortButton = container_below.querySelector('#sort-btn');
			//let randomShow = document.getElementsByClassName('div_random_show');
			console.log("Favourite toggle type is", typeof (favsToggle));
			console.log("Favourite toggle  is", favsToggle);

			// Favorites button event listener
			if (favsToggle) {
				favsToggle.addEventListener("click", function onClick() {
					console.log("Favourite toggle before is", self.favorites);
					self.favorites = !self.favorites;
					self.updateDom(self.config.updateFadeSpeed);
					this.favorites = self.favorites;
				});
			}

			// Sort button event listener
			if (sortButton) {
				sortButton.addEventListener("click", function onClick() {
					console.log("Sort toggle before is", self.sortOrder);
					self.sortOrder = self.sortOrder === "recent" ? "alphabetical" : "recent";
					self.updateDom(self.config.updateFadeSpeed);
					console.log("Sort toggle after is", self.sortOrder);
				});
			}
		}, 0);

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
