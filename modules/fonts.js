define([
    "exports",
    "customize-ui/utils",
    "vs/workbench/contrib/files/browser/views/explorerViewer",
    "vs/workbench/contrib/files/browser/views/openEditorsView",
    "vs/workbench/contrib/search/browser/searchResultsView",
    "vs/workbench/contrib/debug/browser/variablesView",
    "vs/workbench/contrib/debug/browser/callStackView",
    "vs/workbench/contrib/debug/browser/watchExpressionsView",
    "vs/workbench/contrib/debug/browser/loadedScriptsView",
    "vs/workbench/contrib/debug/browser/breakpointsView",
    "vs/platform/configuration/common/configuration",
], function(exports, utils, explorerView, openEditorsView, searchResultsView,
    variablesView, callStackView, watchExpressionsView, loadedScriptsView, breakpointsView, configuration) {

    let override = utils.override;
    let addStyle = utils.addStyle;

    let CustomizeFont = class CustomizeFont {
        constructor(configurationService) {
            this.configurationService = configurationService;

            let rowHeight = this.configurationService.getValue("customizeUI.listRowHeight") || 22;
            this.updateRowHeight(rowHeight);

            let fontSize = this.configurationService.getValue("customizeUI.fontSizeMap") || {};
            this.updateFontSize(fontSize);

            if (rowHeight <= 20)
                document.body.classList.add("row-height-lte20");

            let styleSheet = this.configurationService.getValue("customizeUI.stylesheet");
            if (styleSheet instanceof Object) {
                this.addCustomStyleSheet(styleSheet);
            }

            let fontFamily = this.configurationService.getValue("customizeUI.font.regular");
            if (typeof (fontFamily) == "string" && fontFamily.length > 0) {
                this.setFontFamily(fontFamily);
            }

            let monospaceFamily = this.configurationService.getValue("customizeUI.font.monospace");
            if (typeof (monospaceFamily) == "string" && monospaceFamily.length > 0) {
                this.setMonospaceFontFamily(monospaceFamily);
            }
        }

        addCustomStyleSheet(styleSheet) {
            let string = Object.entries(styleSheet).map(([key, value]) => {
                if (typeof value === 'object') {
                    value = Object.entries(value).map(([key, value]) => `${key}: ${value};`).join("\n")
                }
                return `${key} { ${value}; }`
            }).join("\n");
            addStyle(string);
        }

        setFontFamily(fontFamily) {
            addStyle(`.mac, .windows, .linux { font-family: "${fontFamily}" !important; }`);
        }

        setMonospaceFontFamily(fontFamily) {
            addStyle(`.mac, .windows, .linux { --monaco-monospace-font:"${fontFamily}" !important; }`);
        }

        updateFontSize(fontSizeMap) {
            let getFontSize = function (key) {
                let res = fontSizeMap[key];
                if (res === undefined)
                    res = key;
                if (res === "monospace")
                    res = "13px";
                if (res === "window-title")
                    res = getFontSize("12px");
                if (res === "tab-title")
                    res = getFontSize("13px");
                if (res == "menu")
                    res = getFontSize("12px");
                return res;
            }

            addStyle(`:root {
                --font-size-16: ${getFontSize("16px")};
                --font-size-15: ${getFontSize("15px")};
                --font-size-14: ${getFontSize("14px")};
                --font-size-13: ${getFontSize("13px")};
                --font-size-12: ${getFontSize("12px")};
                --font-size-11: ${getFontSize("11px")};
                --font-size-10: ${getFontSize("10px")};
                --font-size-9: ${getFontSize("9px")};
                --font-size-monospace: ${getFontSize("monospace")};
                --font-size-window-title: ${getFontSize("window-title")};
                --font-size-tab-title: ${getFontSize("tab-title")};
                --font-size-menu: ${getFontSize("menu")};
                }`);
        }

        updateRowHeight(rowHeight) {
            // explorer view
            explorerView.ExplorerDelegate.ITEM_HEIGHT = rowHeight;

            addStyle(`:root { --row-height: ${rowHeight}px; --factor: ${rowHeight / 22}; }`);

            // open editors
            override(openEditorsView.OpenEditorsView, "renderBody", function (original) {
                let res = original();
                this.list.view.virtualDelegate.__proto__.constructor.ITEM_HEIGHT = rowHeight;
                this.updateSize();
                return res;
            });

            // newer version
            require(["vs/workbench/contrib/codeEditor/browser/outline/documentSymbolsTree"], function(symbolsTree) {
                symbolsTree.DocumentSymbolVirtualDelegate.prototype.getHeight = function () {
                    return rowHeight;
                };
            }, function(error) {});

            // custom views in sidebar
            let replacement = function (original) {
                let res = original();
                // Older version
                if (this.tree !== undefined && this.tree.context !== undefined) {
                    this.tree.context.configuration.renderer.__proto__.constructor.ITEM_HEIGHT = rowHeight;
                }

                // newer version
                if (this.tree !== undefined && this.tree.tree !== undefined &&
                    this.tree.tree.view !== undefined && this.tree.tree.view.view !== undefined &&
                    this.tree.tree.view.view.virtualDelegate != undefined) {
                    this.tree.tree.view.view.virtualDelegate.getHeight = function () {
                        return rowHeight;
                    }
                }
                return res;
            };

            require(["vs/workbench/browser/parts/views/treeView"], function(treeView) {
                if (treeView.TreeView)
                    override(treeView.TreeView, "createTree", replacement);
                if (treeView.TreeViewPane)
                    override(treeView.TreeViewPane, "createTree", replacement);
            }, function(error) {});

            // search
            searchResultsView.SearchDelegate.prototype.getHeight = function () {
                return rowHeight;
            }

            //
            // Debugger
            //

            replacement = function (original) {
                let res = original();
                this.tree.tree.view.view.virtualDelegate.getHeight = function () {
                    return rowHeight;
                }
                return res;
            };


            override(variablesView.VariablesView, "renderBody", replacement);
            override(callStackView.CallStackView, "renderBody", replacement);
            override(watchExpressionsView.WatchExpressionsView, "renderBody", replacement);
            override(loadedScriptsView.LoadedScriptsView, "renderBody", function(original) {
                let res = original();
                this.tree.view.view.virtualDelegate.getHeight = function () {
                    return rowHeight;
                }
                return res;
            });
            // renderBody is too late
            override(breakpointsView.BreakpointsView, "_register", function (original) {
                if (this.list && this.list.view) {
                    this.list.view.virtualDelegate.getHeight = function () {
                        return rowHeight;
                    }
                }
                let res = original();
                return res;
            });

            //
            // SCM
            //

            replacement = function (original) {
                let res = original();
                this.list.view.virtualDelegate.getHeight = function () {
                    return rowHeight;
                }
                return res;
            }

            replacement = function (original) {
                let res = original();
                if (this.tree && this.element) {
                    let prev = this.tree.view.view.virtualDelegate.delegate.getHeight;
                    let self = this.tree.view.view.virtualDelegate.delegate;
                    this.tree.view.view.virtualDelegate.delegate.getHeight = (element) => {
                        res = prev.apply(self, [element]);
                        return res != 22 ? res : rowHeight;
                    }
                }
                return res;
            }

            require(["vs/workbench/contrib/scm/browser/scmViewPane"], function(mp) {
                override(mp.SCMViewPane, "renderBody", replacement);
            }, function(error) {});

            replacement = function (original) {
                let res = original();
                if (this.tree) {
                    this.tree.view.view.virtualDelegate.getHeight = function () {
                        return rowHeight;
                    }
                }
                return res;
            }

            require(["vs/workbench/contrib/timeline/browser/timelinePane"], function(tp) {
                override(tp.TimelinePane, "renderBody", replacement);
            }, function(error) {});

            // Version: 1.41.0-insider
            require(["vs/base/browser/ui/splitview/paneview"], function(paneView) {
                paneView.Pane.HEADER_SIZE = rowHeight;
            }, function(error) {});
        }
    }

    CustomizeFont = utils.decorate([
        utils.param(0, configuration.IConfigurationService)
    ], CustomizeFont);

    exports.run = function(instantiationService) {
        instantiationService.createInstance(CustomizeFont);
    }
});
