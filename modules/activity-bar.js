define([
    "exports",
    "customize-ui/utils",
    "vs/workbench/browser/parts/compositeBar",
    "vs/base/browser/ui/actionbar/actionbar",
    "vs/workbench/browser/parts/activitybar/activitybarPart",
    "vs/base/browser/dom",
    "vs/base/browser/ui/grid/grid",
    "vs/platform/windows/common/windows",
    "vs/workbench/browser/layout",
    "vs/platform/configuration/common/configuration",
    "vs/workbench/browser/parts/activitybar/activitybarActions",
    "vs/platform/theme/common/themeService",
    "vs/platform/telemetry/common/telemetry", // required to instantiate before theme service otherwise there's cyclical dependency error :-/
    "vs/base/browser/browser",
], function (exports, utils, compositeBar, actionBar, activitybarPart, dom, grid, windowService, layout, configuration, activitybarActions, themeService, telemetry, browser) {

    let override = utils.override;

    let actionWidth = 32;
    let actionHeight = 38;
    let sideMargin = 4;

    // CompositeBar

    class _CompositeBar extends compositeBar.CompositeBar {
        constructor(items, options) {
            if (options && (options.compositeSize == 50 || options.compositeSize == 52)  &&
                options.orientation == 2) { // action bar
                options.orientation = 0; // horizontal
                options.compositeSize = actionWidth;
                options.overflowActionSize = actionWidth;
            }
            super(...arguments);
        }
    }

    // ActionBar

    class _ActionBar extends actionBar.ActionBar {
        constructor(container, options) {
            if (options && container &&
                container.parentNode && container.parentNode.parentNode &&
                container.parentNode.parentNode.classList.contains("activitybar")) {
                options.compositeSize = actionWidth;
                options.overflowActionSize = actionWidth;
                options.orientation = 0;
                options.hidePart = function() {
                };
            }
            super(...arguments);
        }
    }

    moveActivityBarToBottomLegacy1 = function (theme) {

        compositeBar.CompositeBar = _CompositeBar;
        actionBar.ActionBar = _ActionBar;

        override(activitybarPart.ActivitybarPart, "layout", function (original, args) {
            let width = args[0];
            let height = args[1];

            if (!this.layoutService.isVisible("workbench.parts.activitybar" /* ACTIVITYBAR_PART */)) {
                return;
            }
            // Layout contents
            const contentAreaSize = this.layoutContents(width, height).contentSize;

            // Layout composite bar
            let availableWidth = contentAreaSize.width;
            availableWidth -= 2 * sideMargin;
            if (this.globalActionBar) {
                availableWidth -= (this.globalActionBar.viewItems.length * actionWidth); // adjust width for global actions showing
            }

            this.compositeBar.layout(new dom.Dimension(availableWidth, height));
        });

        override(activitybarPart.ActivitybarPart, "updateStyles", function(original) {
            original();
            const container = this.getContainer();
            const sideBorderColor = this.getColor("sideBar.border") || this.getColor("contrastBorder");
            const borderColor = this.getColor("activityBar.border") || this.getColor("contrastBorder");
            const isPositionLeft = this.layoutService.getSideBarPosition() === 0 /* left */;
            container.style.borderRightWidth = sideBorderColor && isPositionLeft ? '1px' : null;
            container.style.borderRightStyle = sideBorderColor && isPositionLeft ? 'solid' : null;
            container.style.borderRightColor = isPositionLeft ? sideBorderColor : null;
            container.style.borderLeftWidth = sideBorderColor && !isPositionLeft ? '1px' : null;
            container.style.borderLeftStyle = sideBorderColor && !isPositionLeft ? 'solid' : null;
            container.style.borderLeftColor = !isPositionLeft ? sideBorderColor : null;
            container.style.borderTopColor = borderColor ? borderColor : null;
            container.style.borderTopWidth = borderColor ? "1px" : null;
            container.style.borderTopStyle = borderColor ? "solid" : null;

            // Not ideal, but changing layout because of border seems to be bit of overkill
            container.style.marginTop = borderColor ? "-1px" : null;
        });

        override(layout.Layout, "layoutGrid", function (original) {

            if (!(this.workbenchGrid instanceof grid.Grid)) {
                return;
            }

            let panelInGrid = this.workbenchGrid.hasView(this.panelPartView);
            let sidebarInGrid = this.workbenchGrid.hasView(this.sideBarPartView);
            let activityBarInGrid = this.workbenchGrid.hasView(this.activityBarPartView);
            let statusBarInGrid = this.workbenchGrid.hasView(this.statusBarPartView);
            let titlebarInGrid = this.workbenchGrid.hasView(this.titleBarPartView);

            if (!titlebarInGrid && windowService.getTitleBarStyle(this.configurationService, this.environmentService) === 'custom') {
                this.workbenchGrid.addView(this.titleBarPartView, "split" /* Split */, this.editorPartView, 0 /* Up */);
                titlebarInGrid = true;
            }

            if (!sidebarInGrid) {
                this.workbenchGrid.addView(this.sideBarPartView, this.state.sideBar.width !== undefined ? this.state.sideBar.width : "split" /* Split */, panelInGrid && this.state.sideBar.position === this.state.panel.position ? this.panelPartView : this.editorPartView, this.state.sideBar.position === 1 /* RIGHT */ ? 3 /* Right */ : 2 /* Left */);
                sidebarInGrid = true;
            }

            if (!this._propertiesOverriden) {
                let a = this.activityBarPartView;
                Object.defineProperty(a.view, 'maximumHeight', {
                    value: actionHeight,
                    writable: false
                });
                Object.defineProperty(a.view, 'minimumHeight', {
                    value: actionHeight,
                    writable: false
                });
                Object.defineProperty(a.view, 'maximumWidth', {
                    value: Infinity,
                    writable: false
                });
                Object.defineProperty(a.view, 'minimumWidth', {
                    value: 0,
                    writable: false
                });

                // Make statusbar very slightly thinner so that the debug console input is flush with activity bar
                a = this.statusBarPartView;
                Object.defineProperty(a.view, 'maximumHeight', {
                    value: 20,
                    writable: false
                });
                Object.defineProperty(a.view, 'minimumHeight', {
                    value: 20,
                    writable: false
                });

                // Sidebar orientation is a bit confused since we added a view below it,
                // so we need to override the maximum width/height properties in order
                // for hiding to work

                Object.defineProperty(this.sideBarPartView, 'maximumWidth', {
                    configurable: true,
                    get() {
                        return this.visible ? this.view.maximumWidth : 0;
                    },
                });

                Object.defineProperty(this.sideBarPartView, 'maximumHeight', {
                    configurable: true,
                    get() {
                        return Infinity;
                    },
                });
                this._propertiesOverriden = true;
            }

            if (!activityBarInGrid) {
                this.workbenchGrid.addView(this.activityBarPartView, "split" /* Split */, this.sideBarPartView, 1 /* Down */);
                activityBarInGrid = true;
            }
            if (!panelInGrid) {
                this.workbenchGrid.addView(this.panelPartView, this.getPanelDimension(this.state.panel.position) !== undefined ? this.getPanelDimension(this.state.panel.position) : "split" /* Split */, this.editorPartView, this.state.panel.position === 2 /* BOTTOM */ ? 1 /* Down */ : 3 /* Right */);
                panelInGrid = true;
            }
            if (!statusBarInGrid) {
                this.workbenchGrid.addView(this.statusBarPartView, "split" /* Split */, this.state.panel.position === 2 /* bottom */ ? this.panelPartView : this.editorPartView, 1 /* Down */);
                statusBarInGrid = true;
            }

            let w = this.sideBarPartView.width;
            let minw = this.sideBarPartView.minimumWidth;

            // this is necessary for sidebar to preserve it's width
            // (otherwise it gets shrunk to minimum width)

            Object.defineProperty(this.sideBarPartView, 'minimumWidth', {
                configurable: true,
                get() {
                    return w;
                },
            });

            original();

            Object.defineProperty(this.sideBarPartView, 'minimumWidth', {
                configurable: true,
                get() {
                    return minw;
                },
            });
        });

        let focusBorder = theme.getColor("focusBorder") || "transparent";

        override(activitybarActions.ViewletActivityAction, "run", function(original) {
            // don't let action hide sidebar
            let orig = this.layoutService.setSideBarHidden;
            this.layoutService.setSideBarHidden = function() {}
            let res = original();
            this.layoutService.setSideBarHidden = orig;
            return res;
        });

        document.body.classList.add("activity-bar-at-bottom");

        utils.addStyle(`:root {
            --activity-bar-action-width: ${actionWidth}px;
            --activity-bar-action-height: ${actionHeight}px;
            --activity-bar-side-margin: ${sideMargin}px;
            --focus-border: ${focusBorder};
            }`);
    }

    let CustomizeActivityBarLegacy1 = class CustomizeActivityBarLegacy1 {
        constructor(configurationService, themeService) {
            if (configurationService.getValue("customizeUI.activityBar") === "bottom") {
                moveActivityBarToBottomLegacy1(themeService.getTheme());
            }
        }
    }

    moveActivityBarToBottomLegacy2 = function (theme) {
        compositeBar.CompositeBar = _CompositeBar;
        actionBar.ActionBar = _ActionBar;

        override(activitybarPart.ActivitybarPart, "layout", function (original, args) {
            let width = args[0];
            let height = args[1];

            if (!this.layoutService.isVisible("workbench.parts.activitybar" /* ACTIVITYBAR_PART */)) {
                return;
            }
            // Layout contents
            const contentAreaSize = this.layoutContents(width, height).contentSize;

            // Layout composite bar
            let availableWidth = contentAreaSize.width;
            availableWidth -= 2 * sideMargin;
            if (this.globalActivityActionBar) {
                availableWidth -= (this.globalActivityActionBar.viewItems.length * actionWidth); // adjust width for global actions showing
            }
            this.compositeBar.layout(new dom.Dimension(availableWidth, height));
        });

        override(activitybarPart.ActivitybarPart, "updateStyles", function(original) {
            original();
            const container = this.getContainer();
            const sideBorderColor = this.getColor("sideBar.border") || this.getColor("contrastBorder");
            const borderColor = this.getColor("activityBar.border") || this.getColor("contrastBorder");
            const isPositionLeft = this.layoutService.getSideBarPosition() === 0 /* left */;
            container.style.borderRightWidth = sideBorderColor && isPositionLeft ? '1px' : null;
            container.style.borderRightStyle = sideBorderColor && isPositionLeft ? 'solid' : null;
            container.style.borderRightColor = isPositionLeft ? sideBorderColor : null;
            container.style.borderLeftWidth = sideBorderColor && !isPositionLeft ? '1px' : null;
            container.style.borderLeftStyle = sideBorderColor && !isPositionLeft ? 'solid' : null;
            container.style.borderLeftColor = !isPositionLeft ? sideBorderColor : null;
            container.style.borderTopColor = borderColor ? borderColor : null;
            container.style.borderTopWidth = borderColor ? "1px" : null;
            container.style.borderTopStyle = borderColor ? "solid" : null;

            // Not ideal, but changing layout because of border seems to be bit of overkill
            container.style.marginTop = borderColor ? "-1px" : null;
        });

        override(layout.Layout, "createWorkbenchLayout", function(original){

            let storageService = this.storageService;
            let prevGet = storageService.get;
            let prevStore = storageService.store;

            // Serialize grid layout under different key

            storageService.get = function() {
                if (arguments[0] === "workbench.grid.layout")
                    arguments[0] = "workbench.grid.layout-bottom-activity-bar";
                return prevGet.apply(storageService, arguments);
            }

            storageService.store = function() {
                if (arguments[0] === "workbench.grid.layout")
                    arguments[0] = "workbench.grid.layout-bottom-activity-bar";
                return prevStore.apply(storageService, arguments);
            }

            let statusBarPartView = this.getPart("workbench.parts.statusbar");

            this.updateActivityPartSize = (visible) => {
                let activityBarPartView =  this.getPart("workbench.parts.activitybar");
                if (visible) {
                    activityBarPartView.minimumWidth = 0;
                    activityBarPartView.maximumWidth = Infinity;
                    activityBarPartView.minimumHeight = actionHeight;
                    activityBarPartView.maximumHeight = actionHeight;
                } else {
                    activityBarPartView.minimumWidth = 0;
                    activityBarPartView.maximumWidth = 0;
                    activityBarPartView.minimumHeight = 0;
                    activityBarPartView.maximumHeight = Infinity;
                }
            }

            this.updateActivityPartSize(!this.state.sideBar.hidden);
            statusBarPartView.maximumHeight = 20;

            // this is hacky workaround for Bad grid exception after deserialization

            this.state.sideBar.position = this.state.sideBar.hidden ? 0 : 1;
            let prevIsGridBranchNode = grid.isGridBranchNode;
            grid.isGridBranchNode = function(node) {
                if (typeof node === "undefined")
                    return true;
                else
                    return prevIsGridBranchNode(node);
            }

            let res = original();

            grid.isGridBranchNode = prevIsGridBranchNode;

            this.state.sideBar.position = 0;

            return res;
        });

        override(layout.Layout, "layoutGrid", function (original) {

            if (!(this.workbenchGrid instanceof grid.Grid)) {
                return;
            }

            let panelInGrid = this.workbenchGrid.hasView(this.panelPartView);
            let sidebarInGrid = this.workbenchGrid.hasView(this.sideBarPartView);
            let activityBarInGrid = this.workbenchGrid.hasView(this.activityBarPartView);
            let statusBarInGrid = this.workbenchGrid.hasView(this.statusBarPartView);
            let titlebarInGrid = this.workbenchGrid.hasView(this.titleBarPartView);

            if (!titlebarInGrid) {
                this.workbenchGrid.addView(this.titleBarPartView, "split" /* Split */, this.editorPartView, 0 /* Up */);
                titlebarInGrid = true;
            }

            if (!sidebarInGrid) {
                this.workbenchGrid.addView(this.sideBarPartView, this.state.sideBar.width !== undefined ? this.state.sideBar.width : "split" /* Split */, this.editorPartView, 2 /* Left */);
                sidebarInGrid = true;
            }

            if (!activityBarInGrid) {
                this.workbenchGrid.addView(this.activityBarPartView, "split" /* Split */, this.sideBarPartView, 1 /* Down */);
                activityBarInGrid = true;
            }

            if (!panelInGrid) {
                this.workbenchGrid.addView(this.panelPartView, "split" /* Split */, this.editorPartView, this.state.panel.position === 2 /* BOTTOM */ ? 1 /* Down */ : 3 /* Right */);
                panelInGrid = true;
            }

            // Add parts to grid
            if (!statusBarInGrid) {
                this.workbenchGrid.addView(this.statusBarPartView, "split" /* Split */, this.panelPartView, 1 /* Down */);
                statusBarInGrid = true;
            }
            original();
        });

        override(layout.Layout, "layout", function(original){
            let old = this.sideBarPartView.minimumWidth;
            if (this.state.sideBar.width > 0) {
                this.sideBarPartView.minimumWidth = this.state.sideBar.width;
            }
            original();
            this.sideBarPartView.minimumWidth = old;
        });

        override(layout.Layout, "setSideBarHidden", function(original, arguments) {

            let hidden = arguments[0];

            if (this.workbenchGrid instanceof grid.SerializableGrid && hidden) {
                let sss = this.workbenchGrid.getViewSize(this.sideBarPartView);
                if (sss.width > 0) {
                    this.state.sideBar.width = sss.width;
                }
            }

            if (hidden) {
                this.updateActivityPartSize(false);
                this.workbenchGrid.removeView(this.activityBarPartView);
                this.workbenchGrid.addView(this.activityBarPartView, "split" /* Split */, this.sideBarPartView, 2);
                original();
            } else {
                original();
                this.workbenchGrid.removeView(this.activityBarPartView);
                this.workbenchGrid.addView(this.activityBarPartView, "split" /* Split */, this.sideBarPartView, 1);
                this.updateActivityPartSize(true);
            }
        });

        let focusBorder = theme.getColor("focusBorder") || "transparent";

        override(activitybarActions.ViewletActivityAction, "run", function(original) {
            // don't let action hide sidebar
            let orig = this.layoutService.setSideBarHidden;
            this.layoutService.setSideBarHidden = function() {}
            let res = original();
            this.layoutService.setSideBarHidden = orig;
            return res;
        });

        document.body.classList.add("activity-bar-at-bottom");

        utils.addStyle(`:root {
            --activity-bar-action-width: ${actionWidth}px;
            --activity-bar-action-height: ${actionHeight}px;
            --activity-bar-side-margin: ${sideMargin}px;
            --focus-border: ${focusBorder};
            }`);
    }

    let CustomizeActivityBarLegacy2 = class CustomizeActivityBarLegacy2 {
        constructor(configurationService, telemetry, themeService) {
            if (configurationService.getValue("customizeUI.activityBar") === "bottom") {
                moveActivityBarToBottomLegacy2(themeService.getTheme());
            }
        }
    }

    extendActivityBar = function() {
        // FIXME - this is copy and paste from title-bar module;
        let traffictLightDimensions = function() {
            let size = {
                width: 77,
                height: 37,
            }
            return {
                width: size.width / browser.getZoomFactor(),
                height: size.height / browser.getZoomFactor(),
            };
        }

        layout.Layout.prototype._updateActivityBar = function(visible) {
            let a = this.activityBarPartView;
            a.minimumWidth = traffictLightDimensions().width;
            a.maximumWidth = traffictLightDimensions().width;
        }

        override(layout.Layout, "createWorkbenchLayout", function(original) {
            original();
            this.layout();
            this._updateActivityBar(!this.state.sideBar.hidden);
        });

        document.body.classList.add("activity-bar-wide");
    }

    moveActivityBarToBottom = function(theme, hideSettings) {

        compositeBar.CompositeBar = _CompositeBar;
        actionBar.ActionBar = _ActionBar;

        override(activitybarPart.ActivitybarPart, "layout", function (original, args) {
            let width = args[0];
            let height = args[1];

            if (!this.layoutService.isVisible("workbench.parts.activitybar" /* ACTIVITYBAR_PART */)) {
                return;
            }
            // Layout contents
            const contentAreaSize = this.layoutContents(width, height).contentSize;

            // Layout composite bar
            let availableWidth = contentAreaSize.width;
            availableWidth -= 2 * sideMargin;

            if (this.homeBarContainer) {
                availableWidth -= this.homeBarContainer.clientHeight;
            }
            if (this.menuBarContainer) {
                availableWidth -= this.menuBarContainer.clientHeight;
            }

            if (this.globalActivityActionBar) {
                availableWidth -= (this.globalActivityActionBar.viewItems.length * actionWidth); // adjust width for global actions showing
            }
            this.compositeBar.layout(new dom.Dimension(availableWidth, height));
        });

        override(activitybarPart.ActivitybarPart, "createGlobalActivityActionBar", function(original) {
            if (!hideSettings) {
                original();
            }
        });

        override(activitybarPart.ActivitybarPart, "updateStyles", function(original) {
            original();
            const container = this.getContainer();
            const sideBorderColor = this.getColor("sideBar.border") || this.getColor("contrastBorder");
            const borderColor = this.getColor("activityBar.border") || this.getColor("contrastBorder");
            const isPositionLeft = this.layoutService.getSideBarPosition() === 0 /* left */;
            container.style.borderRightWidth = sideBorderColor && isPositionLeft ? '1px' : null;
            container.style.borderRightStyle = sideBorderColor && isPositionLeft ? 'solid' : null;
            container.style.borderRightColor = isPositionLeft ? sideBorderColor : null;
            container.style.borderLeftWidth = sideBorderColor && !isPositionLeft ? '1px' : null;
            container.style.borderLeftStyle = sideBorderColor && !isPositionLeft ? 'solid' : null;
            container.style.borderLeftColor = !isPositionLeft ? sideBorderColor : null;
            container.style.borderTopColor = borderColor ? borderColor : null;
            container.style.borderTopWidth = borderColor ? "1px" : null;
            container.style.borderTopStyle = borderColor ? "solid" : null;

            // Not ideal, but changing layout because of border seems to be bit of overkill
            container.style.marginTop = borderColor ? "-1px" : null;
        });

        let focusBorder = theme.getColor("focusBorder") || "transparent";

        let replacement = function(original) {
            // don't let action hide sidebar
            let orig = this.layoutService.setSideBarHidden;
            this.layoutService.setSideBarHidden = function() {}
            let res = original();
            this.layoutService.setSideBarHidden = orig;
            return res;
        }

        if (activitybarActions.ViewContainerActivityAction) {
            override(activitybarActions.ViewContainerActivityAction, "run", replacement);
        }

        if (activitybarActions.ViewletActivityAction) {
            override(activitybarActions.ViewletActivityAction, "run", replacement);
        }

        layout.Layout.prototype._updateActivityBar = function(visible) {
            let a = this.activityBarPartView;
            if (visible) {
                a.minimumWidth = 0;
				a.maximumWidth = Infinity;
				a.minimumHeight = actionHeight;
                a.maximumHeight = actionHeight;
				this.workbenchGrid.moveView(this.activityBarPartView, a.minimumHeight, this.sideBarPartView, 1 /* Down */);
                this.workbenchGrid.setViewVisible(this.activityBarPartView, !this.state.activityBar.hidden);

                // restore sidebar size
                if (this._prevSidebarSize) {
                    let size = this.workbenchGrid.getViewSize(this.sideBarPartView);
                    size.width = this._prevSidebarSize;
                    this.workbenchGrid.resizeView(this.sideBarPartView, size);
                }
            } else {
                // preserve sidebar size when hidden; this is necessary when sidebar is on right
                const sideBarSize = this.state.sideBar.hidden
				    ? this.workbenchGrid.getViewCachedVisibleSize(this.sideBarPartView)
                    : this.workbenchGrid.getViewSize(this.sideBarPartView).width;
                if (sideBarSize > 0) {
                    this._prevSidebarSize = sideBarSize;
                }

                a.minimumWidth = 0;
				a.maximumWidth = 0;
				a.minimumHeight = 0;
				a.maximumHeight = Infinity;
				if (this.state.sideBar.position === 0 /* Left */) {
					this.workbenchGrid.moveViewTo(this.activityBarPartView, [1, 0]);
				} else {
				    this.workbenchGrid.moveView(this.activityBarPartView, 0, this.sideBarPartView, 3 /* Right */);
				}
            }
        }

        layout.Layout.prototype._updateStatusBar = function(active) {
            this.statusBarPartView.maximumHeight = 20;
            if (active) {
                if (this.state.panel.position === 1 /* right */) {
					this.workbenchGrid.moveView(this.statusBarPartView, this.statusBarPartView.minimumHeight, this.editorPartView, 1 /* Down */);
				} else {
                    let size = this.workbenchGrid.getViewSize(this.panelPartView);
                    this.workbenchGrid.moveView(this.statusBarPartView, this.statusBarPartView.minimumHeight, this.panelPartView, 1 /* Down */);
                    this.workbenchGrid.resizeView(this.panelPartView, size);
				}
            } else {
                this.workbenchGrid.moveViewTo(this.statusBarPartView, [2]);
            }
        }

        override(layout.Layout, "createWorkbenchLayout", function(original) {
            original();
            this.layout();
            // preserve size after updating status bar; this is necessary for sidebar to not grow
            // during startup when moved right
            let size = this.workbenchGrid.getViewSize(this.sideBarPartView);
            this._updateActivityBar(!this.state.sideBar.hidden);
            this._updateStatusBar(true);
            this.workbenchGrid.resizeView(this.sideBarPartView, size);
        });

        override(layout.Layout, "setSideBarHidden", function(original) {
            this._updateActivityBar(false);
            original();
            if (!this.state.sideBar.hidden) {
                this._updateActivityBar(true);
            }
        });

        override(layout.Layout, "setSideBarPosition", function(original) {
            this._updateActivityBar(false);
            original();
            this._updateActivityBar(!this.state.sideBar.hidden);
        });

        override(layout.Layout, "setPanelPosition", function(original) {
            this._updateStatusBar(false);
            original();
            this._updateStatusBar(true);
        });

        document.body.classList.add("activity-bar-at-bottom");

        utils.addStyle(`:root {
            --activity-bar-action-width: ${actionWidth}px;
            --activity-bar-action-height: ${actionHeight}px;
            --activity-bar-side-margin: ${sideMargin}px;
            --focus-border: ${focusBorder};
            }`);
    }

    let CustomizeActivityBar = class CustomizeActivityBar {
        constructor(configurationService, telemetry, themeService) {
            if (configurationService.getValue("customizeUI.activityBar") === "bottom") {
                let theme = themeService.getColorTheme ? themeService.getColorTheme() : themeService.getTheme();
                let hideSettings = configurationService.getValue("customizeUI.activityBarHideSettings");
                moveActivityBarToBottom(theme, hideSettings);
            }
            if (configurationService.getValue("customizeUI.activityBar") === "wide") {
                extendActivityBar();
            }
        }
    }

    CustomizeActivityBarLegacy1 = utils.decorate([
        utils.param(0, configuration.IConfigurationService),
        utils.param(1, themeService.IThemeService)
    ], CustomizeActivityBarLegacy1);

    CustomizeActivityBarLegacy2 = utils.decorate([
        utils.param(0, configuration.IConfigurationService),
        utils.param(1, telemetry.ITelemetryService), // workaround of cyclical dependency error, as theme service depends on it
        utils.param(2, themeService.IThemeService)
    ], CustomizeActivityBarLegacy2);

    CustomizeActivityBar = utils.decorate([
        utils.param(0, configuration.IConfigurationService),
        utils.param(1, telemetry.ITelemetryService), // workaround of cyclical dependency error, as theme service depends on it
        utils.param(2, themeService.IThemeService)
    ], CustomizeActivityBar);

    exports.run = function (instantationService) {
        if (grid.View !== undefined) {
            instantationService.createInstance(CustomizeActivityBarLegacy1);
        } else if (layout.Layout.prototype["layoutGrid"] !== undefined) {
            instantationService.createInstance(CustomizeActivityBarLegacy2);
        } else {
            instantationService.createInstance(CustomizeActivityBar);
        }
    }

});