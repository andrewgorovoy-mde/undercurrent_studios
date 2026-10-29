export const hailCategories = ['small','large','veryLarge'] as const;
export type HailCategory = typeof hailCategories[number];
export type ImpactRating = 'Unknown'|'Unrated'|'Class 1'|'Class 2'|'Class 3'|'Class 4';
export type EstimateRange = {low:number;central:number;high:number};
export type RoofMaterial = 'Standard asphalt'|'Impact-resistant asphalt'|'Metal'|'Tile'|'Other'|'Unknown';
export interface CostAssumptions {
 slopeFactor:number; complexityFactor:number; materials:EstimateRange; labor:EstimateRange;
 fortifiedExtra:EstimateRange; removal:EstimateRange; decking:EstimateRange;
 includeRemoval:boolean; deckingFraction:number;
}
export interface RoofGeometry {floorArea:number;stories:number;slopeFactor:number;complexityFactor:number}
export interface RoofProfile {material:RoofMaterial;impactRating:ImpactRating;age:number;previousDamage:boolean;system:'conventional'|'fortified';condition:string}
export interface FragilityRow {damageProbability:number;replacementGivenDamage:number;repairCostFraction:number}
export interface FragilityAssumptions {
 table:Record<RoofMaterial,Record<HailCategory,FragilityRow>>;
 impactScale:Record<ImpactRating,number>;
 ageBands:{maximumAge:number;scale:number}[];
 previousDamageScale:number;fortifiedScale:number;conditionScale:Record<string,number>;
}
export interface FragilityInput extends RoofProfile {hail:HailCategory;hailDiameterMm?:number}
export interface DamageProbabilities {none:number;repair:number;replacement:number;repairCostFraction:number}
/** A published model can implement this contract without changing risk or finance. */
export interface VulnerabilityModel {
 id:string;quality:'Prototype assumption'|'Published modeled data';source:string;
 evaluate(input:FragilityInput):DamageProbabilities;
}
export interface ClaimInputs {
 loss:number;basis:'RCV'|'ACV'|'Unknown';coverage:'covered'|'excluded'|'unknown';
 approval:'approved'|'denied'|'pending';approvedFraction:number;
 deductible:{kind:'fixed'|'percentage';value:number;dwellingCoverage:number};
 depreciationFraction:number;coverageLimit:number;repairsCompleted:boolean;
}
export interface ClaimResult {
 approvedLoss:number;deductible:number;depreciation:number;initial:number;recoverable:number;
 finalPotential:number;payment:number;outOfPocket:number;unapprovedLoss:number;status:string;
}
export interface HazardCategory {hail:HailCategory;annualRate:number}
export interface GrantInputs {eligible:boolean;approved:boolean;fundingAvailable:boolean;requested:number;maximum:number;eligibleCost:number}
export interface ModelSettings {
 cost:CostAssumptions;fragility:FragilityAssumptions;
 hazard:HazardCategory[];independentEvents:number;
 coverage:ClaimInputs['coverage'];approval:ClaimInputs['approval'];approvedFraction:number;repairsCompleted:boolean;
 claimFilingProbability:number;claimApprovalProbability:number;
 impactRating:ImpactRating;fortifiedImpactRating:ImpactRating;stormQuantile:number;
 grant:{eligible:boolean;approved:boolean;fundingAvailable:boolean;eligibleCostFraction:number;requested:number};
 conventionalAnnualPremiumChange:number;fortifiedAnnualPremiumChange:number;
 scheduledReplacementYear:number|null;
}
