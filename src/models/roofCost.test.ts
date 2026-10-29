import {describe,it,expect} from 'vitest';
import {roofArea,roofCosts} from './roofCost';
import {createModelSettings} from '../data/config';
const geometry={floorArea:2400,stories:2,slopeFactor:1.2,complexityFactor:1.1};
describe('roof size and cost',()=>{
 it('uses footprint, slope and complexity rather than total interior area',()=>expect(roofArea(geometry)).toBeCloseTo(1584));
 it('computes ordered low / central / high conventional and fortified estimates',()=>{const cost=createModelSettings().cost;const r=roofCosts(geometry,cost);expect(r.conventional.central).toBeCloseTo(1584*8);expect(r.fortified.central).toBeCloseTo(1584*9.5);expect(r.conventional.low).toBeLessThan(r.conventional.central);expect(r.fortified.high).toBeGreaterThan(r.fortified.central)});
 it('charges optional removal and decking only on the specified area',()=>{const cost=createModelSettings().cost;const r=roofCosts(geometry,{...cost,includeRemoval:false,deckingFraction:.25});expect(r.conventional.central).toBeCloseTo(1584*(4+3+3*.25))});
 it('applies material factors only to materials',()=>{const cost=createModelSettings().cost;expect(roofCosts(geometry,cost,2).conventional.central).toBeCloseTo(1584*(8+3+1))});
 it.each([{floorArea:0},{floorArea:NaN},{stories:0},{stories:undefined},{slopeFactor:.9},{complexityFactor:-1}])('rejects invalid geometry %o',patch=>expect(()=>roofArea({...geometry,...patch} as typeof geometry)).toThrow());
 it('rejects missing and reversed cost ranges',()=>{const cost=createModelSettings().cost;expect(()=>roofCosts(geometry,{...cost,materials:{low:10,central:4,high:5}})).toThrow();expect(()=>roofCosts(geometry,{...cost,labor:undefined!})).toThrow();expect(()=>roofCosts(geometry,{...cost,deckingFraction:2})).toThrow()});
});
it('rejects incomplete range objects rather than returning NaN',()=>{const cost=createModelSettings().cost;expect(()=>roofCosts(geometry,{...cost,materials:{central:4,high:5} as typeof cost.materials})).toThrow();expect(()=>roofArea({...geometry,stories:1.5})).toThrow()});
