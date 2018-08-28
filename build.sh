#!/bin/bash

rollup src/index.js -o dist/uav.js -f iife

./node_modules/.bin/babel dist/uav.js --out-file dist/uav.js

uglifyjs dist/uav.js --compress --mangle --output dist/uav.min.js

npm run test -- --single-run --browsers=ChromeHeadless
