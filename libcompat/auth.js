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
 * @file auth.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

define([
    '../lib/genetic/genetic',
    '../lib/common',
    '../lib/controller',
    '../lib/auth-service',
    '../lib/AbstractCredentialProvider'
],  function (
    genetic,
    common,
    controller,
    authService,
    AbstractCredentialProvider
) {
    'use strict';
    var logger = common.logger.child('auth');
    var AuthApi = common.api.AuthApi;
    var authApi = new AuthApi();

    function SimpleCredentialProvider() {
        AbstractCredentialProvider.call(this);
    }

    genetic.inherits(SimpleCredentialProvider, AbstractCredentialProvider, {
        getUserCredentialAsync : function getUserCredentialAsync() {
            var ret = {};
            ret.loginId = window.prompt('input login id');
            ret.loginPassword = window.prompt('input login password');
            return Promise.resolve(ret);
        }
    });

    var simpleCredentialProvider = new SimpleCredentialProvider();

    // initAuth is called by app.js at first, before loading any other plugins
    // so, compatible auth should control init/start procedures
    // and, finally, callback( sessionId ) should be called
    // oddly, legacy initAuth cannot pass error to callback.
    function initAuth(clientId, redirectUrl, tokenGenerator, callback) {
        Promise.resolve(controller.init(simpleCredentialProvider))
            .then(function () {
                return controller.start()
            })
            .then(function () {
                // now all services are started.
                // note that access token is available from common, too.
                logger.debug('initAuth complete, invoking callback with session id');
                var tokenManager = authService.getTokenManager();
                return callback(tokenManager.sessionId);
                // if callback throws some error
                // then following catch shold handle the error.
            })
            .catch(function (err) {
                logger.error('initAuth met error', err);
                // we cannot invoke callback with error
                // so, we have to do something disruptive!
                alert('This app client cannot start\n' + err.message || err);
            });
    }

    function getMyInfo(callback) {
        authApi.getInfo(function (error, data) {
            logger.debug('AuthApi.getInfo callback with ', error, data);
            if (!error) {
                callback(null, data);
            } else {
                logger.debug('getMyInfo failed', error);
                callback(error);
            }
        });
    }

    return {
        initAuth : initAuth,
        getMyInfo : getMyInfo,
        
        // for compatiblity with legacies
        getTokenObj : function getTokenObj() {
            var token = common.accessToken;
            if (token) {
                return {
                    issueTime : token.issuedAt,
                    data : token.text
                };
            }
        },

        getToken : function getToken() {
            var token = common.accessToken;
            if (token) {
                return token.text;
            }
        },

        getSessionID : function getSessionID() {
            var token = common.accessToken;
            if (token) {
                return token.sessionId;
            }
        }
    };
});