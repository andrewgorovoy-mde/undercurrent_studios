import type {CostAssumptions,EstimateRange,RoofGeometry} from './domain.ts';
import {finite,integer,booleanValue} from './validation.ts';
export function roofArea(input:RoofGeometry){
 if(!input)throw new TypeError('Roof geometry is required.');
 finite('Floor area',input.floorArea,1);integer('Stories',input.stories,1);finite('Stories',input.stories,1,10);
 finite('Slope factor',input.slopeFactor,1,3);finite('Complexity factor',input.complexityFactor,1,3);
 return finite('Estimated roof area',input.floorArea/input.stories*input.slopeFactor*input.complexityFactor,1);
}
export function validateRange(name:string,range:EstimateRange){if(!range)throw new TypeError(`${name} range is required.`);for(const key of ['low','central','high'] as const)finite(`${name} ${key}`,range[key]);if(range.low>range.central||range.central>range.high)throw new RangeError(`${name}: use low ≤ central ≤ high.`)}
export function roofCosts(geometry:RoofGeometry,cost:CostAssumptions,materialFactor=1){
 if(!cost)throw new TypeError('Cost assumptions are required.');booleanValue('Include removal',cost.includeRemoval);
 const area=roofArea(geometry);finite('Material cost factor',materialFactor,0.01);finite('Decking fraction',cost.deckingFraction,0,1);
 for(const key of ['materials','labor','fortifiedExtra','removal','decking'] as const)validateRange(key,cost[key]);
 const conventional={} as EstimateRange;const fortified={} as EstimateRange;
 for(const key of ['low','central','high'] as const){conventional[key]=area*(cost.materials[key]*materialFactor+cost.labor[key]+(cost.includeRemoval?cost.removal[key]:0)+cost.decking[key]*cost.deckingFraction);fortified[key]=conventional[key]+area*cost.fortifiedExtra[key]}
 for(const value of [...Object.values(conventional),...Object.values(fortified)])finite('Estimated replacement cost',value);
 return {area,conventional,fortified};
}
