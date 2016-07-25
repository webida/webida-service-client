/*
 * Copyright (c) 2012-2015 S-Core Co., Ltd.
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
 * @file Logger
 * @since 0.7.0
 * @author jh1977.kim@samsung.com
 */

define([ ], function () {
    'use strict';

    // LEVEL follows java convention. so, trace level is lower than debug level
    var LEVEL = {
        ALL: 1,
        TRACE: 5,
        DEBUG: 10,
        INFO: 20,
        WARN: 30,
        ERROR: 40,
        FATAL: 50,
        OFF: Number.MAX_VALUE
    };

    // each level number should have responsive console method name
    // e.g. logger.debug() will be logged with console.log()

    var ACTION = {
        1: 'log',
        5: 'trace',
        10: 'log',
        20: 'info',
        30: 'warn',
        40: 'error',
        50: 'error'
    };

    /**
     * A Logger.
     * @constructor
     * @param name : logger name
     * @param owner : owner module path string or class instance that has this logger
     * @level : log level
     */
    function Logger(name) {
        this.name = name || '';
        this.logLevel = Logger.getLogLevel(this.name);
        this.count = 0;
    }

    Logger.prototype = {

        debug: function () {
            this.log(LEVEL.DEBUG, arguments);
        },

        // use this api to log event emitting & send/receive events
        trace: function () {
            this.log(LEVEL.TRACE, arguments);
        },

        info: function () {
            this.log(LEVEL.INFO, arguments);
        },

        warn: function () {
            this.log(LEVEL.WARN, arguments);
        },

        error: function () {
            this.log(LEVEL.ERROR, arguments);
        },

        // fatal level prints log in error level & shows alert.
        // fatal level should be used when client app is considered to be CRASHED or to be
        //  in need of manual RESTART.
        // Be extremely cautious or never use fatal level logs.
        fatal: function () {
            this.log('fatal', arguments);
        },

        log: function (level, args) {
            if (this.isEnabled(level)) {
                var action = ACTION[level];
                args = this.formatLog(args);
                console[action].apply(console, args);
            }
        },

        isEnabled: function (level) {
            return (level >= this.logLevel);
        },

        child: function createChild(owner) {
            var childName;
            switch(typeof owner) {
                case 'function':
                    childName = owner.name || '';
                    break;
                case 'object':
                    childName = '';
                    Logger.nameProperties.some( function(prop) {
                        if (owner[prop]) {
                            childName = owner[prop];
                            return true;
                        }
                    });
                    break;
                case 'string':
                    childName = owner;
                    break;
                default:
                    throw new Error('invalid owner - should be string/object/constructor');
            }
            return new Logger(childName ? this.name + '/' + childName : this.name);
        },

        getStackTrace : function getStackTrace(baseDepth) {
            var stack;
            try {
                throw new Error('');
            }
            catch (error) {
                stack = error.stack || '';
            }
            stack = stack.split('\n').map(function (line) { return line.trim(); });
            return stack.splice(stack[0] === 'Error' ? baseDepth + 2 : baseDepth + 1);
        },

        getTimestamp : function getTimestamp(date) {
            var result = [];
            // we may need a better formatter library, but currently, this's enough.
            function padZero(number, width){
                return Array(width - String(number).length + 1).join('0') + number;
            }
            var now = date || new Date();
            var numbers = [now.getHours(), now.getMinutes(),now.getSeconds()];

            return numbers.map(
                function(number) {
                    return padZero(number, 2);
                }
            ).join(':') + '.' + padZero(now.getMilliseconds(), 3);
        },

        // this method hacks browser's stack trace message format. very fragile.
        parseStackTraceLine : function parseStackTraceLine(traceLine) {
            var ret = {
                fileName: '?',
                fileLine: '?',
                method: ''
            };
            var callPath = traceLine.slice(traceLine.lastIndexOf('/') + 1);
            var pathSegments = callPath.split(':');
            ret.fileName = pathSegments[0];
            ret.fileLine = pathSegments[1];
            var callSegments = traceLine.split(' ');

            // (without any scope)
            // IE     at Anonymous function ($url)
            // chrome at $url

            // (with scope)
            // IE     at MyClass ($url)  or  at myMethod ($url)
            // chrome at Object.MyClass ($url) / Function.staticMethod / Object.myMethod...

            if (callSegments[0] == 'at') {
                var callMethod = callSegments[1];
                if (callMethod.indexOf('://') >= 0) {
                    ret.method = '';
                } else {
                    switch(callMethod) {
                        case 'new':       // chrome
                            callMethod = callSegments[2];
                            break;
                        case 'Anonymous': // IE only
                            callMethod = '';
                            break;
                        default:
                            // chrome sets as Object.MyClass / Function.staticMethod ...
                            var callMethodSegments = callMethod.split('.');
                            if (callMethodSegments.length > 1) {
                                callMethod = callMethodSegments.pop();
                            }
                            break;
                    }
                    ret.method = callMethod;
                }
            }
            return ret;
        },

        formatLog : function formatLog(args) {
            if (!Array.isArray(args)){
                var newArgs = [];
                for (var i=0; i < args.length; i++) {
                    newArgs.push(args[i]);
                }
                args = newArgs;
            }

            //style
            var count = this.count++;
            var timestamp = this.getTimestamp();
            var prefix = '[' + timestamp + '] ' + this.name + '[' + count + ']';

            if (args.length === 2 && typeof args[0] === 'string' && args[0].substr(0, 2) === '%c') {
                prefix = '%c' + prefix + ' ' + args[0].substr(2);
                ([]).shift.call(args);
            }
            // stack 0 - callLine
            // stack 1 - logger.debug/info/error, ...  (in some loggable code)
            // stack 2 - logger.debug
            // stack 3 - logger.formatLog
            // stack 4 - logger.getStackTrace
            // stack 5 - internal error thrown in getStackTrace
            var stack = this.getStackTrace(3);
            var parsed = this.parseStackTraceLine(stack[0]);
            var suffix = '<' + [parsed.fileName , parsed.fileLine, parsed.method].join(':') + '>';
            return [].concat(prefix, args, suffix);
        }
    };

    Logger.LEVEL = LEVEL;

    Logger.nameProperties = ['_id', 'id', '_name', 'name'];

    Logger.config = {
        defaultLogLevel: LEVEL.WARN,
        levels: { }
    };

    Logger.getLogLevel = function getLogLevel(fullName) {
        var segments = fullName.split('/');
        var name;
        for (var pos = segments.length; pos > 0; pos--) {
            name = segments.slice(0, pos).join('/');
            if (Logger.config.levels[name]) {
                return Logger.config.levels[name]
            }
        }
        return Logger.config.defaultLogLevel;
    };

    try {
        var loggerConfig = window.localStorage.getItem('webida-logger-config');
        if (loggerConfig) {
            Logger.config = JSON.parse(loggerConfig);
        }
    } catch (e) {
        console.error('logger configuration loading error', e);
    }

    return Logger;
});