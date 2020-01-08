define([
    "module",
    "require",
    "vs/platform/instantiation/common/instantiationService",
    "vs/code/electron-main/app",
    "vs/code/electron-main/window",
    "vs/base/common/platform",
    "vs/platform/configuration/common/configuration",
    "customize-ui/utils"
], function (module, require, insantiationService, app, win, platform, configuration, utils) {
    'use strict';

    let MainProcessTitleBar = class MainProcessTitleBar {
        constructor(configurationService) {
            const titleBar = configurationService.getValue("customizeUI.titleBar");

            if (titleBar === "inline" || titleBar === "frameless") {
                this.init(titleBar);
            }
        }

        init(titleBar) {

            this.swizzle();

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
                            get() { return "hidden"; },
                            set() { },
                            configurable: true,
                        });
                        super(...arguments);
                        delete Object.prototype.titleBarStyle;
                    }
                }
            }

            win.CodeWindow = _CodeWindow;
        }

        swizzle() {
            //
            // titleBarStyle hiddenInset is very buggy, in electron 4 downright unusable,
            //  so we do it our own way
            //

            let path = require.__$__nodeRequire('path');
            let url = require.toUrl(module.id);
            let dir = path.dirname(url);
            let swizzle = path.join(dir, "swizzle.dylib");

            try {
                let r = require.__$__nodeRequire('process');
                let os = require.__$__nodeRequire('os');
                let module = { exports: {} }
                let e = r.dlopen(module, swizzle, os.constants.dlopen.RTLD_NOW);
            } catch (e) {
                // "Module did not self-register." is expected error here; the dylib
                // is not a real node module, it just swizzles some objc code
                if (!e.message.includes("self-register")) {
                    console.error(e.message);
                }
            }
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