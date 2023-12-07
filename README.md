# MMM-MagicReplicator

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

[![MagicMirror2](https://img.shields.io/badge/MagicMirror-2.2.2-lightgray.svg)](https://github.com/MichMich/MagicMirror)
[![GitHub last commit](https://img.shields.io/github/last-commit/E3V3A/MMM-FlightsAbove.svg)](https://github.com/ivlovric/MMM-MagicReplicator)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/ivlovric/MMM-MagicReplicator/graphs/commit-activity)

Display Recipes collection as cardsfrom local file or Paprika intended mostly to be run on fullscreen and with touch support.


| STATUS: | Version | Date | Maintained? |
|:------- |:------- |:---- |:----------- |
| Working | `1.0.0` | 2023-12-07 | YES |


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
    classes: "default everyone",
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
| `option1`        | *Required* DESCRIPTION HERE
| `option2`        | *Optional* DESCRIPTION HERE TOO <br><br>**Type:** `int`(milliseconds) <br>Default 60000 milliseconds (1 minute)
