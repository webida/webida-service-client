define(['./webida-service-client-bundle'], function (webida) {
    'use strict';
/*
    Logger.config.defaultLogLevel = Logger.LEVEL.ALL;

    var logger = new Logger('test-main');
    logger.debug('debug debug');

    var testLog = function() {
        logger.debug('test log');
    };

    function MyClass() {
        this.logger = logger.child('MyClass');
        this.logger.info('hey!');
        this.instanceMethod = function instanceMethod() {
            this.logger.info('boooo! ');
        };
    }

    MyClass.prototype = {
        myMethod: function() {
            this.logger.info('ho!');
        }
    };

    MyClass.staticMethod = function staticMethod() {
        logger.debug('static static');
    };

    var z = MyClass;
    var obj = new MyClass();
    obj.myMethod();

    var obj2 = new z();
    obj2.instanceMethod();
    MyClass.staticMethod();
    testLog(); */ 
    webida.common.logger.debug('webida', webida); 

});
