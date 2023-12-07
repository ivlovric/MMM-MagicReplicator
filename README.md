# MMM-MagicReplicator

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

[![MagicMirror2](https://img.shields.io/badge/MagicMirror-2.2.2-lightgray.svg)](https://github.com/MichMich/MagicMirror)
[![GitHub last commit](https://img.shields.io/github/last-commit/ivlovric/MMM-MagicReplicator/main)](https://github.com/ivlovric/MMM-MagicReplicator)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/ivlovric/MMM-MagicReplicator/graphs/commit-activity)

Display Recipes collection as cards from local file or [Paprika](https://www.paprikaapp.com/) intended mostly to be run on fullscreen and with touch support.


| STATUS: | Version | Date | Maintained? |
|:------- |:------- |:---- |:----------- |
| Working | `1.0.0` | 2023-12-07 | YES |


<img src="https://github.com/ivlovric/MMM-MagicReplicator/blob/main/assets/foodreplicator-logo.jpg" width="400" height="400">

## Installation

Manual Installation:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/E3V3A/MMM-Tabulator.git
cd MMM-MagicReplicator
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
        source: "local"
    }
},
    ]
}
```

## Configuration options

| Option           | Description
|----------------- |-----------
| `module `        | *Required* Module name
| `header`        | *Optional* Header text
| `position`        | *Optional* Any Magic Mirror position. fullscreen_above and fullscreen_below are recommended
| `email`        | *Mandatory* when using Paprika as recipes provider, otherwise optional
| `password`        | *Mandatory* when using Paprika as recipes provider, otherwise optional
| `refreshInterval`        | *Optional* Recipes refresh interval
| `source`        | *Optional* "local" or "paprika", default is local
