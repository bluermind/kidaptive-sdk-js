(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.KidaptiveSdk = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Created by solomonliu on 2017-05-23.
 */
"use strict";
module.exports = {
    HOST_PROD:"https://service.kidaptive.com/v3",
    HOST_DEV:"https://develop.kidaptive.com/v3",

    ENDPOINTS: {
        APP:"/app/me",
        GAME:"/game",
        PROMPT:"/prompt",
        CATEGORY:"/category",
        SUB_CATEGORY:"/sub-category",
        INSTANCE:"/instance",
        PROMPT_CATEGORY:"/prompt-category",
        SKILLS_FRAMEWORK:"/skills-framework",
        SKILLS_CLUSTER:"/skills-cluster",
        SKILLS_DOMAIN:"/skills-domain",
        DIMENSION:"/dimension",
        LOCAL_DIMENSION:"/local-dimension",
        ITEM:"/item",

        LEARNER:"/learner",
        ABILITY:"/ability",
        LOCAL_ABILITY:"/local-ability",
        INGESTION:"/ingestion",

        USER:"/user/me",
        LOGOUT:"/user/logout"
    },

    ALP_EVENT_VERSION:"3.0",

    LOCAL_STORAGE: {
        API_KEY: "kidaptive.api_key",
        APP: "kidaptive.app"
    }
};
},{}],2:[function(require,module,exports){
/**
 * Created by solomonliu on 2017-05-23.
 */
"use strict";
var KidaptiveError = function(type, message) {
    Error.call(this, message);
    this.type = type;
};

KidaptiveError.prototype = Object.create(Error.prototype);
KidaptiveError.prototype.constructor = KidaptiveError;

KidaptiveError.KidaptiveErrorCode = {};
[
    "OK",
    "GENERIC_ERROR",
    "NOT_IMPLEMENTED",
    "INVALID_PARAMETER",
    "ILLEGAL_STATE",
    "INIT_ERROR",
    "MISSING_DELEGATE",
    "AUTH_ERROR",
    "NOT_LOGGED_IN",
    "LEARNER_NOT_FOUND",
    "TRIAL_NOT_OPEN",
    "URI_NOT_FOUND",

    "RECOMMENDER_ERROR",

    "API_KEY_ERROR",
    "WEB_API_ERROR"
].forEach(function(e) {
    KidaptiveError.KidaptiveErrorCode[e] = e;
});

module.exports = KidaptiveError;
},{}],3:[function(require,module,exports){
/**
 * Created by solomonliu on 2017-05-23.
 */
"use strict";
var constants = require("./kidaptive_constants");
var KidaptiveError = require("./kidaptive_error");

var KidaptiveHttpClient = function(apiKey, dev) {
    var host = dev ? constants.HOST_DEV : constants.HOST_PROD;

    var promiseHelper = function(jqxhr) {
        return jqxhr.then(function(data) {
            return data;
        }, function(xhr) {
            if (xhr.status == 400) {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.INVALID_PARAMETER, xhr.responseText);
            } else if (xhr.status == 401) {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.API_KEY_ERROR, xhr.responseText);
            } else if (xhr.status) {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.WEB_API_ERROR, xhr.responseText);
            } else {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.GENERIC_ERROR, "HTTP Client Error");
            }
        });
    };

    var getCommonSettings = function() {
        return {
            headers: {
                "api-key": apiKey
            },
            xhrFields: {
                withCredentials: true
            }
        }
    };

    this.ajax = function(method, endpoint, params) {
        var settings = getCommonSettings();
        settings.method = method;
        settings.url = host + endpoint;

        if (settings.method == 'GET') {
            settings.data = params;
        } else if (settings.method == 'POST') {
            settings.contentType = "application/json";
            settings.data = JSON.stringify(params);
        } else {
            return $.Deferred().reject(new KidaptiveError(KidaptiveErrorCode.INVALID_PARAMETER, "Method must be 'GET' or 'POST'"));
        }

        return promiseHelper($.ajax(settings));
    }
};

