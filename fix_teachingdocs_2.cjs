const fs = require('fs');
let code = fs.readFileSync('src/components/teacher/TeachingDocs.tsx', 'utf8');

// The react-dom/server might cause issues if not imported correctly, check if there's any compilation error
// Oh wait, task 203 output isn't received yet.
