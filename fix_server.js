const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// I need to find the places where I inserted the bad code and remove them.
// Let's identify the bad code blocks.

code = code.replace(/const fullInputDiagnostics = \{[\s\S]*?const record = \{[\s\S]*?    const result: any = \{\n      record,/g, 'const result: any = {');
code = code.replace(/const fullInputDiagnostics = \{[\s\S]*?const customRecord = \{[\s\S]*?      const result: any = \{\n        record: customRecord,\n        success: true,/g, 'const result: any = {\n        success: true,');
code = code.replace(/const fullInputDiagnostics = \{[\s\S]*?const jsonErrorRecord = \{[\s\S]*?      return res\.status\(200\)\.json\(\{\n        record: jsonErrorRecord,\n        success: false,\n        error: "Model returned invalid JSON",/g, 'return res.status(200).json({\n        success: false,\n        error: "Model returned invalid JSON",');

fs.writeFileSync('server.ts', code);
