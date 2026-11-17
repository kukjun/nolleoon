interface Random {nextInt(upperExclusive:number):number}
function shuffled(ids:string[],random:Random):string[]{
 if(ids.length<2||new Set(ids).size!==ids.length)throw new Error('Invalid participants');
 const result=[...ids];
 for(let i=result.length-1;i>0;i--){const j=random.nextInt(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new Error('Invalid random index');[result[i],result[j]]=[result[j]!,result[i]!];}
 return result;
}
export function balancedTeams(ids:string[],count:number,random:Random):{memberId:string;team:number}[]{
 if(!Number.isInteger(count)||count<2||count>ids.length)throw new Error('Invalid team count');
 return shuffled(ids,random).map((memberId,index)=>({memberId,team:index%count+1}));
}
export function allocateLots(ids:string[],winners:number,random:Random):{memberId:string;winning:boolean}[]{
 if(!Number.isInteger(winners)||winners<1||winners>ids.length)throw new Error('Invalid winner count');
 return shuffled(ids,random).map((memberId,index)=>({memberId,winning:index<winners}));
}
