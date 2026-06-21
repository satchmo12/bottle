#!/bin/bash
cd /Users/captain/Documents/TestWorkSpace/bottle/fronted
npm run dev
# ngrok http 5173
cd ../telegram-bot
npm run start
cd ../bottle-api
wrangler deploy