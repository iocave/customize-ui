define([
    "exports",
    "customize-ui/utils",
    "vs/platform/configuration/common/configuration",
    "vs/base/common/platform",
    "vs/base/browser/browser",
    "vs/workbench/browser/layout",
    "vs/workbench/browser/parts/activitybar/activitybarPart",
    "vs/platform/theme/common/colorRegistry",
    "vs/workbench/browser/part",
    "vs/workbench/browser/parts/compositePart",
    "vs/workbench/browser/parts/editor/tabsTitleControl",
    "vs/workbench/browser/parts/editor/noTabsTitleControl",
    "vs/workbench/browser/parts/editor/editor",
], function (exports, utils, configuration, platform, browser, layout, activitybarPart, colorRegistry,
    part, compositePart, ttt, titleControl, editor) {

    function perform(windows) {

        let CustomizeTitleBar = class CustomizeTitleBar {
            constructor(configurationService, windowService) {

                this.configurationService = configurationService;
                this.windowService = windowService;

                if (platform.isMacintosh) {
                    const titleBar = configurationService.getValue("customizeUI.titleBar");
                    const statusBar = configurationService.getValue("customizeUI.statusBarPosition");
                    if (titleBar === "inline" || titleBar === "frameless") {
                        let init = () => {
                            this.init(titleBar === "inline" && statusBar !== "top");
                        }
                        if (layout.Settings) { // old layout (not using LayoutState)
                            init();
                        } else {
                            require(['vs/workbench/browser/layoutState'], (layoutState) => {
                                this.layoutState = layoutState;
                                init();
                            });
                        }
                    }
                }
            }

            updateStyle() {
                if (!this.styleTextNode) {
                    let css = document.createElement('style');
                    css.type = 'text/css';

                    this.styleTextNode = document.createTextNode("");
                    css.appendChild(this.styleTextNode);
                    document.getElementsByTagName("head")[0].appendChild(css);
                }

                let dimensions = this.trafficLightDimensions();
                this.styleTextNode.textContent = `
                    :root {
                        --traffict-lights-width: ${dimensions.width}px;
                        --traffict-lights-height: ${dimensions.height}px;
                        --traffic-lights-width: ${dimensions.width}px;
                        --traffic-lights-height: ${dimensions.height}px;
                    }
                `;
            }

            trafficLightDimensions() {
                let size = {
                    width: 77,
                    height: 37,
                }
                return {
                    width: size.width / browser.getZoomFactor(),
                    height: size.height / browser.getZoomFactor(),
                };
            }

            isFullScreen() {
                return browser.isFullscreen();
            }

            activityBarIsVertical() {
                return this.configurationService.getValue("customizeUI.activityBar") !== "bottom";
            }

            activityBarIsWide() {
                return this.configurationService.getValue("customizeUI.activityBar") === "wide";
            }

            statusBarOnTop() {
                return this.configurationService.getValue("customizeUI.statusBarPosition") == "top";
            }

            activityBarIsVisible() {
                return this.layout && this.layout.isVisible("workbench.parts.activitybar") &&
                    this.activityBarIsVertical();
            }

            activityBarWidth() {
                return this.activityBarIsWide() ? this.trafficLightDimensions().width : 50;
            }

            init(titleBarIsInline) {
                if (titleBarIsInline) document.body.classList.add("inline-title-bar");

                window.setTimeout(function() {
                    // workaround for https://github.com/electron/electron/issues/21034
                    let fix = document.createElement("div");
                    fix.style.webkitAppRegion="no-drag";
                    document.body.appendChild(fix);
                }, 0);

                if (browser.PixelRatio) {
                    browser.PixelRatio.onDidChange(this.update.bind(this));
                } else if (browser.onDidChangeZoomLevel) {
                    browser.onDidChangeZoomLevel(this.update.bind(this));
                }
                browser.onDidChangeFullscreen(this.update.bind(this));
                this.update();

                let self = this;

                // account for margin-top in activity bar
                utils.override(activitybarPart.ActivitybarPart, "layout", function (original, args) {
                    if (this.layoutService.isVisible("workbench.parts.activitybar") &&
                        self.activityBarIsVertical() &&
                        !self.isFullScreen() &&
                        this.layoutService.getSideBarPosition() == 0 /* LEFT */)
                        args[1] -= self.trafficLightDimensions().height;
                    original();
                });

                if (titleBarIsInline) {
                    // add placeholder so that we can change color of activity bar behind traffic lights
                    utils.override(activitybarPart.ActivitybarPart, "createContentArea", function (original, args) {
                        let res = original();

                        let parent = args[0];
                        this._placeholder = document.createElement('div');
                        this._placeholder.classList.add("activity-bar-placeholder");

                        if (!self.activityBarIsWide()) {
                            parent.appendChild(this._placeholder);
                        }

                        return res;
                    });

                    let color = colorRegistry.registerColor("inlineTitleBar.background", null);

                    // actually change the color
                    utils.override(activitybarPart.ActivitybarPart, "updateStyles", function (original) {
                        original();
                        let color = this.getColor("inlineTitleBar.background") || this.getColor("sideBar.background");
                        this._placeholder.style.backgroundColor = color;
                    });
                }

                utils.override(part.Part, "layoutContents", function (original) {
                    // we need to override height for composite title, but only when laying
                    // out sidebar title
                    if (self.statusBarOnTop() &&
                        this.id === "workbench.parts.statusbar" && this._hasListener == undefined) {
                        this.element.addEventListener("dblclick", () => self.windowService.onWindowTitleDoubleClick());
                        this._hasListener = true;
                    }

                    if (this.id === "workbench.parts.sidebar") {
                        let c = this.partLayout.__proto__.constructor;
                        let prev = c.TITLE_HEIGHT;
                        c.TITLE_HEIGHT = self.trafficLightDimensions().height;
                        let res = original();
                        c.TITLE_HEIGHT = prev;
                        return res;
                    } else {
                        return original();
                    }
                });

                utils.override(compositePart.CompositePart, "createTitleArea", function (original) {
                    let res = original();
                    if (this.id === "workbench.parts.sidebar") {
                        this._titleArea = res;
                        res.addEventListener("dblclick", () => self.windowService.onWindowTitleDoubleClick());
                    }
                    return res;
                });

                utils.override(layout.Layout, "initLayout", function (original) {
                    original();
                    self.layout = this;
                });

                utils.override(layout.Layout, "setActivityBarHidden", function (original) {
                    original();
                    self.update();
                });

                utils.override(layout.Layout, "setSideBarHidden", function (original) {
                    original();
                    self.update();
                });

                utils.override(layout.Layout, "setSideBarPosition", function (original) {
                    original();
                    self.update();
                });

                utils.override(layout.Layout, "centerEditorLayout", function (original) {
                    original();
                    self.update();
                });

                if (titleBarIsInline) {
                    // Pad title to account for traffic lights
                    utils.override(compositePart.CompositePart, "updateStyles", function (original) {
                        original();
                        if (this._titleArea) {
                            let color = this.getColor("inlineTitleBar.background");
                            this._titleArea.style.backgroundColor = color;
                            let padding = 0;
                            if (self.isFullScreen() || self.layout.getSideBarPosition() == 1) {
                                padding = 8; // default
                            } else if (self.activityBarIsVisible()) {
                                padding = Math.max(self.trafficLightDimensions().width - self.activityBarWidth() - 14, 0);
                            } else {
                                padding = self.trafficLightDimensions().width - 14;
                            }
                            this._titleArea.style.paddingLeft = `${padding}px`;
                        }
                    });
                }


                // Dragging in empty space after tabs
                let replacement = function (original) {
                    // remove draggin area element

                    if (this.tabsContainer.lastChild) {
                        this.tabsContainer.removeChild(this.tabsContainer.lastChild);
                    }

                    // call original handler to create / delete tab nodes
                    let res = original();

                    // append dragging area
                    let node = document.createElement("div");
                    let container = this.tabsContainer;
                    node.addEventListener("mousedown", (e) => e.preventDefault());

                    // forward drag and drop
                    let forward = function (oldEvent) {
                        let e = new oldEvent.constructor(oldEvent.type, oldEvent);
                        oldEvent.cancelBubble = true;
                        oldEvent.preventDefault();
                        return container.dispatchEvent(e);
                    }
                    node.addEventListener("dragenter", forward);
                    node.addEventListener("dragleave", forward);
                    node.addEventListener("dragover", forward);
                    node.addEventListener("dragend", forward);
                    node.addEventListener("drop", forward);

                    // doubleclick to zoom
                    node.addEventListener("dblclick", () => self.windowService.onWindowTitleDoubleClick());

                    this.tabsContainer.appendChild(node);

                    let service = this.accessor;
                    let group = this.group;

                    // when this function is invoked during restore, there is no
                    // grid widget present just yet
                    window.setTimeout(function () {
                        if (document.body.contains(node)) { // still in document
                            // check if this is topmost group
                            let groupAbove = service.findGroup({ direction: 0 }, group);
                            if (!groupAbove) {
                                node.className = "dragging-area-top";
                            }
                        }

                    }, 0);

                    return res;
                }

                utils.override(ttt.TabsTitleControl, "openEditor", replacement);
                utils.override(ttt.TabsTitleControl, "handleClosedEditors", replacement);

                if (titleBarIsInline) {
                    // left padding when sidebar is disabled
                    utils.override(ttt.TabsTitleControl, "create", function (original) {
                        original();

                        let tabsAndActions = this.titleContainer.childNodes[0];
                        let leftPadding = document.createElement("div");
                        leftPadding.classList.add("dragging-area-left-padding");
                        tabsAndActions.insertBefore(leftPadding, tabsAndActions.childNodes[0]);

                        // Set padding for first tab
                        if (!self._paddingUpdated) {
                            self.updateTabsLeftPadding(leftPadding, 0);
                            self._paddingUpdated = true;
                        }
                    });

                    utils.override(titleControl.NoTabsTitleControl, "create", function(original) {
                        original();
                        let tabsAndActions = this.titleContainer.childNodes[0];
                        let leftPadding = document.createElement("div");
                        leftPadding.classList.add("dragging-area-left-padding");
                        tabsAndActions.insertBefore(leftPadding, tabsAndActions.childNodes[0]);
                        tabsAndActions.classList.add("no-tabs");

                        // Set padding for first tab
                        if (!self._paddingUpdatedNoTabs) {
                            self.updateTabsLeftPadding(leftPadding, 0);
                            self._paddingUpdatedNoTabs = true;
                        }
                    });
                }
            }

            sideBarHidden() {
                if (this.layoutState) {
                    return this.layout.stateModel.getRuntimeValue(this.layoutState.LayoutStateKeys.SIDEBAR_HIDDEN)
                } else {
                    return this.layout.state.sideBar.hidden
                }
            }

            sideBarPosition() {
                if (this.layoutState) {
                    return this.layout.stateModel.getRuntimeValue(this.layoutState.LayoutStateKeys.SIDEBAR_POSITION)
                } else {
                    return this.layout.state.sideBar.position
                }
            }

            updateTabsLeftPadding(node, index) {
                if (index == 0 &&
                    !this.isFullScreen() &&
                    (this.sideBarHidden() || this.sideBarPosition() == 1 /* rigth */)) {
                    let val = this.trafficLightDimensions().width;
                    if (this.activityBarIsVisible() && this.sideBarPosition() != 1)
                        val -= this.activityBarWidth();
                    node.style.width = `${val}px`;
                } else {
                    node.style.width = "0px";
                }
            }

            update() {
                editor.EDITOR_TITLE_HEIGHT = this.trafficLightDimensions().height;
                this.updateStyle();
                if (this.layout) {
                    // Sometimes layout get computed while we have old isFullScreen value, so force relayout
                    if (this.layout.workbenchGrid)
                        this.layout.layout();

                    if (!this.sideBarHidden()) {
                        let part = this.layout.getPart("workbench.parts.sidebar");
                        if (part.getContainer()) {
                            part.updateStyles();
                        }
                    }

                    let padding = document.getElementsByClassName("dragging-area-left-padding");
                    if (padding) {
                        for (let i = 0; i < padding.length; ++i) {
                            this.updateTabsLeftPadding(padding[i], i);
                        }
                    }
                }
            }
        };

        let init = function(instantiationService, windowService) {
            let args = [
                utils.param(0, configuration.IConfigurationService)
            ];
            if (!windowService) {
                args.push(utils.param(1, windows.IWindowService));
            }
            CustomizeTitleBar = utils.decorate(args, CustomizeTitleBar);
            let instance = instantiationService.createInstance(CustomizeTitleBar);
            if (windowService) {
                instance.windowService = windowService;
            }
        }

        // IWindowService got replaced by IElectronService;
        exports.run = function (instantiationService) {
            if (windows.IWindowService) {
                init(instantiationService);
            } else {

                let ElectronHelper = class ElectronHelper {
                    constructor(electronService) {
                        this.electronService = electronService;

                        this.onWindowTitleDoubleClick = function() {
                            this.electronService.handleTitleDoubleClick();
                        }
                    }
                }

                let haveElectron = function(electron) {
                    ElectronHelper = utils.decorate([
                        utils.param(0, electron.IElectronService),
                    ], ElectronHelper);
                    let helper = instantiationService.createInstance(ElectronHelper);
                    init(instantiationService, helper);
                }

                let haveElectron2 = function(electron) {
                    ElectronHelper = utils.decorate([
                        utils.param(0, electron.INativeHostService),
                    ], ElectronHelper);
                    let helper = instantiationService.createInstance(ElectronHelper);
                    init(instantiationService, helper);
                }

                require(["vs/platform/electron/node/electron"], haveElectron, function(error) {} );
                require(["vs/platform/electron/electron-sandbox/electron"], haveElectron, function(error) { });
                require(["vs/platform/native/electron-sandbox/native"], haveElectron2, function(error) { });
            }
        }

    }

    require(["vs/platform/windows/common/windows"], perform, function (error) {});
    require(["vs/platform/window/common/window"], perform, function (error) {});
});
