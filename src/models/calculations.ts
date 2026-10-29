/** Composition adapter for the existing UI. All substantive calculations live in model modules. */
import type {Home,Insurance,Scenario} from '../types/index.ts';
import {modelConfig,createModelSettings} from '../data/config.ts';
import {hailCategories,type ClaimInputs,type HailCategory,type ModelSettings,type RoofMaterial,type RoofProfile,type VulnerabilityModel} from './domain.ts';
import {roofCosts} from './roofCost.ts';
import {calculateClaim} from './insurance.ts';
import {createIllustrativeVulnerability,validateDamage} from './vulnerability.ts';
import {financialComparison,grantAmount,type FinancialPlan} from './financial.ts';
import {annualToMultiYear,multiYearRisk,poissonProbability,validateHazard} from './risk.ts';
import {finite,integer,oneOf,probability} from './validation.ts';
export const exposureOver=annualToMultiYear;
export function compare(h:Home,i:Insurance,s:Scenario,settings:ModelSettings=createModelSettings(),provider?:VulnerabilityModel){
 if(!h||!i||!s||!settings)throw new TypeError('Home, insurance, scenario and settings are required.');
 oneOf('Roof material',h.material,Object.keys(modelConfig.materialCostFactor));oneOf('Stories',h.stories,['1','2','3','Unknown']);
 if(h.age!==-1)finite('Roof age',h.age,0,200);
 oneOf('Prior damage',h.damage,['Yes','No','Unknown']);oneOf('Roof complexity',h.complexity,Object.keys(modelConfig.complexity));
 oneOf('Settlement basis',i.coverage,['RCV','ACV','I’m not sure']);oneOf('Deductible type',i.deductibleType,['Percentage','Fixed dollars']);oneOf('Roof limitations',i.limitations,['Unknown','None known','Dollar cap','Excluded']);
 integer('Storm severity',s.intensity);finite('Storm severity',s.intensity,0,3);integer('Horizon',s.horizon,1);
 finite('Annual premium',i.premium);probability('Grant eligible cost fraction',settings.grant.eligibleCostFraction);probability('Storm outcome quantile',settings.stormQuantile);
 finite('Conventional premium change',settings.conventionalAnnualPremiumChange,-Number.MAX_VALUE);finite('FORTIFIED premium change',settings.fortifiedAnnualPremiumChange,-Number.MAX_VALUE);
 validateHazard(settings.hazard);
 const costs=roofCosts({floorArea:h.area,stories:h.stories==='Unknown'?modelConfig.unknowns.stories:Number(h.stories),slopeFactor:settings.cost.slopeFactor,complexityFactor:settings.cost.complexityFactor},settings.cost,modelConfig.materialCostFactor[h.material as RoofMaterial]);
 const material=h.material as RoofMaterial;
 const currentProfile:RoofProfile={material,impactRating:settings.impactRating,age:h.age<0?modelConfig.unknowns.age:h.age,previousDamage:h.damage==='Yes',system:'conventional',condition:h.condition};
 const conventionalProfile:RoofProfile={...currentProfile,age:0,previousDamage:false,condition:'Good'};
 const fortifiedProfile:RoofProfile={...conventionalProfile,system:'fortified',impactRating:settings.fortifiedImpactRating};
 const model=provider??createIllustrativeVulnerability(settings.fragility);
 const template:Omit<ClaimInputs,'loss'>={basis:i.coverage==='RCV'||i.coverage==='ACV'?i.coverage:'Unknown',coverage:i.limitations==='Excluded'?'excluded':settings.coverage,approval:settings.approval,approvedFraction:settings.approvedFraction,deductible:{kind:i.deductibleType==='Percentage'?'percentage':'fixed',value:i.deductible,dwellingCoverage:i.dwelling},depreciationFraction:i.depreciation/100,coverageLimit:i.limitations==='Dollar cap'?i.limit:i.dwelling,repairsCompleted:settings.repairsCompleted};
 // Even zero-loss scenarios validate every insurance input.
 calculateClaim({...template,loss:0});
 const grant=grantAmount({...settings.grant,maximum:modelConfig.grantMaximum,eligibleCost:costs.fortified.central*settings.grant.eligibleCostFraction});
 const plans:FinancialPlan[]=[
  {id:'keep',label:'Keep current roof',profile:currentProfile,replacementCost:costs.conventional.central,installationCost:0,grant:0,annualPremium:i.premium,claim:template},
  {id:'conventional',label:'Replace with conventional',profile:conventionalProfile,replacementCost:costs.conventional.central,installationCost:costs.conventional.central,grant:0,annualPremium:Math.max(0,i.premium+settings.conventionalAnnualPremiumChange),claim:{...template,depreciationFraction:modelConfig.newRoofDepreciation}},
  {id:'fortified',label:'Upgrade to FORTIFIED',profile:fortifiedProfile,replacementCost:costs.fortified.central,installationCost:costs.fortified.central,grant,annualPremium:Math.max(0,i.premium+settings.fortifiedAnnualPremiumChange),claim:{...template,depreciationFraction:modelConfig.newRoofDepreciation}},
 ];
 const eventHail:HailCategory=hailCategories[Math.max(0,s.intensity-1)];
 const specifics=plans.map(plan=>{
  const p=validateDamage(model.evaluate({...plan.profile,hail:eventHail}));
  const outcome=s.intensity===0?'none':settings.stormQuantile<p.replacement?'replacement':settings.stormQuantile<p.replacement+p.repair?'repair':'none';
  const loss=plan.replacementCost*(outcome==='replacement'?1:outcome==='repair'?p.repairCostFraction:0);
  return {id:plan.id,outcome,loss,probabilities:p,claim:calculateClaim({...plan.claim,loss})};
 });
 const paidGiven=(plan:FinancialPlan)=>(hail:HailCategory,outcome:'repair'|'replacement')=>{const p=model.evaluate({...plan.profile,hail});const claim=calculateClaim({...plan.claim,loss:plan.replacementCost*(outcome==='repair'?p.repairCostFraction:1),approval:'approved',repairsCompleted:true});return claim.payment>0?settings.claimFilingProbability*settings.claimApprovalProbability:0};
 const risk=plans.map(plan=>({id:plan.id,horizons:modelConfig.horizons.map(years=>multiYearRisk(settings.hazard,plan.profile,model,years,settings.independentEvents,paidGiven(plan)))}));
 const financial=financialComparison(plans,settings.hazard,model,s.horizon,settings.claimFilingProbability,settings.claimApprovalProbability,settings.scheduledReplacementYear);
 return {costs,plans,specifics,risk,financial,model,
 replacement:costs.conventional.central,upgradeCost:costs.fortified.central,grant,upfront:costs.fortified.central-grant,premiumSavings:i.premium-plans[2].annualPremium,
 currentLoss:specifics[0].loss,upgradedLoss:specifics[2].loss,current:specifics[0].claim,upgraded:specifics[2].claim,currentTotal:financial[0].total,upgradedTotal:financial[2].total,
 exposure:(years:number)=>poissonProbability(settings.hazard.reduce((sum,row)=>sum+row.annualRate,0),years),
 };
}
export type Comparison=ReturnType<typeof compare>;
