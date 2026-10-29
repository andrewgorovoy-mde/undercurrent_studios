import {resolveHistory,type HistoryDataset} from './history';
import {historicalExposedYears} from './exposedYears';
/** User-requested rounding: fractional part strictly above .51 rounds up. */
export function approximateExposures(p:number,years:5|10):number {
 if(!Number.isFinite(p)||p<0||p>1||![5,10].includes(years))throw new RangeError('Invalid annual probability or horizon.');
 const expected=p*years,whole=Math.floor(expected);
 return whole+(expected-whole>.51+Number.EPSILON*10?1:0);
}
export function resolveHailDisplay(data:HistoryDataset|null,county:string,zip:string){
 const local=resolveHistory(data,county,zip);
 if(historicalExposedYears(local,1))return {area:local,countyFallback:false};
 // Only a verified polygon assignment may select a fallback, never an unrelated county or ZIP guess.
 if(zip&&local&&data){
  const assignment=[...local.countyAssignments].filter(c=>Number.isFinite(c.areaShare)&&c.areaShare>0).sort((a,b)=>b.areaShare-a.areaShare)[0];
  const fallback=assignment?data.counties[assignment.name]:null;
  if(fallback&&historicalExposedYears(fallback,1))return {area:fallback,countyFallback:true};
 }
 return {area:local,countyFallback:false};
}

/** Presentation-only cumulative approximation from the existing annual probability. */
export function hailHorizonDisplay(p:number,years:1|5|10){
 if(!Number.isFinite(p)||p<0||p>1||![1,5,10].includes(years))throw new RangeError('Invalid annual probability or horizon.');
 const cumulative=years===1?p:1-(1-p)**years;
 const showStorms=years!==1&&cumulative>=.5;
 return {cumulative,showStorms,storms:showStorms?approximateExposures(p,years as 5|10):null};
}
