#!/bin/bash
cd /Users/bkowalk/Library/Hopper/flight-deals
git pull >> /Users/bkowalk/Library/Hopper/hopper.log 2>&1
/usr/local/bin/node /Users/bkowalk/Library/Hopper/flight-deals/hopper.js >> /Users/bkowalk/Library/Hopper/hopper.log 2>&1
