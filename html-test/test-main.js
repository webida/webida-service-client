define(['./webida-service-client-bundle'], function (webida) {
    'use strict';

    var ACP = webida.AbstractCredentialProvider;

    function TestLoginProvider() {
        ACP.call(this);
    }

    TestLoginProvider.prototype = Object.create(ACP.prototype)
    TestLoginProvider.prototype.constructor = TestLoginProvider;
    TestLoginProvider.prototype.getUserCredentialAsync = function(err) {
        if(err) {
            alert('prev auth error = ' + err);
        }
        var ret = { };
        ret.loginId = 'webida';
        ret.loginPassword = 'web2d@42';
        return Promise.resolve(ret);
    };

    var bootArgs = {
        serverUrl:'http://localhost:3355',
        workspaceId:'4effdd36-695b-4f26-a99c-95394dd182be'
    };


    webida.controller.init( new TestLoginProvider(), bootArgs);
    webida.controller.start().then( function() {
        console.log('start done');
        var mount = webida.workspaceService.getFileSystemMount();
        mount.readFile('webida-desktop/README.md', 'text', function(err, text) {
            if (err) {
                console.error('reading README.md error', err);
            } else {
                console.log('read README.md = [' +  text + ']');
            }
        });

        mount.readFile('webida-desktop/package.json', 'text', function(err, text) {
            if (err) {
                console.error('reading package.json error', err);
            } else {
                console.log('read package.json text  = [' +  text + ']');
            }
        });

        mount.readFile('webida-desktop/package.json', 'json', function(err, data) {
            if (err) {
                console.error('reading package.json obj error', err);
            } else {
                console.log('read package.json' , data);
            }
        });

    });

    // currently, there's no way to override window.location.href query parameters
    //  when using compatible initAuth api.
    // webida.auth.initAuth(null, null, null, function() {
    //     console.log('initAuth callback', arguments);
    // })

});
