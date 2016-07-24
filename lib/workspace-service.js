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
 * @file workspace-service.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

define([
    './common',
    './cache-db-manager',
    './session-service'
],  function (
    common,
    sessionService,
    cacheDbManager
) {
    'use strict';

    var logger = common.logger.child('workspace-service');
    var workspaceApi = new common.api.WorkspaceApi();

    var privates = {
        workspace : null,
        mount: null,
        cache: null,

        initCache : function initCache() {
            if (cacheDbManager.unavailable) {
                privates.cache = null;
                logger.debug('caching is not supported for local storage, in this browser');
                return Promise.resolve();
            }
            if (!privates.needCaching()) {
                privates.cache = null;
                logger.debug('no need to cache wfs for local access');
                return Promise.resolve();
            }

            var cache = new WfsOfflineCache(workspace.id, sessionService.getEventSource());
            return cache.init().then( function() {
                privates.cache = cache;
            }).catch( function(err) {
                logger.error('cache init error', err);
                privates.cache = null;
                // consumes error here. so, start will not failed for cache error
            });
        },

        needCaching : function needCaching() {
            // TODO : add 'forced caching' with local storage value
            return !common.inDesktopApp || common.remote;
        }
    };

    var publics = {

        getCurrentWorkspace: function getCurrentWorkspace() {
            return privates.workspace;
        },

        getCacheDbManager: function getCacheDbManager() {
            return cacheDbManager
        },

        getFileSystemMount: function getFileSystemMount() {
            return privates.mount;
        },

        // after invoking WorkspaceApi#putWorkspade() for current workspace,
        // client should set updated workspace model in response to workspace service
        // TODO : encapsulate putWorkspace() here.
        setCurrentWorkspace : function setCurrentWorkspace(workspaceModel) {
            privates.workspace = workspaceModel;
        },

        start: function start() {
            return new Promise(function(resolve, reject) {
                workspaceApi.findWorkspaces(common.workspaceId, { },
                    function handleFoundWorkspace(err, result) {
                        if (err) {
                            logger.error('service init failed', err);
                            reject(err);
                        } else {
                            privates.workspace = result;
                            privates.mount = new WfsMount(result.id);
                            privates.initCache().then( function() {
                                logger.info('service init done', result);
                                // do we need some setter method?
                                privates.mount.cache = privates.cache;
                                resolve();
                            }).catch( function(err) {
                                reject(err);
                            });
                        }
                    });
            });
        },

        stop: function stop() {
            if (!privates.workspace) {
                logger.debug('service stopped already');
            }
            // TODO : add terminating all background jobs launched
            // TODO : add canceling all cache uploading/fetching jobs
            privates.workspace = null;
            privates.mount = null;
            privates.cache = null;
            logger.info('service stop');
            return Promise.resolve(this);
        },

        // TODO - implement managing async response channels
        openAsyncChannel : function openAsyncChannel() {
            throw new Error('not implemented yet');
            // before calling WorkspaceAPI#exec,
            // clients should prepare socket channel to get response from child process
            // each channel has it's own, unique execId property
            // each channel emits
            //  - stdout event
            //  - stderr event
            //  - exit event
            //  - canceled
            // when child process exits, channels are disposed by workspaceService, automatically
        }
    };


   //  // we can start working when session is connected
   //  session.on('connect', function() {
   //     workspaceApi.findWorkspaces(common.workspaceId, { },
   //         function handleFoundWorkspace(err, result) {
   //             if (err) {
   //                 logger.error('cannot find workspace from server', err);
   //                 workspaceService.emit('error');
   //                 return;
   //             }
   //             logger.debug('service found current workspace', result[0]);
   //             workspaceService._update(result[0]);
   //             workspaceService.emit('available');
   //             logger.debug('service started', workspaceService);
   //         }
   //     );
   // });
   //
   //  session.on('disconnect', function() {
   //      logger.debug('service stops');
   //      workspaceService.emit('unavailable');
   //  });

    return publics;
});
