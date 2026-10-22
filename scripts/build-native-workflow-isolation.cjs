const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');

/** Test-only wrapper: all current operational helpers remain lexical. */
function buildStagedWorkflowQa(release='20261022') {
  if(!/^\d{8}$/.test(release))throw Error('Expected a dated native release');
  const root=path.join(__dirname,'apps-script/releases',release);
  const names=['native-main.gs','arrival-workflow.gs','arrival-integrity.gs','workflow-isolated-qa.gs'];
  const files=names.map(name=>({name,source:fs.readFileSync(path.join(root,name),'utf8')}));
  const handler='verifyArrivalWorkflowCandidateIsolated20261022';
  const source=[
    '/** Synthetic workflow Google Sheets QA only. Production handlers remain unchanged. */',
    `function ${handler}() {`,
    '  function oa4RetiredAppointmentIds_() { return new Set(); }',
    ...files.map(file=>`\n/* Current source: ${file.name} */\n${file.source}`),
    '  return verifyArrivalWorkflowIsolated20261022();','}','',
  ].join('\n');
  new vm.Script(source,{filename:'staged-workflow-isolation.gs'});
  return {handler,source,manifest:files.map(file=>({name:file.name,sha256:crypto.createHash('sha256').update(file.source).digest('hex')})),sha256:crypto.createHash('sha256').update(source).digest('hex')};
}
module.exports={buildStagedWorkflowQa};
if(require.main===module){
  const output=process.argv[2];
  if(!output||!path.isAbsolute(output))throw Error('Usage: node scripts/build-native-workflow-isolation.cjs /absolute/staged-workflow-isolation.gs');
  const bundle=buildStagedWorkflowQa();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bundle.source,{mode:0o600});
  console.log(JSON.stringify({path:output,handler:bundle.handler,bytes:Buffer.byteLength(bundle.source),sha256:bundle.sha256,manifest:bundle.manifest},null,2));
}
