#!/bin/sh 

FILES=webida-service-client-bundle.js*

rm -f $FILES ./html-test/$FILES
webpack -p --progress
gzip -fkv $FILES
cp -f $FILES ./html-test
