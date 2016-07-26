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
    './session-service',
    './wfs/WfsMount',
    './wfs/WfsOfflineCache'
],  function (
    common,
    cacheDbManager,
    sessionService,
    WfsMount,
    WfsOfflineCache
) {
    'use strict';

    var logger = common.logger.child('workspace-service');
    var workspaceApi = new common.api.WorkspaceApi();

    var CACHE_CLEAN_INTERVAL = 1000 * 60 * 10; // 10 min

    var privates = {
        workspace : null,
        mount: null,
        cache: null,
        cacheClienerTimer: null,

        createCache : function createCache() {
            if (cacheDbManager.unavailable) {
                logger.debug('caching is not supported for local storage, in this browser');
                return Promise.resolve(null);
            }
            if (common.inDesktopApp && !common.isRemoteServer) {
                logger.debug('no need to cache wfs for local access');
                return Promise.resolve(null);
            }
            var workspace = privates.workspace;
            var cache = new WfsOfflineCache(workspace, sessionService.getEventSource());
            return cache.init().then( function() {
                logger.debug('cache created');
                return cache;
            }).catch( function(err) {
                logger.error('cache init error', err);
                // consumes error here. so, start will not failed for cache error
                return null;
            });
        },

        needCaching : function needCaching() {
            // TODO : add 'forced caching' with local storage value
            return !common.inDesktopApp || common.isRemoteServer;
        },

        // TODO: move cleaning jobs to mount.
        startCacheCleaner : function startCacheCleaner() {
            if (privates.cache && !privates.cacheClienerTimer) {
                var job = privates.doCacheClean
                privates.cacheClenerTimer = window.setTimeout(job, CACHE_CLEAN_INTERVAL);
            }
        },

        doCacheClean : function doCacheClean() {
            if(privates.cache) {
                privates.cache.cleanOldItems();
            }
        },

        stopCacheCleaner : function stopCacheCleaner() {
            if (privates.cacheClienerTimer) {
                window.clearInterval(privates.cacheClenerTimer);
                privates.cacheClenerTimer = null;
            }
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
            if (!common.workspaceId) {
                return Promise.resolve();
            }
            return new Promise(function(resolve, reject) {
                workspaceApi.findWorkspaces(common.workspaceId, { }, function (err, result) {
                    if (err) {
                        logger.error('service start failed', err);
                        reject(err);
                    } else {
                        if (result && result.length > 0) {
                            privates.workspace = result[0];
                            privates.mount = new WfsMount(privates.workspace.id);
                            privates.createCache().then( function(cache) {
                                // do we need some setter method?
                                privates.cache = cache;
                                privates.mount.cache = cache;
                                privates.startCacheCleaner();
                                logger.info('service start done');
                                resolve();
                            }).catch( function(err) {
                                reject(err);
                            });
                        } else {
                            logger.error('workspace not found ' + common.workspaceId);
                            reject(err);
                        }
                    }
                });
            });
        },

        stop: function stop() {
            if (!privates.workspace) {
                logger.debug('service stopped already');
            }
            // TODO : add terminating all background jobs launched
            // TODO : add canceling all cache uploading/fetching jobs gracefully
            privates.stopCacheCleaner();
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

    return publics;
});
