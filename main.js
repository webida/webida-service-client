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
* @fileOverview Webida Server API binding library
*  
* This module implements some sub-set of webida-0.3.js with new webida service api spec. 
* @module webida-service-client
* @version 0.1
*/

define([
    './lib/common',
    './lib/controller',
    './lib/auth-service',
    './lib/session-service',
    './lib/workspace-service',
    './lib/AbstractCredentialProvider',
    './lib/logger/Logger',
    './libcompat/auth',
    './libcompat/fs'
],  function (
    common,
    controller,
    authService,
    sessionService,
    workspaceService,
    AbstractCredentialProvider,
    Logger,
    auth,
    fs
) {
    'use strict';

    var credentialProvider = null;

    var mod = {
        // incompatible properties, which webida-0.3.js does not have
        //  provides some common, token & session information
        VERSION: '0.7',

        // accessor to all api classes
        api : common.api,

        info : {
            get serverUrl() {
                return common.serverUrl;
            },
            get serverUri() {
                return common.serverUri;
            },
            get accessToken() {
                var tokenManager = authService.getTokenManager();
                return tokenManager.accessToken;
            },
            get sessionId() {
                var accessToken = mod.info.accessToken;
                if (accessToken) {
                    return accessToken.sessionId;
                }
            }
        },

        controller: controller,
        authService : authService,
        sessionService : sessionService,
        workspaceService: workspaceService,

        AbstractCredentialProvider: AbstractCredentialProvider,
        Logger: Logger,

        // for compatibility with plugin who are dependent to webida-0.3.js conf object
        auth : auth,
        fs : fs,
        conf : {
            get fsServer() { return common.serverUrl; },
            get connServer() { return common.serverUrl; },
            get fsApiBaseUrl() { return common.serverUrl + '/wfs'; }
        },
        getPluginSettingsPath : function(callback) {
            // plugin-settings-desktop.json : to use embedded server from desktop
            // plugin-settings.json : to use legacy server from desktop/browser (0.1)
            //                        to connect remote server from desktop/browser (0.2~)
            // plugin-settings-legacy: to connect legacy server from desktop/browser (0.2~)
            if( window.location.href.indexOf('legacy=') > 0 ) {
                return callback('plugins/plugin-setting.json');
            } else {
                return callback('plugins/plugin-settings-desktop.json');
            }
        }
    };

    Object.freeze(mod);
    window.__webida = mod;
    return mod;
});
