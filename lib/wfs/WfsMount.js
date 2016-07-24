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
 * @file WfsMount.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

define([
    '../common',
    '../session-service',
    '../workspace-service',
    './WfsStats',
    './WfsEntry',
    './WfsEventGate',
    './wfs-utils'
], function (
    common,
    sessionService,
    workspaceService,
    WfsStats,
    WfsEntry,
    WfsEventGate,
    wfsUtils
) {
    'use strict';

    // provides subset of legacy FileSystem object
    // some methods are not supported, completely
    // we should create better interface in next api 0.2 with cleaner spec and Promise
    
    var logger = common.logger.child('WfsMount');
    var wfsApi = new common.api.WfsApi();
    var abstractify = wfsUtils.abstractify();

    function WfsMount(fsid) {
        var myself = this;
        var sessionClient = sessionService.getEventSource();
        this.wfsId = fsid;
        this.eventGate = new WfsEventGate(sessionClient, fsid);

        // if watcher has already started by other client
        // wfsWatcher#start event will never be delivered to session socket
        // so, listening on the start event is meaningless for now
        sessionClient.on('wfsWatcher', function(wfsId, event) {
            if (myself.eventGate && myself.wfsId === wfsId && event === 'stop') {
                myself.eventGate.stopListening();
                myself.eventGate = null;
            }
        });
     }

    WfsMount.prototype = {

        // normalizer handles legacy path format with heading '/'
        // and wfs:// url too.
        _normalizePath: function _normalizePath(targetPath, allowUrl) {
            try {
                return wfsUtils.normalizePath(targetPath, allowUrl ? this.wfsId : undefined);
            } catch (e) {
                console.error('legacy path seems to be invalid : ' + targetPath);
            }
        },

        _invokeCallback: function _invokeCallback(apiName, callback, err, result) {
            try {
                callback(err, result);
            } catch(e) {
                logger.warn('Callback of WfsMount#' + apiName + '() threw error', e);
            }
        },

        _maskEvents: function _maskEvents(wfsPath, apiName) {
            if (this.eventGate) {
                this.eventGate.maskEvents(wfsPath, apiName);
            }
        },

        _unmaskEvents: function _unmaskEvents(wfsPath, succeeded, discard) {
            if (this.eventGate) {
                this.eventGate.unmaskEvents(wfsPath, succeeded, discard);
            }
        },

        createDir: function wfsCreateDir(path, ensureParents, callback) {
            var wfsPath = this._normalizePath(path);
            var myself = this;
            try {
                this._maskEvents(wfsPath, 'createDir');
                wfsApi.createDir(this.wfsId, wfsPath, { ensureParents: ensureParents },
                    function(err, result) {
                        var succeeded = err ? false : true;
                        myself._unmaskEvents(wfsPath, succeeded, false);
                        myself._invokeCallback('createDir', callback, err, result);
                    }
                );
            } catch (e) {
                myself._invokeCallback('createDir', callback, e);
            }
        },

        stat: function wfsStat(path, dummyFor404, callback) {
            var wfsPath = this._normalizePath(path);
            var myself = this;
            wfsApi.stat(this.wfsId, wfsPath, { dummyFor404: dummyFor404 },
                function(err, apiResult) {
                    var result;
                    if (!err) {
                        result =  new WfsStats(apiResult, wfsPath);
                    }
                    myself._invokeCallback('stat', callback, err, result);
                }
            );
        },

        dirTree: function wfsDirTree(path, maxDepth, callback) {
            // TODO: 'full recursive' seems to be dangerous
            //   server might suffer from stack overflow or starvation with disk i/o
            //   1) add a 'response header' for incomplete message
            //   2) add timeout parameter in spec
            var wfsPath = this._normalizePath(path);
            var myself = this;
            wfsApi.dirTree(this.wfsId, wfsPath, maxDepth,
                function(err, apiResult) {
                    var result;
                    if (!err) {
                        result = WfsEntry.fromJson(apiResult);
                        result.path = path;
                    }
                    myself._invokeCallback('dirTree', callback, err, result);
                }
            );
        },

        remove : function wfsRemove(path, noRecursive, callback ) {
            var myself = this;
            try {
                var wfsPath = this._normalizePath(path);
                this._maskEvents(wfsPath, 'remove');
                wfsApi.remove(this.wfsId, wfsPath, { noRecursive: noRecursive },
                    function(err, apiResult) {
                        var succeeded = err ? false : true;
                        myself._unmaskEvents(wfsPath, succeeded, false);
                        myself._invokeCallback('remove', callback, err, apiResult);
                    }
                );
            } catch (e) {
                myself._invokeCallback('remove', callback, e);
            }
        } ,

        // TODO : we need 'readAs' parameter replacing response type in next client release
        //  readAs : enum of ['text', 'blob', 'json']  & need a text encoding type.
        //  and- aslo need some enum.

        readFile : function wfsReadFile(path, responseType, callback) {
            var resultType = responseType || 'text';
            var wfsPath = this._normalizePath(path);
            var myself = this;

            // TODO : need check cache before invoking api to get cached stats.
            //  we may need to cache 'etag' value to cache to set if-none-match header.
            wfsApi.readFile(this.wfsId, wfsPath, {  },
                function(err, apiResult) {
                    var result;
                    if (!err) {
                        if (resultType === '' || resultType === 'text') {
                            wfsUtils.blobToStringAsync(apiResult)
                                .then( function(text) {
                                    myself._invokeCallback('readFile', callback, null, text);
                                })
                                .catch( function(err) {
                                    myself._invokeCallback('readFile', callback, err);
                                });
                        } else {
                            result = apiResult;
                        }
                    }
                    myself._invokeCallback('readFile', callback, err, result);
                }
            );
        },

        // TODO - add ensure parameter
        writeFile : function wfsWriteFile(path, data, callback) {
            var myself = this;
            var err = null;
            // TODO : support serialization of plain object
            try {
                switch( typeof(data)) {
                    case 'string':
                        data = new Blob([data], { type:'text/plain'});
                        break;
                    case 'object':
                        if (!(data instanceof Blob)) {
                            err = new Error('invalid data - should be string or Blob');
                            return myself.invokeCallback('writeFile', callback, err);
                        }
                        break;
                    default:
                        err = new Error('invalid data type - should be string or Blob');
                        return myself.invokeCallback('remove', callback, err);
                }
                var wfsPath = this._normalizePath(path);
                this._maskEvents(wfsPath, 'writeFile');
                wfsApi.writeFile(this.wfsId, wfsPath, data, { ensureParents: true },
                    function(err, apiResult) {
                        var succeeded = err ? false : true;
                        myself._unmaskEvents(wfsPath, succeeded, false);
                        myself._invokeCallback('writeFile', callback, err, apiResult);
                    }
                );
            } catch (e) {
                myself.invokeCallback('writeFile', callback, e);
            }
        },

        // TODO: supply more options & change signature to current api
        copy : function wfsCopy(src, dst, options, callback) {
            var myself = this;
            if (typeof options === 'function') {
                callback = options;
                options = {
                    noOverwrite: false,
                    followSymbolicLinks: false,
                    preserveTimestamps: false
                };
            }
            try {
                var wfsPath = this._normalizePath(dst);
                var srcPath = this._normalizePath(src);
                this._maskEvents(wfsPath, 'copy');
                wfsApi.copy(this.wfsId, wfsPath, srcPath, options,
                    function(err, apiResult) {
                        var succeeded = err ? false : true;
                        myself._unmaskEvents(wfsPath, succeeded, false);
                        myself._invokeCallback('copy', callback, err, apiResult);
                    }
                );
            } catch (e) {
                myself._invokeCallback('copy', callback, e);
            }
        },

        // TODO: supply more options & change signature to current api
        move : function wfsMove(src, dst, callback) {
            var myself = this;
            // when recursive is omitted, webida 0.3 api doc says it's false
            // but, actually, is handled to be true & there's no code that
            // omits recursive flag nor set it false.
            // So, new API does not have 'recursive' option.
            try {
                // when dst path is '/aaa/bbb', then actual dst is 'aaa
                var wfsPath = this._normalizePath(dst);
                var srcPath = this._normalizePath(src);
                this._maskEvents(wfsPath, 'move');
                this._maskEvents(srcPath, 'move');

                wfsApi.move(this.wfsId, wfsPath, srcPath, {
                        noOverwrite: false
                    }, function(err, apiResult) {
                        var succeeded = err ? false : true;
                        myself._unmaskEvents(wfsPath, succeeded, false);
                        myself._unmaskEvents(srcPath, succeeded, false);
                        myself._invokeCallback('move', callback, err, apiResult);
                    }
                );
            } catch (e) {
                myself._invokeCallback('move', callback, e);
            }
        },

        search: abstractify('search'),
        replace: abstractify('replace'),
        addAlias : abstractify('addAlias')
    };

    return WfsMount;
});