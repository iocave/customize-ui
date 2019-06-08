define([
    "module",
    "require",
    "vs/platform/instantiation/common/instantiationService",
    "customize-ui/utils",
    "customize-ui/activity-bar",
    "customize-ui/fonts"
], function (mod, req, insantiationService, utils, activityBar, fonts) {
        'use strict';

        let override = utils.override;
        let addStyleSheet = utils.addStyleSheet;
        let addStyle = utils.addStyle;

        let url = req.toUrl(mod.id) + ".css";
        if (!url.startsWith("file://")) {
            url = 'file://' + url;
        }
        addStyleSheet(url);

        class _InstantiationService extends insantiationService.InstantiationService {
            constructor() {
                super(...arguments);

                try {
                    activityBar.run(this);
                } catch (e) {
                    console.error(e);
                }

                try {
                    fonts.run(this);
                } catch (e) {
                    console.error(e);
                }
            }
        }

        insantiationService.InstantiationService = _InstantiationService;
    });
