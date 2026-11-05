import { readFile,writeFile } from 'node:fs/promises';
const reports={};
for(const [name,file]of [['chromium','browser-results.json'],['compatibility','compatibility-results.json']]) {
  const report=JSON.parse(await readFile(`docs/verification/fidelity/${file}`,'utf8'));
  const attachments=[];
  const walk=suite=>{
    for(const spec of suite.specs??[])for(const test of spec.tests??[])for(const result of test.results??[])for(const a of result.attachments??[])
      if(a.contentType==='application/json'&&a.body)attachments.push({test:spec.title,project:test.projectName,name:a.name,result:JSON.parse(Buffer.from(a.body,'base64').toString('utf8'))});
    for(const child of suite.suites??[])walk(child);
  };
  report.suites.forEach(walk); reports[name]={stats:report.stats,attachments};
}
await writeFile('docs/verification/fidelity/validation-metrics.json',JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
