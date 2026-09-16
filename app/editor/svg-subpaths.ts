// Resolve only relative moveto origins. All remaining curve commands are
// retained verbatim, so removing a hole cannot move a subsequent subpath.
export function absoluteSubpaths(d: string): string[] | null {
  const matches=[...d.matchAll(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)];
  const parts: string[]=[];
  let i=0, command="", x=0,y=0,sx=0,sy=0,begin=-1,head="",rest=0;
  const finish=(end:number)=>{if(begin>=0) parts.push(head+d.slice(rest,end));};
  while(i<matches.length) {
    let commandIndex=-1;
    if(/^[a-z]$/i.test(matches[i][0])) { commandIndex=matches[i].index!; command=matches[i++][0]; }
    const upper=command.toUpperCase(), relative=command!==upper;
    if(upper==="Z") {x=sx;y=sy;command="";continue;}
    const count=upper==="H"||upper==="V"?1:upper==="C"?6:upper==="S"||upper==="Q"?4:upper==="A"?7:["M","L","T"].includes(upper)?2:0;
    if(!count||i+count>matches.length) return null;
    const values=matches.slice(i,i+count).map(v=>Number(v[0]));
    if(values.some(v=>!Number.isFinite(v))) return null;
    const last=matches[i+count-1]; i+=count;
    if(upper==="H") x=values[0]+(relative?x:0);
    else if(upper==="V") y=values[0]+(relative?y:0);
    else {x=values[count-2]+(relative?x:0);y=values[count-1]+(relative?y:0);}
    if(upper==="M") {
      if(commandIndex<0) return null;
      finish(commandIndex);begin=commandIndex; sx=x;sy=y;
      head=relative?`M${x} ${y}`:d.slice(begin,last.index!+last[0].length);
      rest=last.index!+last[0].length; command=relative?"l":"L";
    }
  }
  finish(d.length);return parts.length?parts:null;
}
