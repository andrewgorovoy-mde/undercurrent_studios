import {describe,it,expect} from 'vitest';
import {annualToMultiYear,poissonProbability,independentEventProbability,multiYearRisk} from './risk';
import type {RoofProfile,VulnerabilityModel} from './domain';
const profile:RoofProfile={material:'Standard asphalt',impactRating:'Unknown',age:10,previousDamage:false,system:'conventional',condition:'Unknown'};
const provider:VulnerabilityModel={id:'test',quality:'Prototype assumption',source:'test fixture',evaluate:()=>({none:.5,repair:.4,replacement:.1,repairCostFraction:.3})};
describe('hazard and damage probabilities',()=>{
 it('converts annual Bernoulli probability with correct boundaries',()=>{expect(annualToMultiYear(.1,5)).toBeCloseTo(.40951);expect(annualToMultiYear(0,10)).toBe(0);expect(annualToMultiYear(1,0)).toBe(0);expect(annualToMultiYear(1,10)).toBe(1)});
 it('uses a Poisson rate, not a probability, for stationary event counts',()=>expect(poissonProbability(.2,5)).toBeCloseTo(1-Math.exp(-1)));
 it('calculates exposure, damage, paid claim and replacement separately across severities',()=>{const r=multiYearRisk([{hail:'small',annualRate:.1},{hail:'large',annualRate:.2}],profile,provider,5,3,()=>.5);expect(r.exposure).toBeCloseTo(1-Math.exp(-1.5));expect(r.damage).toBeCloseTo(1-Math.exp(-.75));expect(r.insuredClaim).toBeCloseTo(1-Math.exp(-.375));expect(r.replacement).toBeCloseTo(1-Math.exp(-.15));expect(r.givenEventCount.damage).toBeCloseTo(.875)});
 it('handles zero hazard without dividing by zero',()=>{const r=multiYearRisk([{hail:'large',annualRate:0}],profile,provider,10,0,()=>0);expect(r.exposure).toBe(0);expect(r.damage).toBe(0);expect(r.givenEventCount.damage).toBe(0)});
 it('distinguishes exactly N independent storms from the annual hazard model',()=>{expect(independentEventProbability(.5,3)).toBe(.875);expect(independentEventProbability(1,0)).toBe(0);expect(independentEventProbability(1,2)).toBe(1)});
 it.each([-1,1.1,NaN,undefined])('rejects invalid annual probability %s',p=>expect(()=>annualToMultiYear(p as number,5)).toThrow());
 it('rejects invalid counts, negative rates and duplicate severity categories',()=>{expect(()=>independentEventProbability(.2,1.5)).toThrow();expect(()=>poissonProbability(-1,5)).toThrow();expect(()=>multiYearRisk([{hail:'small',annualRate:.1},{hail:'small',annualRate:.2}],profile,provider,5,3,()=>0)).toThrow()});
 it('validates provider results before combining them with occurrence rates',()=>{expect(()=>multiYearRisk([{hail:'large',annualRate:.1}],profile,{...provider,evaluate:()=>({none:1,repair:1,replacement:1,repairCostFraction:.3})},5,2,()=>0)).toThrow()});
});
it('marks a positive count with zero rate mix as unavailable',()=>{expect(multiYearRisk([{hail:'large',annualRate:0}],profile,provider,5,3,()=>0).givenEventCount).toBeNull()});
