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
    var logger = common.logger.child('lifecycle-manager');
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

    var manager = {
        getLifecycleEventSource : function getLifecycleEventSource() {
            return privates.emitter;
        },

        init: function init(credentialProvider, bootArgs) {
            try {
                common.init(bootArgs);
                authService.init(credentialProvider);
                logger.info('initializing complete');
            } catch (e) {
                logger.error('webida-service-client initialization failed', e);
                privates.emitter.emit('init-error', e);
                throw e;
            }
        },

        start: function start() {
            // we need Promise.series in fact
            return authService.start().then(sessionService.start).then(workspaceService.start)
                .then(function() {
                    logger.info('webida-service-client start complete');
                    privates.emitter.emit('started');
                });
        },

        stop: function stop() {
            return workspaceService.stop().then(sessionService.stop).then(workspaceService.stop)
                .then(function() {
                    logger.info('webida-service-client stop complete');
                });
        },

        // client app should not rely on legacy workspace parameter.
        // so, currently, client cannot restart but should be reloaded
        restart: function restart(newWorkspaceId) {
            var newMasterToken;
            return authService.createMasterTokenAsync(newWorkspaceId)
                .then( function(masterTokenObject) {
                    newMasterToken = masterTokenObject.text;
                    return manager.stop();
                })
                .then( function() {
                    common.init({
                        serverUrl: common.serverUrl,
                        workspaceId: newWorkspaceId,
                        masterToken: newMasterToken,
                        isRemoteServer:common.isRemoteServer
                    });
                    return manager.start();
                })
                .catch( function (err) {
                    logger.error('webida-service-client restart failed', err);
                    throw err;
                });
        }
    };

    return manager;
});
