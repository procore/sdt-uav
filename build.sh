#!/bin/bash

babel src/uav.es6.js --out-file dist/uav.js

uglifyjs dist/uav.js --compress --mangle --output dist/uav.min.js

babel src/uav-bind.es6.js --out-file dist/uav-bind.js

uglifyjs dist/uav-bind.js --compress --mangle --output dist/uav-bind.min.js
