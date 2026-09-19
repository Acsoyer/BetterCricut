import test from 'node:test';
import assert from 'node:assert/strict';
import {imageBlob,storeProjectAssets,loadProjectAssets,cleanProjectFiles} from '../app/editor/project-files.ts';

test('binary storage removes Base64 and percent-encoding overhead',async()=>{
 assert.equal((await imageBlob('data:image/png;base64,AQID')).size,3);
 assert.equal(await (await imageBlob('data:image/svg+xml,%3Csvg%2F%3E')).text(),'<svg/>');
 await assert.rejects(()=>imageBlob('https://example.com/image.png'),/Unsupported/);
});
test('unchanged assets upload only once; manifest includes binary byte count',async()=>{
 const files=new Map(); let uploads=0;
 const storage={list:async(folder,{search})=>({data:[...files.keys()].filter(path=>path.startsWith(folder+'/')&&path.endsWith(search)).map(path=>({name:path.split('/').at(-1)}))}),upload:async(path,blob)=>{uploads++;files.set(path,blob);return {error:null};}};
 const client={from:()=>({upsert:async()=>({error:null})}),storage:{from:()=>storage}},assets={a:'data:image/png;base64,AQID'};
 const first=await storeProjectAssets(client,'user','project',assets);
 const second=await storeProjectAssets(client,'user','project',assets);
 assert.equal(uploads,1); assert.equal(first.bytes,3); assert.deepEqual(first,second);
 assert.match(first.assets.a,/^storage:\/\/user\/project\/[a-f0-9]{64}$/);
 assert.deepEqual(await loadProjectAssets(client,'user',first.assets),assets);
});
test('cross-user paths and missing cloud files do not become blank images',async()=>{
 const client={storage:{from:()=>({download:async()=>({error:{message:'missing'}})})}};
 await assert.rejects(()=>loadProjectAssets(client,'user',{a:'storage://other/project/file'}),/Invalid/);
 await assert.rejects(()=>loadProjectAssets(client,'user',{a:'storage://user/project/missing'}),/could not be loaded/);
});
test('cleanup leaves recently uploaded files alone',async()=>{
 const removed=[];
 const client={from:()=>({select:()=>({eq:async()=>({data:[]})})}),storage:{from:()=>({list:async()=>({data:[{id:'1',name:'new',created_at:new Date().toISOString()},{id:'2',name:'old',created_at:new Date(Date.now()-2*86400000).toISOString()}]}),remove:async paths=>{removed.push(...paths);return {error:null};}})}};
 await cleanProjectFiles(client,'user','project');
 assert.deepEqual(removed,['user/project/old']);
});
test('over quota assets are rejected before uploads or claims',async()=>{
 const client={from:()=>{throw new Error('No claims expected')},storage:{from:()=>{throw new Error('No upload expected')}}};
 await assert.rejects(()=>storeProjectAssets(client,'user','project',{a:'data:image/png;base64,AQID'},2),/No image files were uploaded/);
});
test('cleanup preserves referenced files even after the grace period',async()=>{
 const removed=[];
 const client={from:()=>({select:()=>({eq:async()=>({data:[{assets:{a:'storage://user/project/live'}}]})})}),storage:{from:()=>({list:async()=>({data:[{id:'1',name:'live',created_at:new Date(Date.now()-2*86400000).toISOString()}]}),remove:async paths=>{removed.push(...paths);return {error:null};}})}};
 await cleanProjectFiles(client,'user','project');assert.deepEqual(removed,[]);
});
