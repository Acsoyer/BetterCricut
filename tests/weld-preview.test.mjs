import test from 'node:test';
import assert from 'node:assert/strict';
import { weldPixelPlacement, drawWeldReference } from '../app/editor/weld-preview.ts';

test('reference SVG destinations use canvas pixels instead of centimetres', async () => {
  const calls=[];
  const context={canvas:{width:512,height:512},save(){},restore(){},
    scale(){throw Error('Do not magnify centimetre-sized SVG raster destinations');},
    setTransform(...args){calls.push(['matrix',...args]);},
    drawImage(...args){calls.push(['image',...args]);}};
  const layer={x:2,y:4,w:4.6,h:2.8,rotation:0,src:'svg'};
  const area={x:2,y:4,w:4.6,h:4.2};
  await drawWeldReference(context,[layer],area,async()=>({id:'svg'}));
  assert.deepEqual(calls[0].slice(0,5),['matrix',1,0,-0,1]);
  assert.ok(Math.abs(calls[0][5]-256)<1e-10);
  assert.ok(Math.abs(calls[0][6]-2.8/2*512/4.2)<1e-10);
  assert.equal(calls[1][4],512);
  assert.ok(Math.abs(calls[1][5]-2.8*512/4.2)<1e-10);
});

test('rotation and rectangular world bounds map exactly into the comparison grid', () => {
  const area={x:1,y:3,w:10,h:4},layer={x:2,y:4,w:3,h:2,rotation:37};
  const p=weldPixelPlacement(layer,area,512,512);
  const angle=layer.rotation*Math.PI/180;
  for(const [x,y] of [[-1.5,-1],[1.5,-1],[1.5,1],[-1.5,1]]){
    const pixelX=p.a*x*512/area.w+p.c*y*512/area.h+p.x;
    const pixelY=p.b*x*512/area.w+p.d*y*512/area.h+p.y;
    const expectedX=(layer.x+layer.w/2-area.x+x*Math.cos(angle)-y*Math.sin(angle))*512/area.w;
    const expectedY=(layer.y+layer.h/2-area.y+x*Math.sin(angle)+y*Math.cos(angle))*512/area.h;
    assert.ok(Math.abs(pixelX-expectedX)<1e-10);
    assert.ok(Math.abs(pixelY-expectedY)<1e-10);
  }
});
