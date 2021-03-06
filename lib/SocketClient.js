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
 * @file SocketClient.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

// we don't want cyclic dependencies between common and TokenManager.
//  so, instead of requiring just ./common, we require all dependencies directly
//  the only instance of TokenManager is saved in common
define([
    'urijs',
    'eventemitter3',
    'lodash',
    'socket.io-client',
    './genetic/genetic',
    './common',
    './token-manager'
],  function (
    URI,
    EventEmitter,
    _,
    io,
    genetic,
    common,
    tokenManager
) {
    'use strict';

    var logger = common.logger.child('SocketClient');

    // to protect session token from outage,
    // token manager should care about 'maximum recovery time'
    // since we use socket.io's reconnection mechanism, calculation is quite complex.

    var CONNECT_OPTIONS = {
        multiplex: true,                // each socket share web socket connection (need testing)
        timeout : 5000,                 // before connect_error and connect_timeout are emitted.
        transports : ['websocket'],     // forces the transport to be only websocket.
        reconnection: true,
        reconnectionDelay: 500,         // delay grows 0.5, 1.0, 1.5, to 3.0
        reconnectionDelayMax : 3000,
        reconnectionAttempts: 20
    };

    // connectOptions.query is object, not string
    function SocketClient() {
        EventEmitter.call(this);
        this._connectOptions = CONNECT_OPTIONS;
        this.socket = null;
        this.isConnected = false;
        this.reconnectingCount = 0;
        this.disconnectedWhen = new Date().getTime();
    }

    genetic.inherits(SocketClient, EventEmitter, {

        connect: function connect() {
            // connect options cannot be changed after socket object is made
            // even if we put a getter for this._connectOptions.query,
            // socket.io will not read the query string again.
            this._connectOptions.query = this._buildConnectQueryString();
            logger.debug(this.constructor.name + ' connecting to ' + common.serverUrl,
                this._connectOptions);
            this.socket = io(common.serverUrl, this._connectOptions);
            this._registerDefaultEventHandlers();
        },

        disconnect: function disconnect() {
            this.socket.disconnect();
        },

        // handlers should map event name to handler function
        // handler function should be bound to caller if needed.
        registerEventHandlers: function registerEventHandlers(handlers) {
            var myself = this;
            _.forEach(handlers, function(handler, eventName) {
                myself.socket.on(eventName, handler);
            });
        },

        // calculating recovery time (without max delay)
        //  - worst case : every reconnecting fails with timeout
        //  -  best case : every reconnecting fails immediately
        //  = (n*t) + (d*n*(n-1)/2)
        //  With maximum reconnecting delay time, calculation is a bit more complex
        //  second term of f(n,d,t) becomes
        //    d*m*(m+1)/2 + D*(n-m-1) where D = maximum delay time, m = D/d
        //  = D*(m+1)/2 * D*(n-m-1) = D*(n-(m+1)/2)
        calculateRecoveryTime : function calculateRecoveryTime() {
            var opt = this._connectOptions;

            if (!opt.reconnect) {
                return {
                    best : 0,
                    worst: 0
                };
            }

            var n = opt.reconnectionAttempts;
            var t = opt.timeout;
            var d = opt.reconnectionDelay;
            var D = opt.reconnectionDealyMax;
            var m = D/d;

            var best = D * (n - (m + 1) / 2);
            var worst = best + (n * t);

            //  if we set n = 20, t=5, d = 0.5, D=3 ,in default
            //   best : 3* (20 - 7/2) = 3*16.5 = 49.5
            //   worst : 149.5
            return {
                best : best,
                worst: worst
            };
        },

        _onConnect : function onConnect(error, isTimeout) {
            var info = {
                isTimeout : isTimeout,
                took : (new Date().getTime() - this.disconnectedWhen) + 'msec'
            };
            var shouldEmitEvent = false;
            if (error) {
                // ignores reconnecting error for it will be handled in onReconnect
                if (this.reconnectingCount === 0) {
                    logger.error(this.constructor.name + ' connect error ', error, info);
                    shouldEmitEvent = true;
                }
            } else {
                logger.debug(this.constructor.name + ' connected to server', info);
                shouldEmitEvent = true;
            }
            return shouldEmitEvent; 
        },

        _onDisconnect : function onDisconnect() {
            logger.debug(this.constructor.name + ' disconnected from server');
            this.isConnected = false; 
            return true;
        },

        // error, false => retrying error (will try again)
        // error, true => recovery failed. completely lost (will not try again)
        // null, false => retrying
        // null, true => recovery success
        _onReconnect : function onReconnect(error, done) {
            var reconnectingFor = new Date().getTime() - this.disconnectedWhen;
            var reconnectingInfo = {
                reconnectingCount : this.reconnectingCount,
                reconnectingFor : reconnectingFor + ' msec'
            };
            var shouldEmitEvent = false;
            var name = this.constructor.name; 
            if (error) {
                if (done) {
                    logger.error(name + ' LOST CONNECTION', error, reconnectingInfo);
                    shouldEmitEvent = true;
                    this.reconnectingCount = 0;
                } else {
                    logger.warn(name + ' reconnecting attempt failed', error, reconnectingInfo);
                }
            } else {
                if (done) {
                    logger.debug(name + ' recovered connection ', reconnectingInfo);
                    shouldEmitEvent = true;
                } else {
                    logger.debug(name + ' is trying to recover connection', reconnectingInfo);
                }
            }
            return shouldEmitEvent;
        },


        _buildConnectQueryString: function _buildConnectQueryString() {
            var uri = new URI();
            var queryObject = _.defaults({}, CONNECT_OPTIONS.query);
            queryObject.token = tokenManager.accessToken.text;
            queryObject.workspaceId = common.workspaceId;
            queryObject.sessionId = tokenManager.accessToken.sessionId;
            return uri.query(queryObject).query();
        },

        _registerDefaultEventHandlers: function _registerDefaultEventHandlers () {
            var myself = this;
            var socket = this.socket;

            socket.on('connect', function () {
                myself.isConnected = true;
                myself.reconnectingCount = 0;

                // we don't need to handle manager events
                var shouldEmit = myself._onConnect();
                if (shouldEmit) {
                    myself.emit('connect');
                }
            });

            socket.on('connect_error', function (err) {
                var shouldEmit = myself._onConnect(err);
                if (shouldEmit) {
                    myself.emit('connect_error', err);
                }
            });

            socket.on('connect_timeout', function (err) {
                var shouldEmit = myself._onConnect(err, true);
                if (shouldEmit) {
                    myself.emit('connect_timeout', err);
                }
            });

            socket.on('reconnect_attempt', function (count) {
                myself.reconnectingCount = count;
                myself._onReconnect(null, false);
            });

            // seems to be not fired
            socket.on('reconnect_error', function (err) {
                myself._onReconnect(err, false);
            });

            socket.on('reconnect', function () {
                myself.isConnected = true;
                myself._onReconnect(null, true);
                myself.disconnectedWhen = 0;
                myself.reconnectingCount = 0;
                myself.emit('reconnect');
            });

            socket.on('reconnect_failed', function (err) {
                err = err || new Error('too much retry - reached to limit');
                myself._onReconnect(err, true);
                myself.emit('reconnect_failed', err);
            });

            socket.on('disconnect', function () {
                myself.disconnectedWhen = new Date().getTime();
                myself.isConnected = false;
                myself._onDisconnect();
                myself.emit('disconnect');
            });

            socket.on('session.announcement', function(data) {
                myself.emit('session.announcement', data);
            });

            socket.on('session.closing', function(data) {
                myself.emit('session.closing', data);
            });

            // workspace.watcher events are consumed by WfsMount to be processed to
            // workspace.wfs.* events. While in off-line mode, WfsMount can fire some
            // 'fake' events when writing to cache was successful.
            socket.on('workspace.watcher', function(data) {
                logger.debug('session got workspace.watcher', arguments);
                myself.emit('workspace.watcher', data);
            });
        }
    });

    return SocketClient;
});
