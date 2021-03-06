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
 * @file TokenManager.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

// we don't want cyclic dependencies between common and TokenManager.
//  so, instead of requiring just ./common, we require all dependencies directly
//  the only instance of TokenManager is saved in common
define([
    'webida-restful-api',
    'eventemitter3',
    './genetic/genetic',
    './logger/Logger'
],  function (
    WebidaRestfulApi,
    EventEmitter,
    genetic,
    Logger
) {
    'use strict';

    var logger = new Logger('webida-service-client/token-manager');

    // issueToken() can take 'timeout' msec
    //  so, we should begin calling issueToken(), at least 30 secs

    var MARGIN_TO_EXPIRE = WebidaRestfulApi.ApiClient.instance.timeout + (30 * 1000);
    var RETRY_AFTER = 5 * 1000;
    var authApi = new WebidaRestfulApi.AuthApi();
    
    // IDE does not use master token except login with master token
    // so, TokenManager handles access token only

    function TokenManager(accessToken) {
        EventEmitter.call(this);
        this._updateTimer = null;
        this.accessToken = null;
        if (accessToken) {
            this.updateAccessToken(accessToken);
        }
    }

    genetic.inherits(TokenManager, EventEmitter, {
        updateAccessToken: function updateAccessToken(newAccessToken) {
            this.accessToken = newAccessToken;
            if (!this.accessToken) {
                return;
            }

            var ttl = this.getRemainingTTL();
            if(ttl < MARGIN_TO_EXPIRE) {
                // this error is very serious. if happens, fix server configuration
                //  we recommend at least 2 min, usually 10 min.
                throw new Error('Token has too short expiration time ' + ttl);
            } else {
                this.emit('updated', this.accessToken);
                // ttl == expire - current
                // after == expire - current - margin == ttl - margin
                this._setUpdateTimer(ttl - MARGIN_TO_EXPIRE);
            }
        },

        _setUpdateTimer: function(after) {
            if (this._updateTimer !== null ) {
                window.clearTimeout(this._updateTimer);
                this._updateTimer = null; 
            }
            var expiresAt =  this.accessToken.expiresAt;
            var ttl = this.getRemainingTTL();
            logger.debug('token expires at '  + expiresAt + ' , ttl = ' + ttl);
            if (ttl < after) {
                var nextUpdateTime = new Date().getTime() + after;
                nextUpdateTime = new Date(nextUpdateTime);
                var updateError = new Error(
                    'cannot schedule next update time - time over :' +
                    ' requested update time = ' + nextUpdateTime  +
                    ' , expiration time = ' + expiresAt
                );
                logger.debug(updateError);
                this.emit('lost', updateError);
                return;
            }
            var willUpdateAt = new Date( new Date().getTime() + after );
            logger.debug('next update will start after ' + after + ' msec ', willUpdateAt);
            this._updateTimer = window.setTimeout(this._doUpdate.bind(this), after);
        },

        // events
        //  updated : normally updated token via schedule
        //  retry : could not update token, but will retry
        //  lost : update failed and there's no chance to get token again.
        //         app should login again.

        _doUpdate: function _doUpdate() {
            logger.debug('start updating tokens');
            var self = this;
            authApi.issueToken( 'ACCESS', {}, function (error, result, response) {
                if(!error) {
                    try {
                        logger.debug('new token arrived', result);
                        self.updateAccessToken(result);
                    } catch (updateError) {
                        logger.debug('new token has serious error', updateError);
                        self.emit('lost', updateError);
                        // should we have to retry? 
                        // no, this error is 'serious' configuration problem.
                    }
                } else {
                    // there can be serveral types of error
                    //  server refused - should not retry (status 4xx, usually) 
                    //  server had error (5xx, 0)
                    logger.debug('could not get new token ', error);
                    if (error.timeout || response.status ===  503) {
                        self.emit('retry', error);
                        self._setUpdateTimer(RETRY_AFTER);
                    } else {
                        logger.debug('server refused to issue new token', error);
                        self.emit('lost', error);
                    }
                }
            }); 
        },

        getRemainingTTL : function() {
            var expireTime = this.accessToken.expiresAt.getTime();
            var currentTime = new Date().getTime();
            return expireTime - currentTime;
        },

        dispose : function disposeTokenManager() {
            if (this._updateTimer) {
                window.clearTimeout(this._updateTimer);
                this.accessToken = null;
            }
        }
    });

    return new TokenManager();
});
