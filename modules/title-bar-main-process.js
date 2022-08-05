define([
    "module",
    "require",
    "electron",
    "vs/code/electron-main/app",
    "vs/base/common/platform",
    "vs/platform/configuration/common/configuration",
    "customize-ui/utils"
], function (module, require, electron, app, platform, configuration, utils) {
    'use strict';

    let MainProcessTitleBar = class MainProcessTitleBar {
        constructor(configurationService) {
            const titleBar = configurationService.getValue("customizeUI.titleBar");

            if (titleBar === "inline" || titleBar === "frameless") {
                let self = this;
                require(["vs/code/electron-main/window"], function (win) {
                    self.__init(titleBar, win);
                }, function (err) { });

                require(["vs/platform/windows/electron-main/window"], function (win) {
                    self.__init(titleBar, win);
                }, function (err) { });

                require(["vs/platform/windows/electron-main/windowImpl"], function (win) {
                    self.__init(titleBar, win);
                }, function (err) { });
            }
        }

        __init(titleBar, win) {
            let hasSetTrafficLightPosition = false; // electron.BrowserWindow.prototype.setTrafficLightPosition !== undefined;

            // Fix glitch with traffic lights moved top when showing dialog
            if (hasSetTrafficLightPosition) {
                let fix = function (where, name) {
                    let prev = where[name];
                    where[name] = function () {
                        let res = prev(...arguments);
                        try {
                            if (arguments[0].setTrafficLightPosition)
                                arguments[0].setTrafficLightPosition(arguments[0].getTrafficLightPosition());
                        } catch (ignore) {
                        }
                        return res;
                    };
                }
                fix(electron.dialog, "showMessageBox");
                fix(electron.dialog, "showOpenDialog");
                fix(electron.dialog, "showSaveDialog");
            }

            class _CodeWindow extends win.CodeWindow {
                constructor() {
                    // https://electronjs.org/docs/api/frameless-window
                    //
                    if (titleBar === "frameless") {
                        Object.defineProperty(Object.prototype, "frame", {
                            get() { return false; },
                            set() { },
                            configurable: true,
                        });
                        super(...arguments);
                        delete Object.prototype.frame;

                    } else {
                        Object.defineProperty(Object.prototype, "titleBarStyle", {
                            get() { return hasSetTrafficLightPosition ? "hidden" : "hiddenInset"; },
                            set() { },
                            configurable: true,
                        });

                        super(...arguments);

                        this._win.setRepresentedFilename = function () { } // this resets traffic lights
                        this._win.setDocumentEdited = function () { } // this resets traffic lights
                        if (hasSetTrafficLightPosition) {
                            this._win.setTrafficLightPosition({ "x": 12, "y": 22 });
                        }

                        delete Object.prototype.titleBarStyle;
                    }
                }
            }

            win.CodeWindow = _CodeWindow;
        }
    }

    MainProcessTitleBar = utils.decorate([
        utils.param(0, configuration.IConfigurationService),
    ], MainProcessTitleBar);

    if (platform.isMacintosh) {
        utils.override(app.CodeApplication, "openFirstWindow", function (original) {
            if (this.mainInstantiationService) {
                this.mainInstantiationService.createInstance(MainProcessTitleBar);
            } else {
                this.instantiationService.createInstance(MainProcessTitleBar);
            }
            return original();
        });
    }
});