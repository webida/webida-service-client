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
    './lib/AbstractCredentialProvider',
    './lib/auth-service',
    './lib/session-service',
    './lib/workspace-service',
    './libcompat/auth',
    './libcompat/fs'
],  function (
    common,
    controller,
    AbstractCredentialProvider,
    authService,
    sessionService,
    workspaceService,
    auth,
    fs
) {
    'use strict';

    var credentialProvider = null;

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

        lifecycleEventSource: controller.getLifecycleEventSource(),

        // dashboard requires way to create some master token when staring new ide.
        // so, auth service should be exposed.
        // ide will not call auth service directly, ususally

        authService : authService,
        sessionService : sessionService,

        // dashboard does not use workspace service.
        // so, wss should support starting without specific workspace id
        workspaceService: workspaceService,

        AbstractCredentialProvider: AbstractCredentialProvider,
        // life-cycle control methods

        // init service
        //  - sets credential factory to right place
        //  - parses boot arguments
        //  - should be called once and only once, when app is booting
        init : function init(credentialProvider, bootArgs) {
            return controller.init(credentialProvider, bootArgs);
        },

        // start service
        //  - do authentication
        //  - establish session connection
        //  - gets workspace information & mount file system
        //   (workspace service should handle off-line cache init)
        start : function start() {
            return controller.start();
        },

        // stop service
        //  - cancels all downloading/uploading jobs of off-line cache
        //  - cancels all background processes in server, launched by this session
        //  - close all web socket connections
        //  - unmount file system if needed
        //  - discard access token & stop auto-refreshing
        stop : function stop() {
            return controller.stop();
        },

        // Restart service needs new 'arguments', different from window.location
        //  - server url, remote flag, workspace id, master token for the workspace
        // To make things simple, only workspace id & master token can be changed
        //  - so, client cannot change server url while working. It's intended.
        //  - who wants for clients send cross-origin requests?
        // Real problem is master token, for dashboard ui usually starts client with restricted
        //   master token that cannot be used for new workspace.
        // So, actual problem is simple - How can we get 'new' master token?
        //   if dashboard/main tab/window is alive, then it manages unrestricted access token with
        //   its own token manager. restricted master token can be generated from it.
        //   if it's gone, nobody holds unrestricted token to access server.
        // Using RemoteAccess in local server is not suitable, for the client has no local
        //   server url when it accesses to remote server.
        // Our solution is simple
        //   if current access token is still valid (not stopped yet)
        //   it's possible to make master token from it, even it's restricted.
        //   (after creating master token, server should decline to refresh the access token)
        //   so, creating new master token is not a hard job, if server helps.

        restart: function restart(newWorkspaceId) {
            return controller.restart(newWorkspaceId);
        },

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
