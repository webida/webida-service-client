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
 * @file session-service.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

// we don't want cyclic dependencies between common and TokenManager.
//  so, instead of requiring just ./common, we require all dependencies directly
//  the only instance of TokenManager is saved in common
define([
    './common',
    './socket/SessionSocketClient'
],  function (
    common,
    SessionSocketClient
) {
    'use strict';
    var logger = common.logger.child('session-service');

    var privates = {
        sessionClient: null
    }; 
    
    var publics = {
        getEventSource : function getEventSource() {
            return privates.sessionClient;
        },

        start: function start() {
            privates.sessionClient = new SessionSocketClient();
            return new Promise(function(resolve, reject) {
                function onConnect() {
                    logger.info('service start done');
                    privates.sessionClient.removeAllListeners();
                    resolve();
                }
                function onConnectError(err) {
                    logger.error('service start failed', err);
                    privates.sessionClient.removeAllListeners();
                    reject(err);
                }
                privates.sessionClient.once('connect', onConnect);
                privates.sessionClient.once('connect_error', onConnectError);
                privates.sessionClient.connect();
            });
        },

        stop: function stop() {
            if (!privates.sessionClient) {
                logger.debug('service stopped already');
                return Promise.resolve();
            }
            return new Promise( function(resolve) {
                var onDisconnect = function onDisconnect() {
                    privates.sessionClient.removeAllListeners();
                    privates.sessionClient = null;
                    // do we need to remove all listeners of session clients?
                    logger.info('service stop done');
                    resolve();
                };
                // Since socket.io client does not specify disconnect error
                // we may need to set some timeout for edge cases.
                privates.sessionClient.once('disconnect', onDisconnect);
            });
        }
    };
    
    return publics; 
});
