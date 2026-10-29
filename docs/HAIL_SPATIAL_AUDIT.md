# Hail spatial audit and correction

## Root cause

The original calculation correctly counted a day when at least one ≥0.5-inch footprint intersected any part of a county, but then used that county-anywhere day rate in `1 − exp(−rate × years)`. This answers a regional-anywhere question, not exposure at a fixed geographic location. Large regional rates saturate at nearly 100%, hiding actual differences. No statewide-to-every-county broadcasting error was found.

The revised model includes only ≥1.5-inch modeled hail. Within each convective day it unions overlapping hourly footprints, then measures covered area. Annual unions preserve locations hit repeatedly. Exact polygon partitions retain each location’s observed annual hit pattern before projections are area-averaged. No housing-location weights have been verified, so these are area-weighted estimates, not estimates for a typical residence.

## Geographic audit

- 3,336,494 original features re-read and checksum-verified.
- Census source CRS verified from PRJ files: NAD83 / EPSG:4269. NOAA GeoJSON: WGS84 / EPSG:4326. Areas measured in CONUS Albers equal area / EPSG:5070.
- 131,275 county bbox candidates; 28,010 rejected for lack of actual geographic overlap.
- 103,265 positive-area county intersections; 0 boundary-only candidates counted as exposure.
- Invalid geometries: 0 counties, 0 hail polygons; failed source files: 0.
- County day-count mismatches versus the prior independent geographic method: 0 across all 77 counties.
- 49 different recorded-day totals across the 77 counties; the source counts were not identical.

Seven tiny cross-state ZCTA fragments required topology repair after projection. All seven have numerical estimates withheld pending boundary verification; ZCTA 79034 also fails area-partition tolerance. No county was affected. Repairs and before/after areas are recorded in the audit metadata.

## Ten-county debugging results

Historical days cover the requested October 2020–December 2025 window; qualifying-day coverage, rates and projections use complete catalog years 2022–2025 only. Partial 2020 and gapped 2021 remain excluded. “Event” here means a distinct convective exposure day, not a report or independent physical storm.

| County | All ≥0.5″ days | ≥1.5″ days, full window | ≥1.5″ days, complete years | Mean covered area per qualifying day | Exposure days/location/year | 1 year | 5 years* | 10 years* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Oklahoma | 129 | 21 | 19 | 1.31% | 0.062 | 6.1% | 17.2% | 20.9% |
| Tulsa | 106 | 10 | 10 | 1.93% | 0.048 | 4.7% | 13.8% | 16.9% |
| Cleveland | 119 | 13 | 11 | 1.37% | 0.038 | 3.6% | 10.9% | 13.4% |
| Murray | 151 | 18 | 16 | 2.16% | 0.086 | 8.6% | 24.8% | 30.1% |
| Texas | 227 | 56 | 47 | 1.10% | 0.129 | 12.6% | 31.6% | 37.0% |
| Cimarron | 173 | 44 | 36 | 1.76% | 0.158 | 14.9% | 37.2% | 43.6% |
| Comanche | 154 | 27 | 23 | 1.91% | 0.110 | 10.8% | 30.6% | 37.0% |
| Garfield | 165 | 29 | 27 | 0.61% | 0.041 | 4.1% | 12.4% | 15.3% |
| McCurtain | 181 | 27 | 24 | 0.70% | 0.042 | 4.2% | 12.5% | 15.3% |
| Canadian | 158 | 21 | 19 | 1.13% | 0.054 | 5.3% | 15.8% | 19.4% |

*All projections are conditional exploratory estimates, particularly 5/10 years. They are not validated property, damage, claim or replacement forecasts.*

## Statistical method and limitations

For a fixed geographic location x, count distinct qualifying exposure days and the number of complete years in which at least one qualifying footprint reached x. Let p(x) be the observed fraction of complete years with such exposure. The exploratory T-year projection is `1 − (1 − p(x))^T`, evaluated at each location before area integration. This is not `1 − (1 − average(p))^T` and is not a Poisson conversion of county-wide day counts. Exact intersections of the four annual footprint unions provide the spatial partition; no arbitrary grid resolution or scaling factor is used.

Whole-calendar-year resampling retains within-year storm clusters, overlap and seasonality. It assumes the observed annual footprint fields can represent independent stationary future years. With only four complete years that assumption is weak and unvalidated. In particular, resampling cannot introduce new spatial patterns outside the observed footprint support, so longer-horizon estimates can be biased downward. Areas not hit in this short record are not known to have zero future risk. Bootstrap ranges describe resampling sensitivity, not comprehensive 95% forecast confidence. These limitations are retained in the data and methodology disclosure.

The exposure-days/location/year column is `sum of daily union area / region area / complete years`. It is a descriptive expected count of distinct exposed days, not a physical storm-arrival intensity; it is not mechanically fed to a Poisson model.

Typical hail size is the modal NOAA bin by geographic area × distinct exposed days, among qualifying exposures. At each location/day the largest modeled bin wins once across all hourly footprints, preventing repeated reports or overlapping smaller bins from dominating the mode. The modal bin is 1.50–1.99 inches in these ten counties because the actual qualifying exposure area is most often in that bin; no variation is forced.

County and ZIP estimates integrate over their actual polygons. ZCTAs use their Oklahoma-clipped geometry directly; a primary county is contextual only. No address, roof centroid, county-average rate broadcast, or assumed residential population surface is substituted.

## Reproduce

```sh
python scripts/hail/spatial_exposure.py --cache ../../work/hail-cache --work ../../work/hail-audit
# Inspect this audit before updating the application:
python scripts/hail/spatial_exposure.py --cache ../../work/hail-cache --work ../../work/hail-audit --apply
python scripts/hail/write_spatial_report.py ../../work/hail-audit/debugging-results.json
```

The SQLite audit cache contains only verified projected qualifying footprints and source audit metadata. Use a new work directory if the source manifest or method version changes. Financial models are unchanged.
