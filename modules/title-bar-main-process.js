define([
    "module",
    "require",
    "electron",
    "vs/platform/instantiation/common/instantiationService",
    "vs/code/electron-main/app",
    "vs/code/electron-main/window",
    "vs/base/common/platform",
    "vs/platform/configuration/common/configuration",
    "customize-ui/utils"
], function (module, require, electron, insantiationService, app, win, platform, configuration, utils) {
    'use strict';

    let MainProcessTitleBar = class MainProcessTitleBar {
        constructor(configurationService) {
            const titleBar = configurationService.getValue("customizeUI.titleBar");

            if (titleBar === "inline" || titleBar === "frameless") {
                this.init(titleBar);
            }
        }

        init(titleBar) {

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
                        let hasSetTrafficLightPosition = electron.BrowserWindow.prototype.setTrafficLightPosition !== undefined;
                                                
                        Object.defineProperty(Object.prototype, "titleBarStyle", {
                            get() { return hasSetTrafficLightPosition ? "hidden" : "hiddenInset"; },
                            set() { },
                            configurable: true,
                        });
           
                        super(...arguments);            
                                            
                        if (hasSetTrafficLightPosition) {
                            this._win.setRepresentedFilename = function() {} // this resets traffic lights
                            this._win.setTrafficLightPosition({"x": 12, "y": 22});
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
            this.instantiationService.createInstance(MainProcessTitleBar);
            return original();
        });
    }
});