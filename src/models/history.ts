import {counties} from '../data/content';
export interface HistoryYear {year:number;status:'complete'|'partial'|'gapped'|'missing';expectedDays:number;coveredDays:number;missingDays:number;recordedExposureDays:number|null}
export interface SpatialExposure {
 thresholdIn:1.5;weighting:'area';locationInterpretation:string;completeYears:number[];
 qualifyingRecordedDays:number;qualifyingDaysInCompleteYears:number;
 meanDailyCoverageFraction:number|null;annualExposureDaysRate:number|null;
 annualHitAreaFractions:number[];locationYearPatternAreaFractions:number[]|null;unavailableReason?:string|null;
 probabilities:Record<'1'|'5'|'10',{central:number;lower95:number;upper95:number;interpretation:string}>|null;
 typicalHailSize:{id:string;label:string;areaExposureDayShare:number}|null;
 sizeAreaExposureDays:number[];model:string;limitations:string;
}
export interface AreaHistory {
 propertyExposure:SpatialExposure;
 id:string;kind:'county'|'zcta';name:string;status:'available'|'unavailable';
 recordedExposureDays:number|null;yearsWithObservedExposure:number|null;
 countyAssignments:{geoid:string;name:string;areaShare:number}[];oklahomaAreaFraction:number;
 sizeCategories:{id:string;label:string;lowerIn:number;upperIn:number|null;exposureDays:number|null;maxDailySeverityDays:number|null}[];
 largestModeledHail:{category:string;lowerIn:number;upperIn:number|null;exactIn:null}|null;
 years:HistoryYear[];
 /** Deprecated county-anywhere rate: forbidden for location probability. */
 annualExposureRate:null;
 secondaryReports?:{reportedCalendarDays:number;distinctReportIds:number;largestReportedIn:number|null}|null;
}
export interface HistoryDataset {
 schemaVersion:2;status:'verified-import'|'manual-import';generatedAt:string;
 period:{start:string;end:string};sources:{name:string;url:string;quality:string}[];
 coverage:{verifiedUtcFiles:number;requestedConvectiveDays:number;coveredConvectiveDays:number;missingConvectiveDates:string[];failedFiles:unknown[];radarUptimeVerified:boolean};
 method:{spatial:string;timeUnit:string;severityThresholdIn:number;denominator:string;missing:string;uncertainty:string;zcta:string};
 provenance:{sourceManifestSha256:string;rawFeatureCount:number;positiveAreaIntersections:number;repairedPolygonCount:number;pythonVersion:string};
 counties:Record<string,AreaHistory>;zctas:Record<string,AreaHistory>;
}
const nonnegative=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const count=(value:unknown)=>nonnegative(value)&&Number.isInteger(value);
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
/** Reject stale/invalid artifacts rather than displaying fabricated zeros. */
export function validateHistoryDataset(value:unknown):HistoryDataset {
 if(!record(value)||value.schemaVersion!==2||!['verified-import','manual-import'].includes(value.status as string)||!record(value.counties)||!record(value.zctas)||!record(value.period)||!record(value.coverage)||!Array.isArray(value.sources)||!record(value.method))throw new Error('Historical data schema is unavailable or unsupported.');
 if(counties.some(name=>!record((value.counties as Record<string,unknown>)[name]))||Object.keys(value.counties).length!==77)throw new Error('Historical data must include all 77 Oklahoma counties.');
 for(const row of [...Object.values(value.counties),...Object.values(value.zctas)]){
  if(!record(row)||!['county','zcta'].includes(row.kind as string)||typeof row.id!=='string'||!/^\d{5}$/.test(row.id)||!['available','unavailable'].includes(row.status as string)||!Array.isArray(row.years)||!Array.isArray(row.sizeCategories)||row.sizeCategories.length!==7||!Array.isArray(row.countyAssignments)||!nonnegative(row.oklahomaAreaFraction)||Number(row.oklahomaAreaFraction)>1)throw new Error('Historical location record is invalid.');
  if(![row.recordedExposureDays,row.yearsWithObservedExposure].every(n=>n===null||count(n)))throw new Error('Invalid historical counts.');
  if(row.status==='unavailable'&&(row.recordedExposureDays!==null||row.annualExposureRate!==null))throw new Error('Missing history cannot be treated as zero risk.');
  for(const item of row.years){if(!record(item)||!['complete','partial','gapped','missing'].includes(item.status as string)||!count(item.year)||!count(item.expectedDays)||!count(item.coveredDays)||!count(item.missingDays)||Number(item.coveredDays)+Number(item.missingDays)!==item.expectedDays||Number(item.expectedDays)>366)throw new Error('Invalid historical coverage denominator.');}
  if(row.annualExposureRate!==null)throw new Error('County-anywhere rate must not drive location exposure.');
  const e=row.propertyExposure;
  if(!record(e)||e.thresholdIn!==1.5||e.weighting!=='area'||!Array.isArray(e.completeYears)||(e.locationYearPatternAreaFractions!==null&&!Array.isArray(e.locationYearPatternAreaFractions))||!Array.isArray(e.annualHitAreaFractions)||!Array.isArray(e.sizeAreaExposureDays)||e.sizeAreaExposureDays.length!==7||!count(e.qualifyingRecordedDays)||!count(e.qualifyingDaysInCompleteYears))throw new Error('Missing spatial hail coverage model.');
  const full=row.years.filter(y=>record(y)&&y.status==='complete').map(y=>(y as Record<string,unknown>).year);
  const weights=e.locationYearPatternAreaFractions as unknown[]|null;
  if(JSON.stringify(e.completeYears)!==JSON.stringify(full)||(weights!==null&&(weights.length!==2**full.length||weights.some(w=>!nonnegative(w)||Number(w)>1.000001)||Math.abs(weights.reduce<number>((sum,w)=>sum+Number(w),0)-1)>1e-7)))throw new Error('Invalid fixed-location spatial coverage partition.');
  if(e.sizeAreaExposureDays[0]!==0||e.sizeAreaExposureDays[1]!==0)throw new Error('Hail below 1.5 inches entered qualifying exposure.');
  if(e.probabilities!==null){
   if(!weights||full.length<2||e.qualifyingDaysInCompleteYears===0||!record(e.probabilities))throw new Error('Insufficient observations for numerical hail exposure.');
   let previous=0;
   for(const horizon of [1,5,10]){
    const p=e.probabilities[String(horizon)];
    if(!record(p)||![p.central,p.lower95,p.upper95].every(nonnegative)||Number(p.central)>1.000001||Number(p.lower95)>Number(p.central)||Number(p.central)>Number(p.upper95)||Number(p.central)<previous)throw new Error('Invalid hail exposure projection.');
    const expected=weights.reduce<number>((sum,w,mask)=>{const countBits=mask.toString(2).replace(/0/g,'').length;return sum+Number(w)*(1-(1-countBits/full.length)**horizon)},0);
    if(Math.abs(Number(p.central)-expected)>1e-7)throw new Error('Hail projection uses the wrong spatial metric.');
    previous=Number(p.central);
   }
  }
  for(const bin of row.sizeCategories)if(!record(bin)||typeof bin.label!=='string'||![bin.exposureDays,bin.maxDailySeverityDays].every(n=>n===null||count(n)))throw new Error('Invalid historical hail-size counts.');
  if(row.recordedExposureDays!==null&&row.sizeCategories.reduce((sum,bin)=>sum+Number((bin as Record<string,unknown>).maxDailySeverityDays),0)!==row.recordedExposureDays)throw new Error('Historical category days are not a partition.');
 }
 return value as unknown as HistoryDataset;
}
export function resolveHistory(data:HistoryDataset|null,county:string,zip:string):AreaHistory|null {
 if(!data)return null;
 if(zip)return /^\d{5}$/.test(zip)?data.zctas[zip]??null:null;
 return data.counties[county]??null;
}
export function historicalExposure(area:AreaHistory|null,years:number){
 if(![1,5,10].includes(years))throw new RangeError('Supported exposure horizons are 1, 5 and 10 years.');
 if(!area||area.status!=='available'||!area.propertyExposure?.probabilities)return null;
 return area.propertyExposure.probabilities[String(years) as '1'|'5'|'10'];
}
