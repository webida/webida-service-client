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
 * @file WfsStats.js
 * @since 1.7.0
 * @author jh1977.kim@samsung.com
 */

define([ ], function() {
    'use strict';

    // TODO: reuse model class from webida-restful-api

    function WfsStats (apiModelStats, path) {
        // all other properties are inherited from server stats object
        this.size = apiModelStats.size;
        this.mtime = apiModelStats.mtime;
        this.birthtime = apiModelStats.birthtime;
        this.mode = apiModelStats.mode;
        this.nlink = apiModelStats.nlink;
        this.type = apiModelStats.type;
        if (path) {
            this.setPath(path);
        }
    }

    WfsStats.prorotype = {
        get isFile() { return (this.type === 'FILE'); },
        get isDirectory() { return (this.type === 'DIRECTORY'); },
        get isBlockDevice() { return (this.type === 'BLOCK_DEVICE'); },
        get isCharacterDevice() { return (this.type === 'CHARACTER_DEVICE'); },
        get isSymbolicLink() { return (this.type === 'LINK'); },
        get isFIFO() { return (this.type === 'FIFO'); },
        get isSocket() { return (this.type === 'SOCKET'); },

        setPath : function setPath(value) {
            this.path = value;
            this.name = value ? value.split('/').pop() : undefined;
        },

        getModeString: function getModeString() {
            var modeNumber = this.mode || 0;
            var readables = [];
            for (var i = 2; i >= 0; i--) {
                readables.push((modeNumber >> i * 3) & 4 ? 'r' : '-');
                readables.push((modeNumber >> i * 3) & 2 ? 'w' : '-');
                readables.push((modeNumber >> i * 3) & 1 ? 'x' : '-');
            }
            // optional
            if ((modeNumber >> 9) & 4) // setuid
                readables[2] = readables[2] === 'x' ? 's' : 'S';
            if ((modeNumber >> 9) & 2) // setgid
                readables[5] = readables[5] === 'x' ? 's' : 'S';
            if ((modeNumber >> 9) & 1) // sticky
                readables[8] = readables[8] === 'x' ? 't' : 'T';
            return readables.join('');
        }
    };

    WfsStats.createFakeStats = function createFakeStats(timestamp, data) {
        var ret = new WfsStats({
            size : data.size || data.length || -1,
            mtime : timestamp,
            birthtime : timestamp,
            mode: 0,
            nlink : 0,
            type: 'FILE'
        });
        return ret;
    };

    return WfsStats;
});