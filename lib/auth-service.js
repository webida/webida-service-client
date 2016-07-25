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
    var MAX_LOGIN_TRY = 5;

    var authApi = new common.api.AuthApi();

    var privates = {
        credentialProvider : null,
        getCredentialAsync: function getCredentialAsync(previousError) {
            var credential = new common.api.Credential(BOGUS_LOGIN_ID, BOGUS_LOGIN_PASSWORD);
            if (common.masterToken) {
                credential.masterToken = common.masterToken;
                return Promise.resolve(credential);
            } else {
                return privates.credentialProvider.getUserCredentialAsync(previousError)
                    .then(function (userCred) {
                        credential.loginPassword = userCred.loginPassword;
                        credential.loginId = userCred.loginId;
                        delete credential.masterToken;
                        return credential;
                    });
            }
        },

        loginAsync: function loginAsync(credential) {
            var loginCount = 0;
            return new Promise( function(resolve, reject) {
                function loginCallback(err, data) {
                    loginCount++;
                    if (err) {
                        if (err.statusCode === 401) {
                            if (loginCount > MAX_LOGIN_TRY) {
                                var msg = 'too many failures ' + loginCount +'/'+MAX_LOGIN_TRY;
                                var err = new Error(msg);
                                logger.error('gave up retry', err);
                                reject(err);
                            } else {
                                return privates.getCredentialAsync(err)
                                    .then(function(credential) {
                                        // call stack will grow up
                                        authApi.login(credential, loginCallback);
                                    })
                                    .catch( function(e) {
                                        logger.error('cannot get login credential', e);
                                        reject(e);
                                    });
                            }
                        } else {
                            logger.error('login failed with unexpected error', loginCount, err);
                            reject(err);
                        }
                    } else {
                        logger.debug('login success', data);
                        resolve(data);
                    }
                }
                authApi.login(credential, loginCallback);
            });
        }
    };

    var publics = {

        getTokenManager: function getTokenManager() {
            return tokenManager;
        },

        createMasterTokenAsync: function createMasterTokenAsync(workspaceId) {
            return new Promise( function(resolve, reject) {
                authApi.issueToken('MASTER', {
                    workspaceId:workspaceId
                }, function(err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            })
        },

        init: function init(credentialProvider) {
            privates.credentialProvider = credentialProvider;
            tokenManager.on('lost', function(error) {
                logger.error('should login again', error);
            });
            tokenManager.on('updated', function(token) {
                logger.debug('updated token', token);
            });
        },

        start: function start() {
            return privates.getCredentialAsync()
                .then( function(credential) {
                    return privates.loginAsync(credential)
                })
                .then( function(token) {
                    tokenManager.updateAccessToken(token);
                    logger.debug('service start done');
                });
        },

        stop: function stop() {
            tokenManager.dispose();
            logger.debug('service stop done');
            return Promise.resolve();
        }

    };


    return publics;
});
