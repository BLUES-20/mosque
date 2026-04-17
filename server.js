#!/usr/bin/env node
"use strict";
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'islamic_school', '.env') });
const app = require('./islamic_school/server');
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Mosque School Management live on port ${port}`);
});
