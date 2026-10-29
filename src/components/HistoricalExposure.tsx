import {HailIntroduction} from './OpeningIllustrations';
import {hailHorizonDisplay,resolveHailDisplay} from '../models/hailDisplay';
import {historicalExposedYears} from '../models/exposedYears';
import {type HistoryDataset} from '../models/history';
import {percent} from '../utils/format';
const displayProbability=(value:number)=>value>0&&value<.001?'<0.1%':value>=.9995?'>99.9%':percent(value);
interface Props {data:HistoryDataset|null;loading:boolean;error:string|null;county:string;zip:string}
export function HistoricalExposure({data,loading,error,county,zip}:Props){
 const {area,countyFallback}=resolveHailDisplay(data,county,zip);const e=area?.propertyExposure;
 const annual=historicalExposedYears(area,1);
 const primaryCounty=zip&&data?.zctas[zip]?[...data.zctas[zip].countyAssignments].sort((a,b)=>b.areaShare-a.areaShare)[0]?.name:county;
 return <><h2>You might be in for some hail in <span className="county-name">{primaryCounty}</span> County.</h2><HailIntroduction/>{loading?<p>Loading local historical hail records…</p>:error?<p role="status">Historical data unavailable. {error} No zero-risk estimate is assumed.</p>:!area?<p>No historical data are available for {zip?`ZIP/ZCTA ${zip}`:'this location'}. Choose a county instead; no location or zero risk is guessed.</p>:<>
 {countyFallback&&<p className="input-note">County-level estimate for ZIP {zip}.</p>}
 <div className="risk-cards" aria-live="polite">{([1,5,10] as const).map(years=>{const display=annual?hailHorizonDisplay(annual.annualProbability,years):null;return <article key={years}><span>{years} year{years>1?'s':''}</span><strong>{display?(display.showStorms?<>~{display.storms}<small style={{display:'inline',fontSize:'.3em',letterSpacing:0,marginLeft:6}}> {display.storms===1?'storm':'storms'} ({displayProbability(display.cumulative)})</small></>:displayProbability(display.cumulative)):'—'}</strong><small>{display?(display.showStorms?'Chance of at least one storm':'Chance of hail'):'Insufficient data'}</small></article>})}</div>
 <details><summary>How is this calculated?</summary><div className="detail-content">
 <p>Potentially damaging hail means NOAA MRMS-estimated hail <strong>1.5 inches or larger</strong>. This is a modeling proxy, not a guarantee of roof damage, an insurance claim or roof replacement.</p>
 <p>We calculate exposure at fixed geographic locations within the actual {area.kind==='county'?'county':'Oklahoma-clipped ZCTA'} polygon, then average over its area. These are area-weighted estimates, not residentially weighted or address-specific estimates; no verified housing-location layer is used.</p>
 <p>Annual chance of at least one qualifying exposure: <strong>{annual?displayProbability(annual.annualProbability):'unavailable'}</strong>. This annual probability is measured from complete years with exposure at each geographic location, not from a storm-event rate. Multiple storms in the same year count as one exposed year.</p>
 <p>Cumulative chance = 1 − (1 − annual probability)ⁿ, assuming independent years and stationary risk. Below 50% we show that percentage; otherwise we show ~annual probability × years, rounded up only when the fractional part exceeds 0.51, beside the cumulative percentage. The storm count is a simplified estimate of hail-exposed years, not a prediction of distinct storms; multiple storms can occur in one year.</p>
 <p>Longer-horizon estimates are exploratory and assume stationary annual risk. They do not predict actual roof damage or insurance claims. {countyFallback?`ZIP-level numerical data are unavailable, so this display uses ${area.name} County, the verified county with the largest geographic overlap of this ZCTA. It is a county estimate, not a localized ZIP estimate.`:''}</p>
 <p>Hourly and overlapping footprints are merged once per convective day (12:00 UTC to the next 11:59 UTC), using equal-area polygon geometry. Each location retains its own observed annual hit pattern. Complete footprint years are resampled as whole blocks, preserving within-year clustering. We do not convert a county-wide event count into a property probability or spread its average rate uniformly over all homes.</p>
 <p>Source window: {data!.period.start}–{data!.period.end}. Usable complete catalog years: {e?.completeYears.join(', ')||'none'}. Partial 2020 and gapped 2021 are excluded. Missing files are not counted as zero hail, and file availability does not verify radar uptime.</p>
 <p>The short record cannot establish precise future risk. Five- and ten-year values are exploratory and assume stationary, independent future years similar to the observed footprint years. Resampling cannot introduce unseen spatial patterns; locations not hit in this record are not known to have zero future risk. Radar errors, climate change and residential-location differences are not captured.</p>
 {e?.unavailableReason&&<p>Spatial estimate unavailable: {e.unavailableReason}</p>}
 <p>Typical hail size is the most common qualifying NOAA size bin weighted by area exposed on distinct days. The highest modeled bin at each location/day is counted once, rather than using the largest hail anywhere in a county or counting repeated reports. No average size is invented.</p>
 {area.kind==='zcta'&&<p>Census ZCTAs approximate ZIP areas. This ZCTA intersects {area.countyAssignments.map(c=>`${c.name} County`).join(', ')}. Exposure uses the entire Oklahoma-clipped ZCTA directly, not a risk inherited from its largest-overlap county. Tiny overlaps can reflect generalized boundaries.</p>}
 {e&&<p>Recorded qualifying days: {e.qualifyingRecordedDays} in the source window; {e.qualifyingDaysInCompleteYears} in the complete years. Area-weighted exposed days per location/year: {e.annualExposureDaysRate?.toFixed(3)??'unavailable'}. This descriptive day rate is not treated as a Poisson storm-arrival rate.</p>}
 <p>{data!.sources.map((source,index)=><span key={source.url}>{index>0?' · ':''}<a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></span>)}</p>
 </div></details>
 <a className="text-link" href="#home">How would your home fare? ↓</a>
 </>}</>;
}
