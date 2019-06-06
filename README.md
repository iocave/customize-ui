# Customize UI README

This experimental extension allows tweaking certain VSCode UI settings that are otherwise non-configurable. It also allows injecting custom stylesheet rules that can be specified directly in your configuration file.

## Supported configuration options

### `customizeUI.fontSizeMap`

Mapping from hardcoded VSCode font size to custom font size. For example the following will change 13px and 12px UI fonts to 11px, which fixes huge sidebar font on OS X.

```jsonc
    "customizeUI.fontSizeMap": {
        "13px": "11px",
        "12px": "11px",
        "window-title": "12px", // Window title font when using custom titlebar
        "tab-title": "12px",    // Used for editor tab titles
        "monospace": "10.5px",  // Used for monospace fonts in user interface
        "menu": "13px",         // Used for menu items (windows only)
    }
```

### `customizeUI.listRowHeight`

Changes row height in various list and trees in user inteface. 22 by default

```jsonc
    "customizeUI.listRowHeight": 20, // shrink rows to match XCode
```

### `customizeUI.font.regular` and `customizeUI.font.monospace`

Allows changing font face for regular and monospace user interface fonts

```jsonc
    "customizeUI.font.regular": "Helvetica Nueve",
    "customizeUI.font.monospace": "Fira Code",
```

### `customizeUI.stylesheet`

Allow adding custom stylesheet rules. It is form of map where selectors are keys.

```jsonc
    "customizeUI.stylesheet": {
        ".search-view .search-widgets-container": "padding-top: 0px !important",
        ".suggest-input-container": "padding: 3px 4px 3px !important;"
    }
```

## How does it work

Customize UI relies on the [Monkey Patch Extension](https://marketplace.visualstudio.com/items?itemName=iocave.monkey-patch) to inject custom javascript in VSCode. After installation you should
be prompted to enable Monkey Patch. You can always trigger this manually by invoking the "Enable Monkey Patch" command.
