const fs = require('fs');
let code = fs.readFileSync('src/components/teacher/ModulAjarGenerator.tsx', 'utf8');

// We will do a full rewrite of ModulAjarGenerator based on the structure of PromesGenerator, 
// because there are many fields to change.

