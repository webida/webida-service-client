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
 * @file CompatibleMount.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

define([
    '../lib/common',
    '../lib/workspace-service',
    '../lib/wfs/wfs-utils'
], function (
    common,
    workspaceService,
    wfsUtils
) {
    'use strict';

    // provides subset of legacy FileSystem object
    // some methods are not supported, completely
    // we should create better interface in next api 0.2 with cleaner spec and Promise
    
    var logger = common.logger.child('CompatibleMount');
    var abstractify = wfsUtils.abstractify;
    var workspaceApi = common.api.WorkspaceApi;

    function CompatibleMount(wfsMount) {
        this.wfsMount = wfsMount;
     }

    CompatibleMount.prototype = {
        _invokeCallback: function _invokeCallback(apiName, callback, err, result) {
            try {
                callback(err, result);
            } catch(e) {
                logger.warn('Callback of CompatibleMount#' + apiName + '() threw error', e);
            }
        },

        createDirectory: function wfsCreateDirCompat(path, recursive, callback) {
            return this.wfsMount.createDir(path, recursive, callback);
        },

        exists: function wfsExists(path, callback) {
            return this.wfsMount.stat(path, true, callback);
        },

        // legacy stat api is not supported in new wfs mount api, for it's actually 'bulk stat'.
        // we may need to extend WfsMount to support the feature but not now.
        // WfsMount#dirTree will save us.

        // stat: function wfsStatCompat() ,, ...

        isDirectory: function (path, callback) {
            var myself = this;
            this.wfsMount(path, false, function (err, result) {
                myself._invokeCallback('isDirectory', callback, err, result.isDirectory());
            });
        },

        isFile: function (path, callback) {
            var myself = this;
            this.wfsMount.stat(path, function (err, result) {
                myself._invokeCallback('isFile', callback, err, !result.isDirectory() );
            });
        },

        isEmpty: function (path, callback) {
            var myself = this;
            this.wfsMount.dirTree(path,1, function (err, tree) {
                myself._invokeCallback('list', callback, err, tree.children.length === 0);
            });
        },

        readFile :  function (path, responseType, callback) {
            responseType = responseType || 'text';
            if (!callback) {
                callback = responseType;
                responseType = 'text';
            }
            return this.wfsMount.readFile(path, responseType, callback);
        },

        writeFile : function wfsWriteFile(path, data, callback) {
            return this.wfsMount.writeFile(path, data, callback);
        },

        copy : function (src, dst, recursive, callback) {
            var myself = this;
            // when recursive is omitted, webida 0.3 api doc says it's false
            // but, actually, is handled to be true & there's no code that
            // omits recursive flag nor set it false.
            // So, new API does not have 'recursive' option.
            return this.wfsMount.copy(src, dst, callback);
        },

        move : function (src, dst, callback) {
            return this.wfsMount.move(src, dst, callback);
        },

        list : function (path, recursive, callback) {
            if (!callback) {
                callback = recursive;
                recursive = false;
            }
            var myself = this;
            this.wfsMount.dirTree(path, (recursive ? -1 : 1) , function (err, tree) {
                myself._invokeCallback('list', callback, err, tree.children);
            });
        },

        'delete' : function (path, recursive, callback) {
            if (typeof recursive === 'function') {
                callback = recursive;
                recursive = false;
            }
            return this.wfsMount.remove(path, !recursive, callback);
        },

        exec :  function (path, info, callback) {
            // info
            //   : cmd<String>
            //   : args<String[]>
            var myself = this;
            // replace 'git.sh' to 'git' for compatiblity
            if (info.cmd === 'git.sh') {
                info.cmd = 'git';
            }
            try {
                workspaceApi.exec({
                        command : info.cmd,
                        args: info.args,
                        cwd: wfsUtis.normalizePath(path) // input, timeout will use default value
                    },
                    false,  // legacy api does not support async exec
                    function(err, result) {
                        var stdout, stderr, error;
                        if (typeof result === 'object') {
                            stdout = result.stdout;
                            stderr = result.stderr;
                            error = result.error;
                        }
                        // TODO : _invokeCallback should be able to handle multiple result arguments
                        try {
                            callback(err || error, stdout, stderr);
                        } catch (e) {
                            logger.warn('Callback of CompatibleMount#exec() threw error', e);
                        }
                    }
                );
            } catch(e) {
                myself._invokeCallback('exec', callback, e);
            }
        },
        searchFiles: abstractify('searchFiles'),
        replaceFiles: abstractify('replaceFiles'),
        addAlias : abstractify('addAlias')
    };

    return CompatibleMount;
});