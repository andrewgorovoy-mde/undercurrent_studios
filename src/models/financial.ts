import type {ClaimInputs,GrantInputs,HazardCategory,RoofProfile,VulnerabilityModel} from './domain.ts';
import {booleanValue,finite,integer,probability} from './validation.ts';
import {calculateClaim} from './insurance.ts';
import {validateHazard} from './risk.ts';
import {validateDamage} from './vulnerability.ts';
export function grantAmount(input:GrantInputs){if(!input)throw new TypeError('Grant scenario is required.');for(const key of ['eligible','approved','fundingAvailable'] as const)booleanValue(key,input[key]);for(const key of ['requested','maximum','eligibleCost'] as const)finite(key,input[key]);return input.eligible&&input.approved&&input.fundingAvailable?Math.min(input.requested,input.maximum,input.eligibleCost):0}
export interface FinancialPlan {id:'keep'|'conventional'|'fortified';label:string;profile:RoofProfile;replacementCost:number;installationCost:number;grant:number;annualPremium:number;claim:Omit<ClaimInputs,'loss'>}
export function eventEconomics(plan:FinancialPlan,hazard:HazardCategory[],model:VulnerabilityModel,filing:number,approval:number){
 probability('Claim filing probability',filing);probability('Claim approval probability',approval);validateHazard(hazard);
 finite('Replacement cost',plan.replacementCost);finite('Annual premium',plan.annualPremium);
 let annualLoss=0,annualPayment=0,replacementRate=0;
 for(const event of hazard){const p=validateDamage(model.evaluate({...plan.profile,hail:event.hail}));replacementRate+=event.annualRate*p.replacement;
  for(const outcome of ['repair','replacement'] as const){const loss=plan.replacementCost*(outcome==='repair'?p.repairCostFraction:1);const claim=calculateClaim({...plan.claim,loss,approval:'approved',repairsCompleted:true});const weight=event.annualRate*p[outcome];annualLoss+=weight*loss;annualPayment+=weight*claim.payment*filing*approval}
 }
 return {annualLoss,annualPayment,annualOutOfPocket:annualLoss-annualPayment,replacementRate};
}
export function financialComparison(plans:FinancialPlan[],hazard:HazardCategory[],model:VulnerabilityModel,years:number,filing:number,approval:number,scheduledYear:number|null){
 integer('Financial horizon',years,1);if(scheduledYear!==null)integer('Scheduled replacement year',scheduledYear,1);
 const conventional=plans.find(p=>p.id==='conventional');if(!conventional)throw new Error('A conventional replacement plan is required.');
 return plans.map(plan=>{
  finite('Installation cost',plan.installationCost);finite('Grant',plan.grant,0,plan.installationCost);
  const original=eventEconomics(plan,hazard,model,filing,approval);const renewed=eventEconomics(conventional,hazard,model,filing,approval);
  let originalShare=1,stormLoss=0,insurerCompensation=0,premiums=0,scheduledReplacement=0;
  for(let year=1;year<=years;year++){
   if(plan.id==='keep'&&scheduledYear===year){scheduledReplacement+=originalShare*conventional.installationCost;originalShare=0}
   // A full replacement after a storm transitions retained old roofs to the new
   // conventional state. Integrate expected time in each state within each year.
   const oldTime=plan.id==='keep'?originalShare*(original.replacementRate===0?1:-Math.expm1(-original.replacementRate)/original.replacementRate):1;
   const newTime=plan.id==='keep'?1-oldTime:0;
   stormLoss+=oldTime*original.annualLoss+newTime*renewed.annualLoss;
   insurerCompensation+=oldTime*original.annualPayment+newTime*renewed.annualPayment;
   premiums+=oldTime*plan.annualPremium+newTime*conventional.annualPremium;
   if(plan.id==='keep')originalShare*=Math.exp(-original.replacementRate);
  }
  const upfront=plan.installationCost-plan.grant;const expectedStormOutOfPocket=stormLoss-insurerCompensation;
  return {id:plan.id,label:plan.label,years,upfront,grant:plan.grant,premiums,expectedStormLoss:stormLoss,expectedInsurerCompensation:insurerCompensation,expectedStormOutOfPocket,scheduledReplacement,total:upfront+premiums+expectedStormOutOfPocket+scheduledReplacement};
 });
}
