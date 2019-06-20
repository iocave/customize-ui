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
    "vs/platform/theme/common/themeService"
], function (exports, utils, compositeBar, actionBar, activitybarPart, dom, grid, windowService, layout, configuration, activitybarActions, themeService) {

    let override = utils.override;

    let actionWidth = 32;
    let actionHeight = 38;
    let sideMargin = 4;

    // CompositeBar

    class _CompositeBar extends compositeBar.CompositeBar {
        constructor(items, options) {
            if (options && options.compositeSize == 50 && options.orientation == 2) { // action bar
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

    moveActivityBarToBottom = function (theme) {

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

    let CustomizeActivityBar = class CustomizeActivityBar {
        constructor(configurationService, themeService) {
            if (configurationService.getValue("customizeUI.activityBar") === "bottom" &&
                configurationService.getValue("workbench.useExperimentalGridLayout") == true) {
                moveActivityBarToBottom(themeService.getTheme());
            }
        }
    }

    CustomizeActivityBar = utils.decorate([
        utils.param(0, configuration.IConfigurationService),
        utils.param(1, themeService.IThemeService)
    ], CustomizeActivityBar);

    exports.run = function (instantationService) {
        instantationService.createInstance(CustomizeActivityBar);
    }

});