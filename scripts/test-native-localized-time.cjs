const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const box={console,Date};
vm.createContext(box);
vm.runInContext(fs.readFileSync(__dirname+'/apps-script/releases/20261022/native-main.gs','utf8'),box);
const examples=[
  ['上午 12:00','00:00'],['下午 12:00','12:00'],['下午 6:30','18:30'],
  ['上午 9:05','09:05'],['下午 18:00:00','18:00'],['上午9:05:30','09:05'],
  ['上午 13:00',''],['下午 0:30',''],['下午 11:60',''],['下午 11:00:60',''],
  ['18:30','18:30'],['9:05','09:05'],['23:59:00','23:59'],
  ['24:00',''],['9:60',''],['再約',''],['',''],[0,'00:00'],[0.75,'18:00']
];
for(const [input,expected]of examples)assert.equal(box.oa2Time_(input),expected,JSON.stringify(input));
console.log('PASS: '+examples.length+' native localized/numeric time cases preserve the verified live parser.');
