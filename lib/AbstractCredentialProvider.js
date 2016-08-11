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
    './common'
],  function (
    common
) {
    'use strict';

    function AbstractCredentialProvider(name) {
        this.name = name || this.constructor.name;
        if (this.constructor.name === 'AbstractCredentialProvider') {
            throw new TypeError('AbstractCredentialProvider is abstract class');
        }
        this.logger = common.logger.child(this.name);
    }

    AbstractCredentialProvider.prototype = {
       getUserCredentialAsync : function getUserCredentialAsync(previousError) {
           this.logger.warn('getUserCredentialAsync is not implemented ');
           this.logger.debug('prev auth error', previousError);
           return Promise.reject(new Error('not implemented'));
       }
    };

    return AbstractCredentialProvider;
});
