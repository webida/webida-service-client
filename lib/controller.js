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
    'eventemitter3',
    './common',
    './auth-service',
    './session-service',
    './workspace-service'
],  function (
    EventEmitter,
    common,
    authService,
    sessionService,
    workspaceService
) {
    'use strict';
    var logger = common.logger.child('controller');
    var components = [sessionService, workspaceService];

    // TODO: introduce bluebird promise library and use Proimse.series
    //  It's time to move to better promise implementation from vanilla native promises

    var privates = {
        emitter : new EventEmitter(),
        promiseSeries: function pseries(list) {
            return list.reduce(function(promise, fn) {
                return promise.then(fn);
            }, Promise.resolve() );
        },

        issueMasterTokenAsync: function(accessToken, workspaceId) {
            // since auth service is stopped now,
            // we can't use normal api client for token manager has lost access token now
            authService.issueToken(accessToken)
        }
    };

    var controller = {
        getLifecycleEventSource : function getLifecycleEventSource() {
            return privates.emitter;
        },

        // init service
        //  - sets credential factory to right place
        //  - parses boot arguments
        //  - should be called once and only once, when app is booting

        init: function init(credentialProvider, bootArgs) {
            try {
                common.init(bootArgs);
                authService.init(credentialProvider);
                logger.info('webida-service-client init complete');
                privates.emitter.emit('init');
            } catch (e) {
                logger.error('webida-service-client init failed', e);
                privates.emitter.emit('init-error', e);
                throw e;
            }
        },

        // start service
        //  - do authentication
        //  - establish session connection
        //  - gets workspace information & mount file system
        //  - init offline cache and begin background jobs(gc, prefetching, upload pending changes)
        start: function start() {
            // we need Promise.series in fact
            return authService.start().then(sessionService.start).then(workspaceService.start)
                .then(function() {
                    logger.info('webida-service-client start complete');
                    privates.emitter.emit('start');
                })
                .catch(function(e) {
                    logger.error('webida-service-client start failed', e);
                    privates.emitter.emit('start-error', e);
                    throw e;
                });
        },

        // stop service
        //  - cancels all downloading/uploading jobs of off-line cache
        //  - cancels all background processes in server, launched by this session
        //  - close all web socket connections
        //  - unmount file system if needed
        //  - discard access token & stop auto-refreshing

        stop: function stop() {
            return workspaceService.stop().then(sessionService.stop).then(workspaceService.stop)
                .then(function() {
                    logger.info('webida-service-client stop complete');
                    privates.emitter.emit('stop');
                })
                .catch(function(e) {
                    logger.error('webida-service-client stop failed', e);
                    privates.emitter.emit('stop-error', e);
                    throw e;
                });
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
        // Using RemoteAccess in local server is not suitable, for the client has no local server's
        //   url when it accesses to remote server.
        // Our solution is simple
        //   if current access token is still valid (not stopped yet)
        //   it's possible to make master token from it, even it's restricted.
        //   (after creating master token, server should reject refreshing current access token)
        //   so, creating new master token is not a hard job, if server helps.

        // CURRENTLY, NOT SUPPORTED YET, because
        //  client app should not rely on legacy workspace parameter.
        //  legacy clients should be reloaded, instead.
        restart: function restart(newWorkspaceId) {
            var newMasterToken;
            return authService.createMasterTokenAsync(newWorkspaceId)
                .then( function(masterTokenObject) {
                    newMasterToken = masterTokenObject.text;
                    return controller.stop();
                })
                .then( function() {
                    common.init({
                        serverUrl: common.serverUrl,
                        workspaceId: newWorkspaceId,
                        masterToken: newMasterToken,
                        isRemoteServer:common.isRemoteServer
                    });
                    return controller.start();
                })
                .then(function() {
                    logger.info('webida-service-client restart complete');
                    privates.emitter.emit('restart');
                })
                .catch( function (err) {
                    logger.error('webida-service-client restart failed', err);
                    privates.emitter.emit('restart-error');
                    throw err;
                });
        }
    };

    return controller;
});
