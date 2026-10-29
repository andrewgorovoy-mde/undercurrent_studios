import type {ClaimInputs,ClaimResult} from './domain.ts';
import {booleanValue,finite,oneOf,probability} from './validation.ts';
export function calculateClaim(input:ClaimInputs):ClaimResult {
 if(!input||!input.deductible)throw new TypeError('Claim and deductible inputs are required.');
 finite('Physical loss',input.loss);probability('Approved fraction',input.approvedFraction);probability('Roof depreciation',input.depreciationFraction);
 finite('Dwelling coverage',input.deductible.dwellingCoverage);finite('Coverage payment limit',input.coverageLimit);
 oneOf('Settlement basis',input.basis,['RCV','ACV','Unknown']);oneOf('Coverage',input.coverage,['covered','excluded','unknown']);oneOf('Approval',input.approval,['approved','denied','pending']);oneOf('Deductible type',input.deductible.kind,['fixed','percentage']);booleanValue('Repairs completed',input.repairsCompleted);
 finite('Deductible',input.deductible.value,0,input.deductible.kind==='percentage'?100:Number.MAX_VALUE);
 const deductible=input.deductible.kind==='percentage'?input.deductible.dwellingCoverage*input.deductible.value/100:input.deductible.value;
 const resolved=input.coverage==='covered'&&input.approval==='approved'&&input.basis!=='Unknown';
 const approvedLoss=resolved?input.loss*input.approvedFraction:0;
 const depreciation=approvedLoss*input.depreciationFraction;
 // Limits cap insurer payments AFTER deductible in this explicit scenario convention.
 const limit=Math.min(input.coverageLimit,input.deductible.dwellingCoverage);
 const initial=Math.min(limit,Math.max(0,approvedLoss-depreciation-deductible));
 const finalPotential=input.basis==='ACV'?initial:Math.min(limit,Math.max(0,approvedLoss-deductible));
 const recoverable=finalPotential-initial;
 const payment=input.basis==='RCV'&&input.repairsCompleted?finalPotential:initial;
 return {approvedLoss,deductible,depreciation,initial,recoverable,finalPotential,payment,outOfPocket:input.loss-payment,unapprovedLoss:input.loss-approvedLoss,status:resolved?'Hypothetical approved coverage':'No payment assumed: coverage, approval or basis unresolved / excluded'};
}
