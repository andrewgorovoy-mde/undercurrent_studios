import {useId} from 'react';
interface Props {fortified?:boolean;storm?:number;stories?:string;material?:string;damageLevel?:number}
export function House({fortified=false,storm=0,stories='1',material='Standard asphalt',damageLevel=0}:Props){
 const patternId=useId().replace(/:/g,'');
 const floors=stories==='2'?2:stories==='3'?3:1;
 const rise=(floors-1)*30;
 const roofColor=fortified?'#e0e8dc':material==='Metal'?'#dde3e7':material==='Tile'?'#e8dcd0':'#e3e4df';
 const marks=storm===0?0:Math.max(0,Math.min(9,Math.round(damageLevel*9)));
 return <svg viewBox="0 0 480 300" role="img" aria-label={`${fortified?'FORTIFIED':'Current'} ${floors}-story house, ${storm?'illustrative hail':'no storm'}, ${marks?'illustrative roof damage':'no visible damage marks'}`}>
  <defs><pattern id={patternId} width={material==='Metal'?18:32} height="17" patternUnits="userSpaceOnUse"><path d={material==='Metal'?'M9 0V17':'M0 16H32M16 0V16'} fill="none" stroke={fortified?'#83967e':'#9daba9'} strokeWidth=".8"/></pattern></defs>
  {storm>0&&Array.from({length:20},(_,n)=><g key={n} stroke="#9aafb8" fill="#edf2f4"><path d={`M${25+n*22} ${5+(n%3)*9}l-7 12`}/><circle cx={18+n*22} cy={23+(n%3)*9} r={storm+1}/></g>)}
  <g transform="translate(0 23)">
   <path d="M38 262H444" stroke="#bfc3bc"/>
   <path d={`M94 ${147-rise}H385V260H94Z`} fill="#fcfbf7" stroke="#34433d" strokeWidth="1.5"/>
   <g transform={`translate(0 ${-rise})`}>
    <path d="M302 69V46H326V88" fill="#f1eee5" stroke="#34433d" strokeWidth="1.5"/>
    <path d="M76 149L185 69H302L405 149Z" fill={roofColor} stroke="#34433d" strokeWidth="1.5"/>
    <path d="M76 149L185 69H302L405 149Z" fill={`url(#${patternId})`}/>
    <path d="M185 69L260 149" fill="none" stroke="#34433d" strokeWidth="1.5"/>
    {Array.from({length:marks},(_,n)=><path key={n} d={`M${155+n*21} ${111+(n%2)*19}l9 4-4 8`} stroke={fortified?'#8f9b7d':'#a07459'} strokeWidth="2.5" fill="none"/>)}
    {fortified&&<g><circle cx="241" cy="162" r="12" fill="#42654e"/><path d="m235 162 4 5 9-11" stroke="white" fill="none" strokeWidth="2"/></g>}
   </g>
   <path d={`M260 ${149-rise}V260`} stroke="#34433d" strokeWidth="1.5"/>
   {Array.from({length:floors},(_,floor)=><g key={floor} transform={`translate(0 ${-floor*30})`}><path d="M115 178H156V200H115ZM190 178H231V200H190ZM287 178H328V200H287Z" fill="#e9eff0" stroke="#34433d" strokeWidth="1.4"/><path d="M135 178V200M115 189H156M210 178V200M190 189H231M308 178V200M287 189H328" stroke="#75877e"/></g>)}
   <path d="M345 208H371V260H345Z" fill="#dedbce" stroke="#34433d" strokeWidth="1.5"/><circle cx="364" cy="234" r="2" fill="#34433d"/>
   <path d="M56 260v-36m0 14c-35-15-22-48 0-28 22-20 35 13 0 28M421 260v-28m0 9c-28-13-20-39 0-24 20-15 28 11 0 24" fill="#e3e9df" stroke="#83947a"/>
  </g>
 </svg>
}
