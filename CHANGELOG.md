# MMM-MagicReplicator Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).


## [1.1.2]

- Paprika recipe detail fetches now use bounded concurrency (default 4) instead of `Promise.all` over the full list
- Transient network failures (`ECONNRESET`, timeouts, 5xx, ...) are retried with exponential backoff
- Permanent sync failures notify the frontend instead of leaving a blank screen; successful recipes from a partial sync are kept
- Credentials, authenticated request objects and recipe contents are no longer written into error logs


## [1.1.1] 

- CSS fixes
- Long recipe name display fixes
- Modal window closing on outside modal click


## [1.1.0] 

- Sorting support (Recent, Alpha)
- Card Size option
- FDA nutrient card in recipe details


## [1.0.0] 

First public release
- Local file recipes support
- Paprika recipes support
- Favourites filter
