import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve('dist'),html=await readFile(resolve(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate HTML element IDs.');
const files=(await readdir(root)).filter(p=>p.endsWith('.mjs'));
for(const file of files){
  const path=resolve(root,file),source=await readFile(path,'utf8');
  for(const match of source.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(match[1]))throw new Error(file+' references a missing element: '+match[1]);
  for(const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))await readFile(resolve(dirname(path),match[1].split('?')[0]));
}
for(const match of html.matchAll(/(?:src|href)="((?:app\.mjs|style\.css)[^"]*)"/g))await readFile(resolve(root,match[1].split('?')[0]));
console.log('Static integrity checked: '+ids.length+' unique elements, '+files.length+' modules and local imports.');
