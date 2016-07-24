// this configuration file generates 'browser-only' bundle file

var path = require('path');

module.exports = {
    entry: './main.js',
    resolve: {
        root: [
            __dirname,
            path.join(__dirname, 'node_modules'),
            path.join(__dirname, 'node_modules', 'webida-restful-api', 'src')
        ],
        alias: {
            // for browser target(web), bundling superagent.js from node_modules
            //  does not work, with many errors. As a workaround, we use pre-built one.
            'superagent': 'superagent/superagent.js',

            // we've not tested other event emitters.
            // event-emitter looks fine but may have some problems with Object.freeze()
            // 'eventEmitter': 'wolfy87-eventemitter'
        }
    },

    target: 'web', 

    output: {
        libraryTarget: 'amd',
        path: __dirname, 
        filename: 'webida-service-client-bundle.js'
    },

    devtool:'@source-map',

    module: {
        noParse: [
            /superagent\.js$/
        ]
    }, 

    node: {
        console: false, 
        global:false, 
        process:false, 
        Buffer:false,
        __filename:false, 
        __dirname:false,
        fs : "empty"
    }
};