module.exports = KidaptiveHttpClient;
},{"./kidaptive_constants":1,"./kidaptive_error":2}],4:[function(require,module,exports){
/**
 * Created by solomonliu on 2017-05-23.
 */
"use strict";
var KidaptiveError = require('./kidaptive_error');
var KidaptiveConstants = require('./kidaptive_constants');
var KidaptiveHttpClient = require('./kidaptive_http_client');

var sdkPromise;

//this constructor returns a promise. the
var KidaptiveSdk = function(apiKey, appVersion, options) {
    if (!sdkPromise) {
        //check jquery version
        if ($().jquery < '3') {
            //promises not implemented correctly, throw normal error
            throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.GENERIC_ERROR, "jQuery version must be >= 3");
        }

        var appInfo;
        //TODO: initialize managers
        //TODO: public methods
        this.getAppInfo = function() {
            return JSON.parse(JSON.stringify(appInfo));
        };

        //create new sdk instance
        sdkPromise = $.Deferred().resolve().then(function () {
            if (!apiKey) {
                throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.INVALID_PARAMETER, "Api key is required");
            }

            if (!appVersion) {
                appVersion = {};
            }
            appVersion.version = appVersion.version || '';
            appVersion.build = appVersion.build || '';

            options = options || {};

            var client = new KidaptiveHttpClient(apiKey, options.dev);
            return client.ajax("GET", KidaptiveConstants.ENDPOINTS.APP).then(function (app) {
                if (appVersion.version < app.minVersion) {
                    throw new KidaptiveError(KidaptiveError.KidaptiveErrorCode.INVALID_PARAMETER,
                        "Version >= " + app.minVersion + " required. Provided " + appInfo.version);
                }

                appInfo =  app;
                appInfo.version = appVersion.version;
                appInfo.build = appVersion.build;
                //TODO: sync models
            }).then(function() {
                return this;
            }.bind(this));
        }.bind(this));

        sdkPromise.then(function() {
            //get user info if login is successful
            //TODO: Load user info
        }, function () {
            //if there is an init error, unset the promise so we can try again.
            sdkPromise = undefined;
        });
    } else if (apiKey || appVersion || options) {
        return $.Deferred().reject(new KidaptiveError(KidaptiveError.KidaptiveErrorCode.ILLEGAL_STATE, "SDK initialization in progress or successful"))
    }

    return sdkPromise;
};

KidaptiveSdk.KidaptiveError = KidaptiveError;
KidaptiveSdk.KidaptiveConstants = KidaptiveConstants;

