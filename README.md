# MMM-MagicReplicator

This is a module for the [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror).

[![MagicMirror2](https://img.shields.io/badge/MagicMirror-2.2.2-lightgray.svg)](https://github.com/MagicMirrorOrg/MagicMirror)
[![GitHub last commit](https://img.shields.io/github/last-commit/ivlovric/MMM-MagicReplicator/main)](https://github.com/ivlovric/MMM-MagicReplicator)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/ivlovric/MMM-MagicReplicator/graphs/commit-activity)

Display Recipes collection as cards from local file or [Paprika recipe app](https://www.paprikaapp.com/) laced with interactive UI intended for modern kitchens, restaurants or just for fun on large touch screens or kiosks for best experience.

Background, icons and logo credit to Dall-E


| STATUS: | Version | Date | Maintained? |
|:------- |:------- |:---- |:----------- |
| Working | `1.1.0` | 2025-25-11 | YES |


<img src="https://github.com/ivlovric/MMM-MagicReplicator/blob/main/assets/foodreplicator-logo.jpg" width="300" height="300">
<img src="https://github.com/ivlovric/MMM-MagicReplicator/blob/main/assets/MagicReplicator-screenshot.png" width="450" height="750">
<img src="https://github.com/ivlovric/MMM-MagicReplicator/blob/main/assets/recpedetail-screenshot.png" width="750" height="450">


## Installation

Manual Installation:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/ivlovric/MMM-MagicReplicator.git
cd MMM-MagicReplicator
npm install

```

## Update


```bash
cd ~/MagicMirror/modules/MMM-MagicReplicator
git pull
npm install

```


## Using the module

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
{
    module: "MMM-MagicReplicator",
    header: "My Recipes",
    position: "fullscreen_above",
    config: {
        email: "",
        password: "",
        refreshInterval: 600,
        source: "local",
        cardSize: "S"
    }
},
    ]
}
```

When using **local source**, check already provided example recipe list in `local_recipes.json` to build your own.

## Configuration options

| Option           | Description
|----------------- |-----------
| `module `        | *Required* Module name
| `header`        | *Optional* Header text
| `position`        | *Optional* Any MagicMirror² position. fullscreen_above and fullscreen_below are recommended
| `email`        | *Mandatory* when using Paprika as recipes provider, otherwise optional
| `password`        | *Mandatory* when using Paprika as recipes provider, otherwise optional
| `refreshInterval`        | *Optional* Recipes refresh interval
| `source`        | *Optional* "local" or "paprika", default is local
| `cardSize`        | *Optional* Card size: "XS", "S", "M", "L". Default is "M"

Thanks to https://github.com/kaelspencer/MMM-PaprikaMenu and Kael for introducing me with node paprika library.
