import type {FragilityAssumptions, HailCategory, ModelSettings, RoofMaterial} from '../models/domain';
const grantMaximum=10_000;
const annualPremiumSavings=749;
// All numbers below are editable prototype assumptions unless a source is stated.
// They are not Oklahoma quotes, hazard estimates or engineering research coefficients.
const rows=(damage:number[],replacement:number[],repair:number[])=>Object.fromEntries(
 (['small','large','veryLarge'] as HailCategory[]).map((hail,n)=>[hail,{damageProbability:damage[n],replacementGivenDamage:replacement[n],repairCostFraction:repair[n]}])
) as FragilityAssumptions['table'][RoofMaterial];
export const modelConfig = {
 horizons:[1,5,10],
 defaults:{home:{county:'Choose a county',zip:'',area:2000,stories:'1',age:12,material:'Standard asphalt',complexity:'Moderate',damage:'No',condition:'Unknown'},insurance:{coverage:'RCV',deductibleType:'Percentage',deductible:2,dwelling:300000,depreciation:35,premium:3000,limitations:'Unknown',limit:15000},scenario:{intensity:2,horizon:5}},
 unknowns:{age:12,stories:1,previousDamage:false},
 complexity:{Simple:1,Moderate:1.15,Complex:1.35,Unknown:1.15} as Record<string,number>,
 materialCostFactor:{'Standard asphalt':1,'Impact-resistant asphalt':1.3,Metal:1.8,Tile:2.3,Other:1.3,Unknown:1.2} as Record<RoofMaterial,number>,
 newRoofDepreciation:0,
 fixedDeductibleDefault:2500,
 grantMaximum,
 annualPremiumSavings,
 grantSource:'https://www.oid.ok.gov/okready/',
 savingsSource:'https://www.oid.ok.gov/release_120825-1/',
 insuranceSource:'https://www.oid.ok.gov/wp-content/uploads/2024/04/publication-post-disaster-claims-guide-1.pdf',
 futureFragilitySource:'https://media.cocorahs.org/docs/Journal_Disaster_Risk_Reduction_2024_CoCoRaHS_Hail.pdf',
 // OID reported "around $750" in December 2025. Exact $749 remains a prototype choice.
 settings:{
  cost:{slopeFactor:1.2,complexityFactor:1.15,materials:{low:3,central:4,high:5},labor:{low:2,central:3,high:4},fortifiedExtra:{low:1,central:1.5,high:2.5},removal:{low:.5,central:1,high:1.5},decking:{low:2,central:3,high:4},includeRemoval:true,deckingFraction:0},
  fragility:{table:{
   'Standard asphalt':rows([.12,.4,.75],[.05,.25,.6],[.1,.3,.5]),
   'Impact-resistant asphalt':rows([.08,.28,.6],[.03,.2,.5],[.08,.25,.45]),
   Metal:rows([.1,.3,.65],[.04,.2,.5],[.12,.3,.45]),
   Tile:rows([.1,.35,.7],[.04,.22,.55],[.1,.3,.5]),
   Other:rows([.12,.4,.75],[.05,.25,.6],[.1,.3,.5]),
   Unknown:rows([.12,.4,.75],[.05,.25,.6],[.1,.3,.5]),
  },impactScale:{Unknown:1,Unrated:1,'Class 1':.95,'Class 2':.9,'Class 3':.8,'Class 4':.7},ageBands:[{maximumAge:5,scale:.8},{maximumAge:15,scale:1},{maximumAge:200,scale:1.2}],previousDamageScale:1.15,fortifiedScale:.65,conditionScale:{Good:.95,Fair:1,Poor:1.1,Unknown:1}},
  hazard:[{hail:'small',annualRate:.12},{hail:'large',annualRate:.04},{hail:'veryLarge',annualRate:.01}],independentEvents:3,
  coverage:'unknown',approval:'pending',approvedFraction:.8,repairsCompleted:false,
  claimFilingProbability:.9,claimApprovalProbability:.8,
  impactRating:'Unknown',fortifiedImpactRating:'Class 4',stormQuantile:.15,
  grant:{eligible:false,approved:false,fundingAvailable:false,eligibleCostFraction:1,requested:grantMaximum},
  conventionalAnnualPremiumChange:0,fortifiedAnnualPremiumChange:-annualPremiumSavings,
  scheduledReplacementYear:null,
 } satisfies ModelSettings,
};
export const comparisonAssumptions=modelConfig;
export const createModelSettings=():ModelSettings=>structuredClone(modelConfig.settings);
