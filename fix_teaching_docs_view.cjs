const fs = require('fs');
let code = fs.readFileSync('src/components/teacher/TeachingDocs.tsx', 'utf8');

code = code.replace(
  'onClick={() => doc.type === \'MODUL_AJAR\' ? setIsEditingDeepModule(true) : setViewingDoc(doc)}',
  'onClick={() => setViewingDoc(doc)}'
);

fs.writeFileSync('src/components/teacher/TeachingDocs.tsx', code);
