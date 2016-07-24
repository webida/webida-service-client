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
    './lib/session-service',
    './lib/token-manager',
    './lib/workspace-service',
    './libcompat/auth',
    './libcompat/fs'
],  function (
    common,
    controller,
    sessionService,
    tokenManager,
    workspaceService,
    auth,
    fs
) {
    'use strict';
    
    
    var mod = {
        VERSION: '0.7',

        // incompatible properties, which webida-0.3.js does not have
        //  provides some common, token & session information
        info : {
            get serverUrl() {
                return common.serverUrl;
            },
            get serverUri() {
                return common.serverUri;
            },
            get accessToken() {
                return tokenManager.accessToken;
            },
            get sessionId() {
                if (tokenManager.accessToken) {
                    return tokenManager.accessToken.sessionId;
                }
            }
        },

        sessionService : sessionService,
        workspaceService: workspaceService,

        // life-cycle methods

        // init service
        //  - parses boot arguments
        //  - authenticate to server
        //  - read current workspace info (in ide)
        //  - mount webida file system (in ide)
        init : function init(credentialFactory) {
            // when init found no login credential
            // then we have to ask credential factory to get login credential from user
            // the factory resolves credential or reject error
            return controller.init(credentialFactory);
        },

        // start service
        //  - establish session connection
        //  - prefetch off-line cache dirs
        //  - upload pending changes in off-line cache
        start : function start() {
            return controller.start();
        },

        // stop service
        //  - cancels all downloading/uploading jobs of off-line cache
        //  - cancels all background processes in server, launched by this session
        //  - close web socket connections
        stop : function stop() {
            return controller.stop();
        },

        // destroy service
        //   - unmount webida file system
        //   - abandon current access token & credential
        //   - abandon current workspace info
        destroy: function destroy() {
            return controller.destroy();
        },


        // for compatibility with plugin who are dependent to webida-0.3.js conf object
        // should be removed, in some days.
        auth : auth,
        fs : fs,
        conf : {
            fsServer : common.serverUrl,
            connServer: common.serverUrl,
            fsApiBaseUrl: common.serverUrl + '/api/wfs'
        },
        getPluginSettingsPath : function(callback) {
            // plugin-settings-desktop.json : to use embedded server from desktop
            // plugin-settings.json : to use legacy server from desktop/browser (0.1)
            //                        to connect remote server from desktop/browser (0.2~)
            // plugin-settings-legacy: to connect legacy server from desktop/browser (0.2~)

            if(common.bootArgs.legacy) {
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
