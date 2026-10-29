import type {AreaHistory} from './history';
export interface ExposedYears {
 annualProbability:number;
 expectedYears:number;
 atLeastTwoYears:number;
 everyYear:number;
 atLeastOneYear:number;
}
/** Binomial annual hit indicators: multiple storms in one year still count as one exposed year. */
export function exposedYears(p:number,n:number):ExposedYears {
 if(typeof p!=='number'||!Number.isFinite(p)||p<0||p>1)throw new RangeError('Annual probability must be between 0 and 1.');
 if(!Number.isSafeInteger(n)||n<1)throw new RangeError('Horizon must be a positive integer.');
 const none=(1-p)**n;
 return {annualProbability:p,expectedYears:n*p,atLeastTwoYears:n===1?0:Math.max(0,Math.min(1,1-none-n*p*(1-p)**(n-1))),everyYear:p**n,atLeastOneYear:1-none};
}
/** Preserve the geographic model: evaluate each fixed location's p before area averaging. */
export function historicalExposedYears(area:AreaHistory|null,n:number):ExposedYears|null {
 if(![1,5,10].includes(n))throw new RangeError('Supported horizons are 1, 5 and 10 years.');
 const e=area?.propertyExposure;
 if(area?.status!=='available'||!e?.probabilities||!e.locationYearPatternAreaFractions||e.completeYears.length<2)return null;
 const weights=e.locationYearPatternAreaFractions;
 if(weights.length!==2**e.completeYears.length||weights.some(w=>!Number.isFinite(w)||w<0)||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-7)return null;
 return weights.reduce<ExposedYears>((result,w,mask)=>{
  const hits=mask.toString(2).replace(/0/g,'').length;
  const point=exposedYears(hits/e.completeYears.length,n);
  for(const key of Object.keys(result) as (keyof ExposedYears)[])result[key]+=w*point[key];
  return result;
 },{annualProbability:0,expectedYears:0,atLeastTwoYears:0,everyYear:0,atLeastOneYear:0});
}
