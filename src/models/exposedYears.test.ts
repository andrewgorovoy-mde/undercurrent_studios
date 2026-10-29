import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {exposedYears,historicalExposedYears} from './exposedYears';
import {historicalExposure,validateHistoryDataset} from './history';
const data=validateHistoryDataset(JSON.parse(readFileSync(new URL('../../public/data/hail-history.json',import.meta.url),'utf8')));
describe('exposed years under stationary independent annual risk',()=>{
 for(const p of [.05,.2,.5]){
  it(`matches binomial outcomes and horizon ordering at ${p*100}% annual probability`,()=>{
   const results=[1,5,10].map(n=>exposedYears(p,n));
   for(const n of [1,5,10]){
    const r=exposedYears(p,n);
    // Independently enumerate all annual hit/miss sequences, including repeated hits.
    let expected=0,two=0,every=0,once=0;
    for(let mask=0;mask<2**n;mask++){
     const hits=mask.toString(2).replace(/0/g,'').length;
     const mass=p**hits*(1-p)**(n-hits);
     expected+=hits*mass;if(hits>=2)two+=mass;if(hits===n)every+=mass;if(hits>=1)once+=mass;
    }
    expect(r.expectedYears).toBeCloseTo(expected,12);expect(r.atLeastTwoYears).toBeCloseTo(two,12);
    expect(r.everyYear).toBeCloseTo(every,12);expect(r.atLeastOneYear).toBeCloseTo(once,12);
   }
   for(let i=1;i<results.length;i++){
    expect(results[i].expectedYears).toBeGreaterThan(results[i-1].expectedYears);
    expect(results[i].atLeastOneYear).toBeGreaterThan(results[i-1].atLeastOneYear);
    expect(results[i].everyYear).toBeLessThan(results[i-1].everyYear);
    expect(results[i].atLeastTwoYears).toBeGreaterThan(results[i-1].atLeastTwoYears);
   }
   expect(results[0].atLeastTwoYears).toBe(0);
  });
 }
 it('handles zero, certainty, and a one-year horizon without numerical edge errors',()=>{
  expect(exposedYears(0,10)).toEqual({annualProbability:0,expectedYears:0,atLeastTwoYears:0,everyYear:0,atLeastOneYear:0});
  expect(exposedYears(1,1)).toEqual({annualProbability:1,expectedYears:1,atLeastTwoYears:0,everyYear:1,atLeastOneYear:1});
  expect(exposedYears(1,10)).toEqual({annualProbability:1,expectedYears:10,atLeastTwoYears:1,everyYear:1,atLeastOneYear:1});
 });
 it('rejects missing and invalid formula inputs',()=>{
  for(const p of [NaN,Infinity,-.1,1.1,undefined,null])expect(()=>exposedYears(p as number,5)).toThrow();
  for(const n of [NaN,Infinity,-1,0,1.5])expect(()=>exposedYears(.2,n)).toThrow();
 });
 it('preserves fixed-location heterogeneity instead of spreading average risk uniformly',()=>{
  const area=structuredClone(data.counties.Oklahoma);
  area.propertyExposure.locationYearPatternAreaFractions=Array(16).fill(0);
  area.propertyExposure.locationYearPatternAreaFractions![0]=.5;
  area.propertyExposure.locationYearPatternAreaFractions![15]=.5;
  const r=historicalExposedYears(area,5)!;
  expect(r.annualProbability).toBe(.5);expect(r.expectedYears).toBe(2.5);
  expect(r.atLeastOneYear).toBe(.5);expect(r.atLeastTwoYears).toBe(.5);expect(r.everyYear).toBe(.5);
  expect(r.atLeastTwoYears).not.toBe(exposedYears(.5,5).atLeastTwoYears);
 });
 it('retains the existing at-least-once estimates and distinct county results',()=>{
  const names=['Oklahoma','Tulsa','Cleveland','Murray','Texas','Cimarron','Comanche','Garfield','McCurtain','Canadian'];
  const annual=names.map(name=>historicalExposedYears(data.counties[name],1)!.annualProbability);
  expect(new Set(annual.map(p=>p.toFixed(5))).size).toBe(10);
  for(const row of Object.values(data.counties))for(const n of [1,5,10]){
   const r=historicalExposedYears(row,n)!;
   expect(r.atLeastOneYear).toBeCloseTo(historicalExposure(row,n)!.central,12);
   expect(r.expectedYears).toBeCloseTo(n*historicalExposure(row,1)!.central,12);
   expect(r.atLeastTwoYears).toBeLessThanOrEqual(r.atLeastOneYear+1e-12);
  }
 });
 it('never interprets missing geographic support as zero',()=>{
  expect(historicalExposedYears(null,5)).toBeNull();
  expect(historicalExposedYears(data.zctas['74103'],5)).toBeNull();
  const row=structuredClone(data.counties.Oklahoma);row.propertyExposure.locationYearPatternAreaFractions=null;
  expect(historicalExposedYears(row,5)).toBeNull();
  expect(()=>historicalExposedYears(null,2)).toThrow();
 });
});
