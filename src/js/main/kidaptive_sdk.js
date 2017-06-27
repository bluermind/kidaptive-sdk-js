/**
 * Created by solomonliu on 2017-05-23.
 */
"use strict";

(function(){
    var operationQueue = KidaptiveUtils.Promise.resolve(); //enforces order of async operations
    var sdk = undefined; //sdk singleton
    var defaultFlushInterval;

    var flushInterval;
    var flushTimeoutId;
    var flushing;

    var sdkInitFilter = function() {
        if (!sdk) {
            throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.ILLEGAL_STATE, "SDK not initialized");
        }
    };

    var addToQueue = function(f) {
        var returnQueue = operationQueue.then(f);
        operationQueue = returnQueue.then(function(){}, function(){});
        return returnQueue;
    };

    //ignore everything that's not a auth error
    var filterAuthError = function(error) {
        if (error.type === KidaptiveError.KidaptiveErrorCode.API_KEY_ERROR) {
            throw error;
        }
    };

    var handleAuthError = function(error) {
        if (error.type === KidaptiveError.KidaptiveErrorCode.API_KEY_ERROR) {
            //TODO: attempt automatic reauthentication;
            return logout(true).then(function(){
                throw error;
            });
        }
        throw error;
    };

    var logout = function(authError) {
        //TODO: close all trials
        sdk.modelManager.clearLearnerModels();
        sdk.learnerManager.clearLearnerList();
        KidaptiveHttpClient.deleteUserData();
        return KidaptiveUtils.Promise.wrap(function() {
            if (!authError) {
                return sdk.eventManager.flushEvents();
            }
        }).then(function() {
            return sdk.userManager.logoutUser();
        });
    };

    var refreshUserData = function() {
        return KidaptiveUtils.Promise.serial([
            function() {
                return sdk.userManager.refreshUser();
            },
            function() {
                return sdk.learnerManager.refreshLearnerList();
            },
            function() {
                return sdk.modelManager.refreshLatentAbilities().then(function(results) {
                    results.forEach(function(r) {
                        filterAuthError(r.error);
                    });
                });
            }, function() {
                return sdk.modelManager.refreshLocalAbilities().then(function(results) {
                    results.forEach(function(r) {
                        filterAuthError(r.error);
                    });
                });
            }
            //TODO: decide whether insights refresh should be included
        ], KidaptiveError.KidaptiveErrorCode.API_KEY_ERROR).catch(handleAuthError);
    };

    var autoFlush = function() {
        window.clearTimeout(flushTimeoutId);
        if (!flushing && flushInterval > 0) {
            flushTimeoutId = window.setTimeout(function () {
                flushing = true;
                exports.flushEvents().then(function () {
                    flushing = false;
                    autoFlush();
                });
            }, flushInterval);
        }
    };

    var returnResults = function(results) {
        return results;
    };

    var KidaptiveSdk = function(apiKey, appVersion, options) {
        return KidaptiveUtils.Promise(function(resolve, reject) {
            apiKey = KidaptiveUtils.copyObject(apiKey);
            if (!apiKey || KidaptiveUtils.checkObjectFormat(apiKey, '')) {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.INVALID_PARAMETER, "Api key is required");
            }

            appVersion = KidaptiveUtils.copyObject(appVersion) || {};
            KidaptiveUtils.checkObjectFormat(appVersion, {version:'', build:''});

            options = KidaptiveUtils.copyObject(options) || {};
            KidaptiveUtils.checkObjectFormat(options, {dev: false, flushInterval: 0});

            this.httpClient = new KidaptiveHttpClient(apiKey, options.dev);

            this.httpClient.ajax("GET", KidaptiveConstants.ENDPOINTS.APP).then(function (app) {
                if (appVersion.version < app.minVersion) {
                    throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.INVALID_PARAMETER,
                        "Version >= " + app.minVersion + " required. Provided " + appVersion.version);
                }

                app.version = appVersion.version;
                app.build = appVersion.build;
                this.appInfo = app;

                //initialize managers
                this.userManager = new KidaptiveUserManager(this);
                this.learnerManager = new KidaptiveLearnerManager(this);
                this.modelManager = new KidaptiveModelManager(this);
                this.eventManager = new KidaptiveEventManager(this);

                return this.modelManager.refreshAppModels();
            }.bind(this)).then(function() {
                sdk = this;
                defaultFlushInterval = options.flushInterval === undefined ? 60000 : options.flushInterval;
                exports.startAutoFlush();
                return refreshUserData().catch(function(){}); //user data update shouldn't have to complete to initialize sdk
            }.bind(this)).then(function() {
                resolve(this);
            }.bind(this), reject);
        }.bind(this));
    };

    //public interface for SDK
    exports.init = function(apiKey, appVersion, options) {
        return addToQueue(function() {
            if(!sdk) {
                return new KidaptiveSdk(apiKey, appVersion, options).then(function() {
                    return exports;
                });
            } else if (apiKey || appVersion || options) {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.ILLEGAL_STATE, "SDK already initialized");
            }
            return exports;
        });
    };

    exports.getAppInfo = function() {
        sdkInitFilter();
        return KidaptiveUtils.copyObject(sdk.appInfo);
    };

    exports.refresh = function() {
        return addToQueue(function() {
            sdkInitFilter();
            return refreshUserData();
        });
    };

    //User Manager
    exports.getCurrentUser = function() {
        sdkInitFilter();
        return KidaptiveUtils.copyObject(sdk.userManager.currentUser);
    };

    exports.logoutUser = function() {
        return addToQueue(function() {
            sdkInitFilter();
            logout();
        });
    };

    //Learner Manager
    exports.getLearnerById = function(id) {
        sdkInitFilter();
        return KidaptiveUtils.copyObject(sdk.learnerManager.idToLearner[id]);
    };

    exports.getLearnerByProviderId = function(providerId) {
        sdkInitFilter();
        return KidaptiveUtils.copyObject(sdk.learnerManager.providerIdToLearner[providerId]);
    };

    exports.getLearnerList = function() {
        sdkInitFilter();
        return KidaptiveUtils.copyObject(sdk.learnerManager.getLearnerList());
    };

    //Model Manager
    exports.getModels = function(type, conditions) {
        sdkInitFilter();
        return KidaptiveUtils.copyObject(sdk.modelManager.getModels(type, conditions));
    };

    //Event Manager
    exports.reportBehavior = function(eventName, properties) {
        sdkInitFilter();
        sdk.eventManager.reportBehavior(eventName, properties);
    };

    exports.flushEvents = function() {
        return addToQueue(function() {
            sdkInitFilter();
            var r;
            return sdk.eventManager.flushEvents().then(function(results) {
                r = returnResults.bind(undefined, results);
                results.forEach(function(r) {
                    if (!r.resolved) {
                        filterAuthError(r.error);
                    }
                });
            }).catch(handleAuthError).then(r, r);
        });
    };

    exports.startAutoFlush = function(interval) {
        sdkInitFilter();
        KidaptiveUtils.checkObjectFormat(interval, 0);
        if (interval === undefined) {
            interval = defaultFlushInterval;
        }
        flushInterval = interval;
        autoFlush();
    };

    exports.stopAutoFlush = function() {
        sdkInitFilter();
        exports.startAutoFlush(0);
    };

    //Module
    exports.KidaptiveError = KidaptiveError;
    exports.KidaptiveConstants = KidaptiveConstants;
    exports.KidaptiveUtils = KidaptiveUtils;
    exports.destroy = function() {
        addToQueue(exports.stopAutoFlush);
        exports.flushEvents();
        return addToQueue(function() {
            sdk = undefined;
        });
    };
})();
