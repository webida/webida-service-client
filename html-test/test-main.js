define(['./webida-service-client-bundle'], function (webida) {
    'use strict';

    var ACP = webida.AbstractCredentialProvider;

    function SimpleCredentialProvider() {
        ACP.call(this);
    }

    SimpleCredentialProvider.prototype = Object.create(ACP.prototype)
    SimpleCredentialProvider.prototype.constructor = SimpleCredentialProvider;
    SimpleCredentialProvider.prototype.getUserCredentialAsync = function(err) {
        if(err) {
            alert('prev auth error = ' + err);
        }
        var ret = { };
        ret.loginId = window.prompt('input login id');
        ret.loginPassword = window.prompt('input login password');
        return Promise.resolve(ret);
    };

    var bootArgs = {
        serverUrl:'http://localhost:3355',
        workspaceId:'4effdd36-695b-4f26-a99c-95394dd182be'
    };
    //
    // webida.init( new SimpleCredentialProvider(), bootArgs);
    // webida.start().then( function() {
    //     console.log('start done');
    // });

    webida.auth.initAuth(null, null, null, function() {
        console.log('initAuth callback', arguments);
    })

});
