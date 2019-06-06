var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};

let override = function (where, name, cb) {
    (function (original) {
        where.prototype[name] = function () {
            let t = this;
            let a = arguments;
            let res = cb.apply(this,
                [() => original.apply(t, a), a]
            );
            return res;
        }
    })(where.prototype[name]);
}

let addStyleSheet = function (url) {
    let head = document.getElementsByTagName('head')[0];
    let link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    head.appendChild(link);
}

let addStyle = function (style) {
    let css = document.createElement('style');
    css.type = 'text/css';

    css.appendChild(document.createTextNode(style));
    document.getElementsByTagName("head")[0].appendChild(css);
}

define([
    "module",
    "require",
    "vs/workbench/browser/workbench",
    "vs/workbench/contrib/files/browser/views/explorerViewer",
    "vs/base/browser/ui/splitview/panelview",
    "vs/workbench/contrib/files/browser/views/openEditorsView",
    "vs/editor/contrib/documentSymbols/outlineTree",
    "vs/workbench/browser/parts/views/customView",
    "vs/workbench/contrib/search/browser/searchResultsView",
    "vs/workbench/contrib/debug/browser/variablesView",
    "vs/workbench/contrib/debug/browser/callStackView",
    "vs/workbench/contrib/debug/browser/watchExpressionsView",
    "vs/workbench/contrib/debug/browser/loadedScriptsView",
    "vs/workbench/contrib/debug/browser/breakpointsView",
    "vs/workbench/contrib/scm/browser/scmViewlet",
    "vs/platform/configuration/common/configuration",
], function (mod, req, workbench, explorerView, panelView, openEditorsView, outlineTree, customView, searchResultsView,
    variablesView, callStackView, watchExpressionsView, loadedScriptsView, breakpointsView, scm, configuration) {
        'use strict';

        let url =  req.toUrl(mod.id) + ".css";
        if (!url.startsWith("file://")) {
            url = 'file://' +url;
        }
        addStyleSheet(url);

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
                if (typeof(fontFamily) == "string" && fontFamily.length > 0) {
                    this.setFontFamily(fontFamily);
                }

                let monospaceFamily = this.configurationService.getValue("customizeUI.font.monospace");
                if (typeof(monospaceFamily) == "string" && monospaceFamily.length > 0) {
                    this.setMonospaceFontFamily(monospaceFamily);
                }
            }

            addCustomStyleSheet(styleSheet) {
                let string = Object.entries(styleSheet).map(([key, value]) => `${key} { ${value}; }` ).join("\n");
                addStyle(string);
            }

            setFontFamily(fontFamily) {
                addStyle(`.mac, .windows, .linux { font-family: "${fontFamily}" !important; }`);
            }

            setMonospaceFontFamily(fontFamily) {
                addStyle(`.mac, .windows, .linux { --monaco-monospace-font:"${fontFamily}" !important; }`);
            }

            updateFontSize(fontSizeMap) {
                console.log(fontSizeMap);

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
                    }`);
            }

            updateRowHeight(rowHeight) {
                // explorer view
                explorerView.ExplorerDelegate.ITEM_HEIGHT = rowHeight;

                // panel height (OUTLINE, DEPENDENCIES, ...)
                panelView.Panel.HEADER_SIZE = rowHeight;

                addStyle(`:root { --row-height: ${rowHeight}px; --factor: ${rowHeight / 22}; }`);

                // open editors
                override(openEditorsView.OpenEditorsView, "renderBody", function (original) {
                    let res = original();
                    this.list.view.virtualDelegate.__proto__.constructor.ITEM_HEIGHT = rowHeight;
                    this.updateSize();
                    return res;
                });

                // outline
                outlineTree.OutlineVirtualDelegate.prototype.getHeight = function () {
                    return rowHeight;
                };

                // custom views in sidebar
                override(customView.CustomTreeView, "createTree", function (original) {
                    let res = original();
                    if (this.tree !== undefined) {
                        this.tree.context.configuration.renderer.__proto__.constructor.ITEM_HEIGHT = rowHeight;
                    }
                    return res;
                });

                // search
                searchResultsView.SearchDelegate.prototype.getHeight = function () {
                    return rowHeight;
                }

                //
                // Debugger
                //

                let replacement = function (original) {
                    let res = original();
                    this.tree.tree.view.view.virtualDelegate.getHeight = function () {
                        return rowHeight;
                    }
                    return res;
                };

                override(variablesView.VariablesView, "renderBody", replacement);
                override(callStackView.CallStackView, "renderBody", replacement);
                override(watchExpressionsView.WatchExpressionsView, "renderBody", replacement);
                override(loadedScriptsView.LoadedScriptsView, "renderBody", replacement);
                override(breakpointsView.BreakpointsView, "renderBody", function (original) {
                    let res = original();
                    this.list.view.virtualDelegate.getHeight = function () {
                        return rowHeight;
                    }
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

                override(scm.MainPanel, "renderBody", replacement);
                override(scm.RepositoryPanel, "renderBody", replacement);
            }
        }

        CustomizeFont = __decorate([
            __param(0, configuration.IConfigurationService)
        ], CustomizeFont);

        let haveInstantiationService = function (service) {
            let conf = service.createInstance(CustomizeFont);
        }

        override(workbench.Workbench, "renderWorkbench", function (original, args) {
            let res = original();
            haveInstantiationService(args[0]);
            return res;
        });
    });
