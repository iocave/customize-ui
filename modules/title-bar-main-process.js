define([
    "vs/code/electron-main/window",
    "vs/base/common/platform",
    "customize-ui/utils"
], function(win, platform, utils) {

    utils.override(win.CodeWindow, "createBrowserWindow", function(original){

        if (platform.isMacintosh &&
            this.configurationService.getValue("customizeUI.inlineTitleBar")) {
            // Object.defineProperty(Object.prototype, "frame", {
            //     get() { return false; },
            //     set() {},
            //     configurable: true,
            // });
            Object.defineProperty(Object.prototype, "titleBarStyle", {
                get() { return "hiddenInset"; },
                set() {},
                configurable: true,
            });
            let res = original();
            delete Object.prototype.titleBarStyle;
            return res;
        } else {
            return original();
        }
    });
});