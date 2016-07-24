/*
 * Copyright (c) 2012-2016 S-Core Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file common.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */
define([
    'urijs',
    'webida-restful-api',
    './logger/Logger'
],  function (
    URI,
    WebidaRestfulApi,
    Logger
) {
    'use strict';

    var logger = new Logger('webida-service-client');

    var privates = {
        inDesktopApp: window.__ELECTRON_BROWSER__ || window.nrequire,
        serverUri : null,
        serverUrl : null,
        masterToken: null,
        workspaceId: null,
        remote : false,

        parseLocationArgs: function parseBootArgs(args) {
            privates.serverUri = new URI(args.serverUrl).normalize().resource('').path('');
            privates.serverUrl = privates.serverUri.toString().slice(0, -1);
            privates.workspaceId = args.workspaceId;
            privates.masterToken = args.masterToken;
            privates.remote = args.remote ? true : false;
        },

        detectServerUrl: function detectServerUrl(locationUri) {
            var ret = '';
            var uri = locationUri.normalize().resource('').path('');
            switch(uri.protocol) {
                // TODO : check environment & detect alternative protocol names
                //   all 'file-like' protocols should throw error
                // some other protocols may be added to here
                // if browser (electron) supports some alternative protocol names, we need to check.
                case 'http':
                case 'https':
                    ret = uri.toString().slice(0,-1); // chop trailing '/'
                    break;
                default:
                    var msg = 'cannot detect server url from location ' + locationUri.toString();
                    logger.fatal(msg);
                    throw new Error(msg);
            }
            logger.debug('detected server url ' + ret);
            return ret
        },

        getSimpleAuthApiKey: function getSimpleAuthApiKey() {
            if (privates.tokenManager.accessToken) {
                return privates.tokenManager.accessToken.text;
            } else {
                logger.debug('has no access token yet');
                return 'not-a-token';
            }
        }
    };


    var publics = {
        get logger() { return logger; },
        get api() {
            return WebidaRestfulApi;
        },

        get serverUri() { return privates.serverUri; },
        get serverUrl() { return privates.serverUrl; },
        get masterToken() { return privates.masterToken; },
        get workspaceId() { return privates.workspaceId; },

        init: function init() {
            var locationUri = new URI(window.location.href);
            var locationArgs = locationUri.query(true);
            if (!locationArgs.serverUrl) {
                locationArgs.serverUrl = privates.detectServerUrl(locationUri);
            }
            privates.parseLocationArgs(locationArgs);
            // init default api client instance
            publics.initApiClientInstance(WebidaRestfulApi.ApiClient.instance);
        },

        // some module may want to create their own client instance
        // to adjust request timeout & tweak some behaviors dynamically.
        // so, this function should be public.
        initApiClientInstance: function initApiClientInstance(instance) {
            // by default, generated js client uses 'http://localhost/api' as base url
            //  we should replace it to real server url
            instance.basePath = privates.serverUrl + '/api';

            // webidaSimpleAuth.apiKey is not a 'fixed' value.
            // so, we should define property getter (maybe proxy, later)
            var webidaSimpleAuth = instance.authentications['webida-simple-auth'];
            Object.defineProperty(webidaSimpleAuth, 'apiKey', {
                enumerable: true,
                get : privates.getSimpleAuthApiKey
            });
            logger.debug('swagger api client instance initialized', instance);
        }

    };

    return publics;
});