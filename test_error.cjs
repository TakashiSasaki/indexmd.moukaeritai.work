const gemini = require('./src/lib/gemini');
let e = new TypeError("fetch failed");
e.cause = { code: 'ECONNRESET', syscall: 'read' };
console.log(gemini.extractProviderErrorDetails(e));