module.exports = KidaptiveSdk;
},{"./kidaptive_constants":1,"./kidaptive_error":2,"./kidaptive_http_client":3}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvbWFpbi9raWRhcHRpdmVfY29uc3RhbnRzLmpzIiwic3JjL2pzL21haW4va2lkYXB0aXZlX2Vycm9yLmpzIiwic3JjL2pzL21haW4va2lkYXB0aXZlX2h0dHBfY2xpZW50LmpzIiwic3JjL2pzL21haW4va2lkYXB0aXZlX3Nkay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQ3JlYXRlZCBieSBzb2xvbW9ubGl1IG9uIDIwMTctMDUtMjMuXG4gKi9cblwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgSE9TVF9QUk9EOlwiaHR0cHM6Ly9zZXJ2aWNlLmtpZGFwdGl2ZS5jb20vdjNcIixcbiAgICBIT1NUX0RFVjpcImh0dHBzOi8vZGV2ZWxvcC5raWRhcHRpdmUuY29tL3YzXCIsXG5cbiAgICBFTkRQT0lOVFM6IHtcbiAgICAgICAgQVBQOlwiL2FwcC9tZVwiLFxuICAgICAgICBHQU1FOlwiL2dhbWVcIixcbiAgICAgICAgUFJPTVBUOlwiL3Byb21wdFwiLFxuICAgICAgICBDQVRFR09SWTpcIi9jYXRlZ29yeVwiLFxuICAgICAgICBTVUJfQ0FURUdPUlk6XCIvc3ViLWNhdGVnb3J5XCIsXG4gICAgICAgIElOU1RBTkNFOlwiL2luc3RhbmNlXCIsXG4gICAgICAgIFBST01QVF9DQVRFR09SWTpcIi9wcm9tcHQtY2F0ZWdvcnlcIixcbiAgICAgICAgU0tJTExTX0ZSQU1FV09SSzpcIi9za2lsbHMtZnJhbWV3b3JrXCIsXG4gICAgICAgIFNLSUxMU19DTFVTVEVSOlwiL3NraWxscy1jbHVzdGVyXCIsXG4gICAgICAgIFNLSUxMU19ET01BSU46XCIvc2tpbGxzLWRvbWFpblwiLFxuICAgICAgICBESU1FTlNJT046XCIvZGltZW5zaW9uXCIsXG4gICAgICAgIExPQ0FMX0RJTUVOU0lPTjpcIi9sb2NhbC1kaW1lbnNpb25cIixcbiAgICAgICAgSVRFTTpcIi9pdGVtXCIsXG5cbiAgICAgICAgTEVBUk5FUjpcIi9sZWFybmVyXCIsXG4gICAgICAgIEFCSUxJVFk6XCIvYWJpbGl0eVwiLFxuICAgICAgICBMT0NBTF9BQklMSVRZOlwiL2xvY2FsLWFiaWxpdHlcIixcbiAgICAgICAgSU5HRVNUSU9OOlwiL2luZ2VzdGlvblwiLFxuXG4gICAgICAgIFVTRVI6XCIvdXNlci9tZVwiLFxuICAgICAgICBMT0dPVVQ6XCIvdXNlci9sb2dvdXRcIlxuICAgIH0sXG5cbiAgICBBTFBfRVZFTlRfVkVSU0lPTjpcIjMuMFwiLFxuXG4gICAgTE9DQUxfU1RPUkFHRToge1xuICAgICAgICBBUElfS0VZOiBcImtpZGFwdGl2ZS5hcGlfa2V5XCIsXG4gICAgICAgIEFQUDogXCJraWRhcHRpdmUuYXBwXCJcbiAgICB9XG59OyIsIi8qKlxuICogQ3JlYXRlZCBieSBzb2xvbW9ubGl1IG9uIDIwMTctMDUtMjMuXG4gKi9cblwidXNlIHN0cmljdFwiO1xudmFyIEtpZGFwdGl2ZUVycm9yID0gZnVuY3Rpb24odHlwZSwgbWVzc2FnZSkge1xuICAgIEVycm9yLmNhbGwodGhpcywgbWVzc2FnZSk7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbn07XG5cbktpZGFwdGl2ZUVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcbktpZGFwdGl2ZUVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEtpZGFwdGl2ZUVycm9yO1xuXG5LaWRhcHRpdmVFcnJvci5LaWRhcHRpdmVFcnJvckNvZGUgPSB7fTtcbltcbiAgICBcIk9LXCIsXG4gICAgXCJHRU5FUklDX0VSUk9SXCIsXG4gICAgXCJOT1RfSU1QTEVNRU5URURcIixcbiAgICBcIklOVkFMSURfUEFSQU1FVEVSXCIsXG4gICAgXCJJTExFR0FMX1NUQVRFXCIsXG4gICAgXCJJTklUX0VSUk9SXCIsXG4gICAgXCJNSVNTSU5HX0RFTEVHQVRFXCIsXG4gICAgXCJBVVRIX0VSUk9SXCIsXG4gICAgXCJOT1RfTE9HR0VEX0lOXCIsXG4gICAgXCJMRUFSTkVSX05PVF9GT1VORFwiLFxuICAgIFwiVFJJQUxfTk9UX09QRU5cIixcbiAgICBcIlVSSV9OT1RfRk9VTkRcIixcblxuICAgIFwiUkVDT01NRU5ERVJfRVJST1JcIixcblxuICAgIFwiQVBJX0tFWV9FUlJPUlwiLFxuICAgIFwiV0VCX0FQSV9FUlJPUlwiXG5dLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgIEtpZGFwdGl2ZUVycm9yLktpZGFwdGl2ZUVycm9yQ29kZVtlXSA9IGU7XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBLaWRhcHRpdmVFcnJvcjsiLCIvKipcbiAqIENyZWF0ZWQgYnkgc29sb21vbmxpdSBvbiAyMDE3LTA1LTIzLlxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKFwiLi9raWRhcHRpdmVfY29uc3RhbnRzXCIpO1xudmFyIEtpZGFwdGl2ZUVycm9yID0gcmVxdWlyZShcIi4va2lkYXB0aXZlX2Vycm9yXCIpO1xuXG52YXIgS2lkYXB0aXZlSHR0cENsaWVudCA9IGZ1bmN0aW9uKGFwaUtleSwgZGV2KSB7XG4gICAgdmFyIGhvc3QgPSBkZXYgPyBjb25zdGFudHMuSE9TVF9ERVYgOiBjb25zdGFudHMuSE9TVF9QUk9EO1xuXG4gICAgdmFyIHByb21pc2VIZWxwZXIgPSBmdW5jdGlvbihqcXhocikge1xuICAgICAgICByZXR1cm4ganF4aHIudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfSwgZnVuY3Rpb24oeGhyKSB7XG4gICAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PSA0MDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgS2lkYXB0aXZlRXJyb3IoS2lkYXB0aXZlRXJyb3IuS2lkYXB0aXZlRXJyb3JDb2RlLklOVkFMSURfUEFSQU1FVEVSLCB4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoeGhyLnN0YXR1cyA9PSA0MDEpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgS2lkYXB0aXZlRXJyb3IoS2lkYXB0aXZlRXJyb3IuS2lkYXB0aXZlRXJyb3JDb2RlLkFQSV9LRVlfRVJST1IsIHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh4aHIuc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEtpZGFwdGl2ZUVycm9yKEtpZGFwdGl2ZUVycm9yLktpZGFwdGl2ZUVycm9yQ29kZS5XRUJfQVBJX0VSUk9SLCB4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEtpZGFwdGl2ZUVycm9yKEtpZGFwdGl2ZUVycm9yLktpZGFwdGl2ZUVycm9yQ29kZS5HRU5FUklDX0VSUk9SLCBcIkhUVFAgQ2xpZW50IEVycm9yXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmFyIGdldENvbW1vblNldHRpbmdzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgXCJhcGkta2V5XCI6IGFwaUtleVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHhockZpZWxkczoge1xuICAgICAgICAgICAgICAgIHdpdGhDcmVkZW50aWFsczogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuYWpheCA9IGZ1bmN0aW9uKG1ldGhvZCwgZW5kcG9pbnQsIHBhcmFtcykge1xuICAgICAgICB2YXIgc2V0dGluZ3MgPSBnZXRDb21tb25TZXR0aW5ncygpO1xuICAgICAgICBzZXR0aW5ncy5tZXRob2QgPSBtZXRob2Q7XG4gICAgICAgIHNldHRpbmdzLnVybCA9IGhvc3QgKyBlbmRwb2ludDtcblxuICAgICAgICBpZiAoc2V0dGluZ3MubWV0aG9kID09ICdHRVQnKSB7XG4gICAgICAgICAgICBzZXR0aW5ncy5kYXRhID0gcGFyYW1zO1xuICAgICAgICB9IGVsc2UgaWYgKHNldHRpbmdzLm1ldGhvZCA9PSAnUE9TVCcpIHtcbiAgICAgICAgICAgIHNldHRpbmdzLmNvbnRlbnRUeXBlID0gXCJhcHBsaWNhdGlvbi9qc29uXCI7XG4gICAgICAgICAgICBzZXR0aW5ncy5kYXRhID0gSlNPTi5zdHJpbmdpZnkocGFyYW1zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVqZWN0KG5ldyBLaWRhcHRpdmVFcnJvcihLaWRhcHRpdmVFcnJvckNvZGUuSU5WQUxJRF9QQVJBTUVURVIsIFwiTWV0aG9kIG11c3QgYmUgJ0dFVCcgb3IgJ1BPU1QnXCIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlSGVscGVyKCQuYWpheChzZXR0aW5ncykpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gS2lkYXB0aXZlSHR0cENsaWVudDsiLCIvKipcbiAqIENyZWF0ZWQgYnkgc29sb21vbmxpdSBvbiAyMDE3LTA1LTIzLlxuICovXG5cInVzZSBzdHJpY3RcIjtcbnZhciBLaWRhcHRpdmVFcnJvciA9IHJlcXVpcmUoJy4va2lkYXB0aXZlX2Vycm9yJyk7XG52YXIgS2lkYXB0aXZlQ29uc3RhbnRzID0gcmVxdWlyZSgnLi9raWRhcHRpdmVfY29uc3RhbnRzJyk7XG52YXIgS2lkYXB0aXZlSHR0cENsaWVudCA9IHJlcXVpcmUoJy4va2lkYXB0aXZlX2h0dHBfY2xpZW50Jyk7XG5cbnZhciBzZGtQcm9taXNlO1xuXG4vL3RoaXMgY29uc3RydWN0b3IgcmV0dXJucyBhIHByb21pc2UuIHRoZVxudmFyIEtpZGFwdGl2ZVNkayA9IGZ1bmN0aW9uKGFwaUtleSwgYXBwVmVyc2lvbiwgb3B0aW9ucykge1xuICAgIGlmICghc2RrUHJvbWlzZSkge1xuICAgICAgICAvL2NoZWNrIGpxdWVyeSB2ZXJzaW9uXG4gICAgICAgIGlmICgkKCkuanF1ZXJ5IDwgJzMnKSB7XG4gICAgICAgICAgICAvL3Byb21pc2VzIG5vdCBpbXBsZW1lbnRlZCBjb3JyZWN0bHksIHRocm93IG5vcm1hbCBlcnJvclxuICAgICAgICAgICAgdGhyb3cgbmV3IEtpZGFwdGl2ZUVycm9yKEtpZGFwdGl2ZUVycm9yLktpZGFwdGl2ZUVycm9yQ29kZS5HRU5FUklDX0VSUk9SLCBcImpRdWVyeSB2ZXJzaW9uIG11c3QgYmUgPj0gM1wiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhcHBJbmZvO1xuICAgICAgICAvL1RPRE86IGluaXRpYWxpemUgbWFuYWdlcnNcbiAgICAgICAgLy9UT0RPOiBwdWJsaWMgbWV0aG9kc1xuICAgICAgICB0aGlzLmdldEFwcEluZm8gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGFwcEluZm8pKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvL2NyZWF0ZSBuZXcgc2RrIGluc3RhbmNlXG4gICAgICAgIHNka1Byb21pc2UgPSAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgS2lkYXB0aXZlRXJyb3IoS2lkYXB0aXZlRXJyb3IuS2lkYXB0aXZlRXJyb3JDb2RlLklOVkFMSURfUEFSQU1FVEVSLCBcIkFwaSBrZXkgaXMgcmVxdWlyZWRcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghYXBwVmVyc2lvbikge1xuICAgICAgICAgICAgICAgIGFwcFZlcnNpb24gPSB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFwcFZlcnNpb24udmVyc2lvbiA9IGFwcFZlcnNpb24udmVyc2lvbiB8fCAnJztcbiAgICAgICAgICAgIGFwcFZlcnNpb24uYnVpbGQgPSBhcHBWZXJzaW9uLmJ1aWxkIHx8ICcnO1xuXG4gICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAgICAgdmFyIGNsaWVudCA9IG5ldyBLaWRhcHRpdmVIdHRwQ2xpZW50KGFwaUtleSwgb3B0aW9ucy5kZXYpO1xuICAgICAgICAgICAgcmV0dXJuIGNsaWVudC5hamF4KFwiR0VUXCIsIEtpZGFwdGl2ZUNvbnN0YW50cy5FTkRQT0lOVFMuQVBQKS50aGVuKGZ1bmN0aW9uIChhcHApIHtcbiAgICAgICAgICAgICAgICBpZiAoYXBwVmVyc2lvbi52ZXJzaW9uIDwgYXBwLm1pblZlcnNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEtpZGFwdGl2ZUVycm9yKEtpZGFwdGl2ZUVycm9yLktpZGFwdGl2ZUVycm9yQ29kZS5JTlZBTElEX1BBUkFNRVRFUixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiVmVyc2lvbiA+PSBcIiArIGFwcC5taW5WZXJzaW9uICsgXCIgcmVxdWlyZWQuIFByb3ZpZGVkIFwiICsgYXBwSW5mby52ZXJzaW9uKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhcHBJbmZvID0gIGFwcDtcbiAgICAgICAgICAgICAgICBhcHBJbmZvLnZlcnNpb24gPSBhcHBWZXJzaW9uLnZlcnNpb247XG4gICAgICAgICAgICAgICAgYXBwSW5mby5idWlsZCA9IGFwcFZlcnNpb24uYnVpbGQ7XG4gICAgICAgICAgICAgICAgLy9UT0RPOiBzeW5jIG1vZGVsc1xuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgc2RrUHJvbWlzZS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy9nZXQgdXNlciBpbmZvIGlmIGxvZ2luIGlzIHN1Y2Nlc3NmdWxcbiAgICAgICAgICAgIC8vVE9ETzogTG9hZCB1c2VyIGluZm9cbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy9pZiB0aGVyZSBpcyBhbiBpbml0IGVycm9yLCB1bnNldCB0aGUgcHJvbWlzZSBzbyB3ZSBjYW4gdHJ5IGFnYWluLlxuICAgICAgICAgICAgc2RrUHJvbWlzZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChhcGlLZXkgfHwgYXBwVmVyc2lvbiB8fCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVqZWN0KG5ldyBLaWRhcHRpdmVFcnJvcihLaWRhcHRpdmVFcnJvci5LaWRhcHRpdmVFcnJvckNvZGUuSUxMRUdBTF9TVEFURSwgXCJTREsgaW5pdGlhbGl6YXRpb24gaW4gcHJvZ3Jlc3Mgb3Igc3VjY2Vzc2Z1bFwiKSlcbiAgICB9XG5cbiAgICByZXR1cm4gc2RrUHJvbWlzZTtcbn07XG5cbktpZGFwdGl2ZVNkay5LaWRhcHRpdmVFcnJvciA9IEtpZGFwdGl2ZUVycm9yO1xuS2lkYXB0aXZlU2RrLktpZGFwdGl2ZUNvbnN0YW50cyA9IEtpZGFwdGl2ZUNvbnN0YW50cztcblxubW9kdWxlLmV4cG9ydHMgPSBLaWRhcHRpdmVTZGs7Il19
