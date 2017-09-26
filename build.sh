#!/bin/bash

rollup src/index.js -o dist/uav.js -f iife

babel dist/uav.js --out-file dist/uav.js

uglifyjs dist/uav.js --compress --mangle --output dist/uav.min.js

babel src/uav-bind.js --out-file dist/uav-bind.js

uglifyjs dist/uav-bind.js --compress --mangle --output dist/uav-bind.min.js
