#!/usr/bin/env node
"use strict";
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'islamic_school', '.env') });
const { spawn } = require('child_process');
const appPath = path.join(__dirname, 'islamic_school/server.js');
const child = spawn('node', [appPath], {
  stdio: 'inherit',
  cwd: path.join(__dirname, 'islamic_school'),
  env: process.env
});
child.on('error', (err) => console.error('App error:', err));

