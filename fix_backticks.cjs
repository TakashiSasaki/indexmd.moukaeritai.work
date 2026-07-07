const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/\\\`/g, '\`');
  fs.writeFileSync(file, code);
}

fix('src/lib/visualAnalysis/serverJobs/jobStore.ts');
fix('server_jobs.ts');
fix('server.ts');
