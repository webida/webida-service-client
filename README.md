# webida-service-client

Webida service client API, based on webida-restful-api spec & generated codes

## Build Howto

### Pre-requisites

- node.js
- webpack

Just install webpack to global. (unlike grunt/gulp, local installation is not mandatory yet)
``` shell
npm install -g webpack
```

### Running webpack
Just run, with proper options. currently, default -p option is just enough. or, run with build.sh

``` shell
./build.sh
```

## Contributing

The files built by webpack, service-client-bundle.js & map, can be used as AMD module. Since pre-built files are part of releasing process, do not send a pull request changing the bundles.
