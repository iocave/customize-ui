define([
    "exports",
    "customize-ui/utils",
    "vs/workbench/browser/parts/compositeBar",
    "vs/base/browser/ui/actionbar/actionbar",
    "vs/workbench/browser/parts/activitybar/activitybarPart",
    "vs/base/browser/dom",
    "vs/base/browser/ui/grid/grid",
    "vs/workbench/browser/layout",
    "vs/platform/configuration/common/configuration",
    "vs/workbench/browser/parts/activitybar/activitybarActions",
    "vs/platform/theme/common/themeService",
    "vs/platform/telemetry/common/telemetry", // required to instantiate before theme service otherwise there's cyclical dependency error :-/
    "vs/base/browser/browser",
], function (exports, utils, compositeBar, actionBar, activitybarPart, dom, grid, layout, configuration, activitybarActions, themeService, telemetry, browser) {

    let override = utils.override;

    let actionWidth = 32;
    let actionHeight = 35;
    let sideMargin = 4;

    // FIXME - this is copy and paste from title-bar module;
    let trafficLightDimensions = function () {
        let size = {
            width: 77,
            height: 37,
        }
        return {
            width: size.width / browser.getZoomFactor(),
            height: size.height / browser.getZoomFactor(),
        };
    }

    // CompositeBar

    class _CompositeBar extends compositeBar.CompositeBar {
        constructor(items, options) {
            if (options && (options.compositeSize == 50 || options.compositeSize == 52) &&
                (options.orientation == 1 || options.orientation == 2)) { // action bar
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
                options.hidePart = function () {
                };
            }
            super(...arguments);
        }
    }


    resizeActivityBar = function (activityBarPosition) {
        console.log(activityBarPosition)

        layout.Layout.prototype._updateActivityBar = function (visible) {
            let a = this.activityBarPartView;
            a.minimumWidth = trafficLightDimensions().width;
            a.maximumWidth = trafficLightDimensions().width;
        }

        override(layout.Layout, "createWorkbenchLayout", function (original) {
            original();
            this.layout();
            this._updateActivityBar(!this.stateModel.getRuntimeValue({ name: 'sideBar.hidden' }));
        });

        document.body.classList.add("activity-bar-wide");
    }

    moveActivityBarToPosition = function (theme, hideSettings, activityBarPosition, statusBarPosition) {
        compositeBar.CompositeBar = _CompositeBar;
        actionBar.ActionBar = _ActionBar;
        const order = activityBarPosition === "bottom" ? 1 : 0;
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

        override(activitybarPart.ActivitybarPart, "createGlobalActivityActionBar", function (original) {
            if (!hideSettings) {
                original();
            }
        });

        override(activitybarPart.ActivitybarPart, "updateStyles", function (original) {
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

            if (this.configurationService.getValue("customizeUI.statusBarPosition") === "top" && this.configurationService.getValue("customizeUI.activityBar") == "top") {
                container.style.backgroundColor = this.getColor("tab.inactiveBackground")
                container.style.backgroundColor = this.getColor("tab.inactiveBackground")
            }
        });

        let focusBorder = theme.getColor("focusBorder") || "transparent";

        let replacement = function (original) {
            // don't let action hide sidebar
            let orig = this.layoutService.setSideBarHidden;
            this.layoutService.setSideBarHidden = function () { }
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

        layout.Layout.prototype._updateActivityBar = function (visible) {
            let a = this.activityBarPartView;
            if (visible) {
                a.minimumWidth = 0;
                a.maximumWidth = Infinity;
                a.minimumHeight = actionHeight;
                a.maximumHeight = actionHeight;
                this.workbenchGrid.moveView(this.activityBarPartView, a.minimumHeight, this.sideBarPartView, order /* Down */);
                this.workbenchGrid.setViewVisible(this.activityBarPartView, !this.stateModel.getRuntimeValue({ name: 'activityBar.hidden' }));

                // restore sidebar size
                if (this._prevSidebarSize) {
                    let size = this.workbenchGrid.getViewSize(this.sideBarPartView);
                    size.width = this._prevSidebarSize;
                    this.workbenchGrid.resizeView(this.sideBarPartView, size);
                }
            } else {
                // preserve sidebar size when hidden; this is necessary when sidebar is on right
                const sideBarSize = this.stateModel.getRuntimeValue({ name: 'sideBar.hidden' })
                    ? this.workbenchGrid.getViewCachedVisibleSize(this.sideBarPartView)
                    : this.workbenchGrid.getViewSize(this.sideBarPartView).width;
                if (sideBarSize > 0) {
                    this._prevSidebarSize = sideBarSize;
                }

                a.minimumWidth = 0;
                a.maximumWidth = 0;
                a.minimumHeight = 0;
                a.maximumHeight = Infinity;
                if (this.stateModel.getRuntimeValue({ name: 'sideBar.position' }) === 0 /* Left */) {
                    this.workbenchGrid.moveViewTo(this.activityBarPartView, [1, 0]);
                } else {
                    this.workbenchGrid.moveView(this.activityBarPartView, 0, this.sideBarPartView, 3 /* Right */);
                }
            }
        }

        layout.Layout.prototype._updateStatusBar = function (active) {
            switch (statusBarPosition) {
                case "under-panel":
                    this.statusBarPartView.maximumHeight = 20;
                    if (active) {
                        this.workbenchGrid.moveView(this.statusBarPartView, this.statusBarPartView.minimumHeight, this.panelPartView, 1 /* Down */);
                    } else {
                        this.workbenchGrid.moveViewTo(this.statusBarPartView, [2]);
                    }
                    break;
                case "top":
                    this.statusBarPartView.minimumHeight =
                        this.statusBarPartView.maximumHeight = trafficLightDimensions().height;

                    this.statusBarPartView.styleOverrides.add({ background: 'activityBar.background' })
                    this.statusBarPartView.updateStyles()
                    this.statusBarPartView.getContainer().style.boxShadow = '0 -1px 4px 0 currentColor';
                    this.statusBarPartView.getContainer().style.marginBottom = '1px';
                    this.statusBarPartView.getContainer().style.height = trafficLightDimensions().height - 1;
                    this.activityBarPartView.updateStyles()

                    this.workbenchGrid.moveViewTo(this.statusBarPartView, [1]);
                    break;
                case "bottom":
                    // Statusbar is bottom by default; Nothing to do here.
                    break;
            }
        }

        override(layout.Layout, "createWorkbenchLayout", function (original) {
            original();
            this.layout();
            // preserve size after updating status bar; this is necessary for sidebar to not grow
            // during startup when moved right
            let size = this.workbenchGrid.getViewSize(this.sideBarPartView);
            this._updateActivityBar(!this.stateModel.getRuntimeValue({ name: 'sideBar.hidden' }));
            this._updateStatusBar(true);
            this.workbenchGrid.resizeView(this.sideBarPartView, size);
        });

        override(layout.Layout, "setSideBarHidden", function (original) {
            this._updateActivityBar(false);
            original();
            if (!this.stateModel.getRuntimeValue({ name: 'sideBar.hidden' })) {
                this._updateActivityBar(true);
            }
        });

        override(layout.Layout, "setSideBarPosition", function (original) {
            this._updateActivityBar(false);
            original();
            this._updateActivityBar(!this.state.sideBar.hidden);
        });

        override(layout.Layout, "setPanelPosition", function (original) {
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
            let activityBarPosition = configurationService.getValue("customizeUI.activityBar");
            switch (activityBarPosition) {
                case "top":
                case "bottom":
                    let theme = themeService.getColorTheme ? themeService.getColorTheme() : themeService.getTheme();
                    let hideSettings = configurationService.getValue("customizeUI.activityBarHideSettings");
                    let statusBarPosition = configurationService.getValue("customizeUI.statusBarPosition")
                        || (configurationService.getValue("customizeUI.moveStatusbar")
                            ? "under-panel"
                            : "bottom");
                    document.body.classList.add("status-bar-at-" + statusBarPosition);
                    moveActivityBarToPosition(theme, hideSettings, activityBarPosition, statusBarPosition);
                    break;
                case "narrow": /* TODO: narrow sized activity bar */
                case "wide":
                    resizeActivityBar(activityBarPosition);
                    break;
            }
        }
    }


    CustomizeActivityBar = utils.decorate([
        utils.param(0, configuration.IConfigurationService),
        utils.param(1, telemetry.ITelemetryService), // workaround of cyclical dependency error, as theme service depends on it
        utils.param(2, themeService.IThemeService)
    ], CustomizeActivityBar);

    exports.run = function (instantationService) {
        instantationService.createInstance(CustomizeActivityBar);
    }

});
