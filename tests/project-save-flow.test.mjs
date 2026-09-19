import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {packProjectLayers,projectSaveError} from '../app/editor/project-data.ts';
import {savedProjectDisplayName} from '../app/editor/project-display-name.ts';

const code=readFileSync(new URL('../app/editor/page.tsx',import.meta.url),'utf8');
const start=code.indexOf('  const saveProject = async');
const end=code.indexOf('  autosaveRunner.current =',start);
const compiled=ts.transpileModule(code.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const createSave=new Function('env',`with(env){${compiled};return saveProject;}`);
function setup(result){
 const calls=[],state={};
 const env={session:{user:{id:'user'}},saveLock:{current:false},projectRevision:{current:'version-1'},currentProjectId:'recovery',currentProjectAutosave:true,
 projects:[{id:'recovery',byte_size:100,updated_at:'version-1',is_autosave:true}],projectsStorageBytes:100,PROJECT_LIMIT:20,STORAGE_LIMIT:40*1024*1024,
 saveToastDismissed:{current:false},projectName:'Autosave - date',layers:[{id:'layer',src:'data:image/png;base64,AQID',steps:[]}],pageMode:'portrait',pageSize:'a4',unit:'cm',landscape:false,safeMargin:1,cutSafetyEnabled:false,pageColor:'white',customPageColor:'#ffffff',sessionLog:[],
 uid:()=> 'log',createProjectThumbnail:async()=>'',packLayers:packProjectLayers,projectBytes:data=>new Blob([JSON.stringify(data)]).size,
 projectSignature:()=> 'signature',savedProjectDisplayName,projectSaveError,refreshProjects:async()=>{},
 storeProjectAssets:async()=>{throw new Error('Unexpected file storage in inline test')},cleanProjectFiles:async()=>{},
 supabase:{from:()=>({update:fields=>query('update',fields),insert:fields=>query('insert',fields)})}};
 function query(method,fields){const call={method,fields,filters:{}};calls.push(call);const builder={eq:(key,value)=>{call.filters[key]=value;return builder;},select:()=>builder,single:async()=>typeof result==='function'?result(call):result||{data:{id:fields.id||'recovery',name:fields.name,updated_at:fields.updated_at},error:null}};return builder;}
 for(const key of ['Notice','SaveStatus','AutosaveStatus','SavedCountdown','CurrentProjectId','CurrentProjectAutosave','SessionLog','ProjectName','LastSavedSignature','Projects','ProjectsOpen','SaveAsMode','LastAutosaveAt']) env['set'+key]=value=>{state[key]=typeof value==='function'?value(key==='ProjectName'?env.projectName:key==='Projects'?env.projects:[]):value;};
 return {save:createSave(env),env,calls,state};
}
test('manual naming updates the recovery record, not a second project',async()=>{
 const {save,calls,state,env}=setup();
 assert.equal(await save(false,undefined,'amandaCake',false),true);
 assert.equal(calls.length,1);assert.equal(calls[0].method,'update');
 assert.equal(calls[0].filters.id,'recovery');assert.equal(calls[0].filters.updated_at,'version-1');
 assert.equal(calls[0].fields.is_autosave,false);assert.equal(state.ProjectName,'amandaCake');
 assert.equal(env.saveLock.current,false);
});
test('Save a Copy inserts a different ID and never updates the original',async()=>{
 const {save,calls,state}=setup();assert.equal(await save(true,undefined,'amandaCake Copy',false),true);
 assert.equal(calls[0].method,'insert');assert.notEqual(calls[0].fields.id,'recovery');
 assert.equal(state.ProjectName,'amandaCake Copy');
});
test('concurrent save requests cannot create competing writes',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const {save,calls,env}=setup(async call=>{await pending;return {data:{id:'recovery',name:call.fields.name,updated_at:call.fields.updated_at}};});
 const first=save(false,undefined,'amandaCake',false);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(await save(false,undefined,'other',false),false);assert.equal(calls.length,1);
 release();assert.equal(await first,true);assert.equal(env.saveLock.current,false);
});
test('failed updates preserve identity and release the lock for retry',async()=>{
 const {save,state,env,calls}=setup({error:{message:'no rows returned',code:'PGRST116'}});
 assert.equal(await save(false,undefined,'amandaCake',false),false);
 assert.equal(calls.length,1);assert.equal(state.CurrentProjectId,undefined);
 assert.match(state.Notice,/another tab/);assert.equal(env.saveLock.current,false);
});
test('thumbnail failure is caught before cloud writes',async()=>{
 const {save,env,calls,state}=setup();env.createProjectThumbnail=async()=>{throw new Error('image unavailable');};
 assert.equal(await save(),false);assert.equal(calls.length,0);assert.equal(env.saveLock.current,false);assert.match(state.Notice,/image unavailable/);
});
