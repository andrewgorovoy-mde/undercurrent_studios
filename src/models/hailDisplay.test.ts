import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateHistoryDataset} from './history';
import {historicalExposedYears} from './exposedYears';
import {approximateExposures,resolveHailDisplay,hailHorizonDisplay} from './hailDisplay';
const data=validateHistoryDataset(JSON.parse(readFileSync(new URL('../../public/data/hail-history.json',import.meta.url),'utf8')));
describe('automatic ZIP hail display',()=>{
 it('uses the specified strict .51 fractional rounding',()=>{
  expect(approximateExposures(.51,5)).toBe(3);expect(approximateExposures(.51,10)).toBe(5);
  expect(approximateExposures(.251,10)).toBe(2);expect(approximateExposures(.25101,10)).toBe(3);
  expect(approximateExposures(.25,10)).toBe(2);expect(approximateExposures(0,5)).toBe(0);expect(approximateExposures(1,10)).toBe(10);
  for(const p of [NaN,Infinity,-1,1.1])expect(()=>approximateExposures(p,5)).toThrow();
 });
 it('updates directly from several actual ZIP polygons',()=>{
  const values=[];
  for(const zip of ['73102','73006','73501']){
   const result=resolveHailDisplay(data,'Oklahoma',zip);
   expect(result.area).toBe(data.zctas[zip]);expect(result.countyFallback).toBe(false);
   const p=historicalExposedYears(result.area,1)!.annualProbability;values.push(p);
   for(const n of [5,10] as const)expect(approximateExposures(p,n)).toBe(Math.floor(p*n)+(p*n-Math.floor(p*n)>.51?1:0));
  }
  expect(new Set(values).size).toBe(3);
 });
 it('uses a verified county fallback when a ZIP estimate is unavailable',()=>{
  const result=resolveHailDisplay(data,'Oklahoma','74103');
  expect(result.countyFallback).toBe(true);expect(result.area).toBe(data.counties.Tulsa);
 });
 it('does not guess an unknown ZIP or invent missing results',()=>{
  expect(resolveHailDisplay(data,'Oklahoma','00000').area).toBeNull();
  expect(resolveHailDisplay(null,'Oklahoma','73102').area).toBeNull();
  const missing=structuredClone(data);missing.zctas['74103'].countyAssignments=[];
  expect(historicalExposedYears(resolveHailDisplay(missing,'Oklahoma','74103').area,1)).toBeNull();
  expect(resolveHailDisplay(data,'Oklahoma','').area).toBe(data.counties.Oklahoma);
 });
});

describe('conditional cumulative display',()=>{
 it('matches the 12.6% example dynamically',()=>{
  const annual=hailHorizonDisplay(.126,1),five=hailHorizonDisplay(.126,5),ten=hailHorizonDisplay(.126,10);
  expect(annual.cumulative).toBe(.126);expect(annual.showStorms).toBe(false);
  expect(five.cumulative).toBeCloseTo(.4899930213);expect(five.showStorms).toBe(false);
  expect(ten.cumulative).toBeCloseTo(.7398928817);expect(ten.showStorms).toBe(true);expect(ten.storms).toBe(1);
 });
 it('switches on unrounded probability and keeps annual results as percentages',()=>{
  expect(hailHorizonDisplay(.99,1).showStorms).toBe(false);
  expect(hailHorizonDisplay(0,10).showStorms).toBe(false);
  expect(hailHorizonDisplay(1,10)).toEqual({cumulative:1,showStorms:true,storms:10});
  expect(hailHorizonDisplay(.129,5).showStorms).toBe(false);
  expect(hailHorizonDisplay(.13,5).showStorms).toBe(true);
  expect(hailHorizonDisplay(.51,5).storms).toBe(3);
  expect(hailHorizonDisplay(.51,10).storms).toBe(5);
  for(const p of [NaN,Infinity,-1,1.1])expect(()=>hailHorizonDisplay(p,5)).toThrow();
 });
});
