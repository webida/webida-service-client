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
    './token-manager'
],  function (
    common,
    tokenManager
) {
    'use strict';
    var logger = common.logger.child('auth-service');
    var BOGUS_LOGIN_ID = 'webida-service-client';
    var BOGUS_LOGIN_PASSWORD = 'bogus';

    var privates = {
        credentialFactory : null,
        getCredentialAsync: function getCredentialAsync() {
            var credential = common.api.Credential.fromJson({
                masterToken: common.masterToken,
                loginId: BOGUS_LOGIN_ID,
                loginPassword: BOGUS_LOGIN_PASSWORD
            });
            if (credential.masterToken) {
                return Promise.resolve(credential);
            } else {
                return credentialFactory.getUserCredentialAsync()
                    .then(function (userCred) {
                        credential.loginPassword = userCred.loginPassword;
                        credential.loginId = userCred.loginId;
                        delete credential.masterToken;
                    });
            }
        },

        loginAsync: function loginAsync() {
            return new Promise( function(resolve, reject) {
                authApi.login( privates.credential, function(err, data) {
                    if (err) {
                        // given callback is NOT a  error-first-callback function
                        logger.error('auth error', err);
                        reject(err);
                        // TODO : need to refresh login credential and try again!
                    } else {
                        resolve(data);
                    }
                });
            });
        }
    };

    var publics = {

        getTokenManager: function getTokenManager() {
            return tokenManager;
        },

        init: function init(credentialFactory) {
            privates.credentialFactory = credentialFactory;
            tokenManager.on('lost', function(error) {
                logger.error('should login again', error);
                // invoke credential factory
            });
            tokenManager.on('updated', function(token) {
                logger.debug('updated token', token);
            });
        },

        start: function start() {
            return privates.getCredentialAsync()
                .then( privates.loginAsync() )
                .then( function(token) {
                    tokenManager.updateAccessToken(token);
                    logger.info('service start done');
                });
        },

        stop: function stop() {
            tokenManger.dispose();
            logger.info('service stop done');
            return Promise.resolve();
        }

    };


    return publics;
});
