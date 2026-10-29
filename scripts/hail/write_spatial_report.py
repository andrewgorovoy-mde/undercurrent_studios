import argparse,csv,json
from pathlib import Path

def write_report(report,markdown,csv_path):
    g=report['geographicAudit']
    lines=['# Hail spatial audit and correction','',
      '## Root cause','',
      'The original calculation correctly counted a day when at least one ≥0.5-inch footprint intersected any part of a county, but then used that county-anywhere day rate in `1 − exp(−rate × years)`. This answers a regional-anywhere question, not exposure at a fixed geographic location. Large regional rates saturate at nearly 100%, hiding actual differences. No statewide-to-every-county broadcasting error was found.','',
      'The revised model includes only ≥1.5-inch modeled hail. Within each convective day it unions overlapping hourly footprints, then measures covered area. Annual unions preserve locations hit repeatedly. Exact polygon partitions retain each location’s observed annual hit pattern before projections are area-averaged. No housing-location weights have been verified, so these are area-weighted estimates, not estimates for a typical residence.','',
      '## Geographic audit','',
      f"- {g['rawFeatures']:,} original features re-read and checksum-verified.",
      '- Census source CRS verified from PRJ files: NAD83 / EPSG:4269. NOAA GeoJSON: WGS84 / EPSG:4326. Areas measured in CONUS Albers equal area / EPSG:5070.',
      f"- {g['bboxCandidates']:,} county bbox candidates; {g['bboxOnlyRejected']:,} rejected for lack of actual geographic overlap.",
      f"- {g['positiveAreaIntersections']:,} positive-area county intersections; {g['boundaryOnlyRejected']} boundary-only candidates counted as exposure.",
      f"- Invalid geometries: {g['invalidCountyGeometries']} counties, {g['invalidHailGeometries']} hail polygons; failed source files: {len(g['invalidFiles'])}.",
      f"- County day-count mismatches versus the prior independent geographic method: {len(g['oldDayCountMismatches'])} across all 77 counties.",
      f"- {g['distinctCountyCountTotals']} different recorded-day totals across the 77 counties; the source counts were not identical.",'',
      'Seven tiny cross-state ZCTA fragments required topology repair after projection. All seven have numerical estimates withheld pending boundary verification; ZCTA 79034 also fails area-partition tolerance. No county was affected. Repairs and before/after areas are recorded in the audit metadata.','',
      '## Ten-county debugging results','',
      'Historical days cover the requested October 2020–December 2025 window; qualifying-day coverage, rates and projections use complete catalog years 2022–2025 only. Partial 2020 and gapped 2021 remain excluded. “Event” here means a distinct convective exposure day, not a report or independent physical storm.','',
      '| County | All ≥0.5″ days | ≥1.5″ days, full window | ≥1.5″ days, complete years | Mean covered area per qualifying day | Exposure days/location/year | 1 year | 5 years* | 10 years* |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    records=[]
    for row in report['rows']:
        probs=[100*row['probabilities'][str(y)]['central'] for y in [1,5,10]]
        lines.append(f"| {row['county']} | {row['recordedHailDays05In']} | {row['recordedHailDays15In']} | {row['qualifyingDaysCompleteYears']} | {row['meanCoveragePerQualifyingDayPercent']:.2f}% | {row['areaWeightedExposureDaysPerYear']:.3f} | {probs[0]:.1f}% | {probs[1]:.1f}% | {probs[2]:.1f}% |")
        records.append({'county':row['county'],'recorded_days_05_inches':row['recordedHailDays05In'],'recorded_days_15_inches':row['recordedHailDays15In'],'qualifying_days_complete_years':row['qualifyingDaysCompleteYears'],'mean_day_coverage_percent':row['meanCoveragePerQualifyingDayPercent'],'exposure_days_per_location_year':row['areaWeightedExposureDaysPerYear'],'p1':probs[0]/100,'p5_exploratory':probs[1]/100,'p10_exploratory':probs[2]/100,'typical_modeled_bin':row['typicalHailSize']['label'] if row['typicalHailSize'] else None})
    lines+=['','*All projections are conditional exploratory estimates, particularly 5/10 years. They are not validated property, damage, claim or replacement forecasts.*','',
      '## Statistical method and limitations','',
      'For a fixed geographic location x, count distinct qualifying exposure days and the number of complete years in which at least one qualifying footprint reached x. Let p(x) be the observed fraction of complete years with such exposure. The exploratory T-year projection is `1 − (1 − p(x))^T`, evaluated at each location before area integration. This is not `1 − (1 − average(p))^T` and is not a Poisson conversion of county-wide day counts. Exact intersections of the four annual footprint unions provide the spatial partition; no arbitrary grid resolution or scaling factor is used.','',
      'Whole-calendar-year resampling retains within-year storm clusters, overlap and seasonality. It assumes the observed annual footprint fields can represent independent stationary future years. With only four complete years that assumption is weak and unvalidated. In particular, resampling cannot introduce new spatial patterns outside the observed footprint support, so longer-horizon estimates can be biased downward. Areas not hit in this short record are not known to have zero future risk. Bootstrap ranges describe resampling sensitivity, not comprehensive 95% forecast confidence. These limitations are retained in the data and methodology disclosure.','',
      'The exposure-days/location/year column is `sum of daily union area / region area / complete years`. It is a descriptive expected count of distinct exposed days, not a physical storm-arrival intensity; it is not mechanically fed to a Poisson model.','',
      'Typical hail size is the modal NOAA bin by geographic area × distinct exposed days, among qualifying exposures. At each location/day the largest modeled bin wins once across all hourly footprints, preventing repeated reports or overlapping smaller bins from dominating the mode. The modal bin is 1.50–1.99 inches in these ten counties because the actual qualifying exposure area is most often in that bin; no variation is forced.','',
      'County and ZIP estimates integrate over their actual polygons. ZCTAs use their Oklahoma-clipped geometry directly; a primary county is contextual only. No address, roof centroid, county-average rate broadcast, or assumed residential population surface is substituted.','',
      '## Reproduce','',
      '```sh',
      'python scripts/hail/spatial_exposure.py --cache ../../work/hail-cache --work ../../work/hail-audit',
      '# Inspect this audit before updating the application:',
      'python scripts/hail/spatial_exposure.py --cache ../../work/hail-cache --work ../../work/hail-audit --apply',
      'python scripts/hail/write_spatial_report.py ../../work/hail-audit/debugging-results.json',
      '```','',
      'The SQLite audit cache contains only verified projected qualifying footprints and source audit metadata. Use a new work directory if the source manifest or method version changes. Financial models are unchanged.']
    markdown.parent.mkdir(parents=True,exist_ok=True);markdown.write_text('\n'.join(lines)+'\n')
    csv_path.parent.mkdir(parents=True,exist_ok=True)
    with csv_path.open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('report',type=Path);p.add_argument('--markdown',type=Path,default=Path('docs/HAIL_SPATIAL_AUDIT.md'));p.add_argument('--csv',type=Path,default=Path('data/metadata/hail-spatial-debug.csv'));a=p.parse_args();write_report(json.loads(a.report.read_text()),a.markdown,a.csv)
