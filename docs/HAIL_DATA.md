# Historical hail ingestion and geographic exposure

This document describes the verified import delivered with the prototype. **Current exposure output is v2: a fixed-location, area-weighted ≥1.5-inch model. The original county-anywhere Poisson probabilities are retired. See HAIL_SPATIAL_AUDIT.md for the root cause and ten-county debugging table.** All commands run from the React project root. React's design and section hierarchy are retained; the existing exposure section now reads a local static file.

## What was actually downloaded and verified

The [NOAA Event Footprint Catalog product page](https://www.ncei.noaa.gov/products/event-footprint-catalog) links a public Google Cloud Storage bucket. No NOAA application API endpoint was invented. `fetch_sources.py` uses standard GCS XML object listing and HTTPS downloads of the documented objects under:

```
gs://noaa-ncei-ipg/datasets/event-catalog/hail/
https://storage.googleapis.com/noaa-ncei-ipg/datasets/event-catalog/hail/
```

NOAA's own [download instructions](https://storage.googleapis.com/noaa-ncei-ipg/datasets/event-catalog/DOWNLOAD.md) and [dataset schema](https://storage.googleapis.com/noaa-ncei-ipg/datasets/event-catalog/EFC_Dataset_README.md) are preserved in `data/metadata/`. The product's linked information-sheet PDF returned 404 during verification; the bucket documentation and actual files were used instead.

Before writing the parser, actual `mrms_hail_data_2020-10-14.geojson` and `mrms_hail_data_2025-01-01.geojson` files were downloaded and inspected. Both are GeoJSON FeatureCollections with Polygon features. Verified properties: `date`, `convective_day`, `source`, `hour_utc`, `hail_size_range_in`, `hail_min`, `hail_max`. Small official sample files remain in `data/raw/`. `verified-hail-bins.json` records all size combinations found in the complete downloaded input.

The current verified result uses:

- **1,905 daily UTC GeoJSON files**, with no failed downloads or invalid parsed daily files. The window requests October 1, 2020 through December 31, 2025, plus January 1, 2026 to finish the final convective day.
- **3,336,494 source features**, before geographic filtering. They are hourly modeled footprint polygons, NOT independent storms.
- **77 Oklahoma counties**, Census 2024 1:500,000 cartographic boundaries.
- **696 ZCTAs** with positive-area Oklahoma intersections, Census 2020 1:500,000 cartographic boundaries.
- NOAA Storm Events annual details CSVs for 2020–2025, used separately as supplemental reports.
- `public/data/hail-history.json`, approximately 2.9 MB, validated against `data/hail-history.schema.json` and cross-field checks. `data/sample-output.json` is an actual imported Oklahoma County record, not fabricated example observations.

`data/metadata/source-manifest.json` retains each exact object URL, byte count, SHA-256, listing ETag and GCS generation, along with boundary/secondary-file checksums. SHA-256 for EFC is computed over original uncompressed GeoJSON bytes even though the cache is gzip-compressed; secondary gzip and Census ZIP checksums cover the downloaded bytes. The output references SHA-256 of the manifest's sorted-key JSON serialization. `import-verification.json` records the completed output checksum and counts. Catalog files can be revised in place: retain the raw cache and manifest for reproducibility rather than expecting future downloads to be identical.

## Source schema discrepancy handled explicitly

The NOAA website and all actual downloaded files use seven source categories:

| hail_min | hail_max in source | Display category |
| ---: | ---: | --- |
| 0.5 | 0.99 | 0.50–0.99 in |
| 1.0 | 1.49 | 1.00–1.49 in |
| 1.5 | 1.99 | 1.50–1.99 in |
| 2.0 | 2.49 | 2.00–2.49 in |
| 2.5 | 2.99 | 2.50–2.99 in |
| 3.0 | 3.99 | 3.00–3.99 in |
| 4.0 | 10.0 | 4+ in |

One bucket README instead documents separate 3.0–3.49 and 3.5–3.99 bins. The parser accepts those documented finer bins and combines them into the broad 3.00–3.99 category. It does not fabricate an absent finer split in the actual import.

**10.0 is the source's upper cap for an open-ended bin, not a measured ten-inch hailstone.** Largest historical modeled size is represented as a bin with bounds; exact peak size is null. MRMS estimates are not verified ground observations. Hail under 0.5 inches is outside this product's represented threshold.

## Reproduce the download and import

Use Python 3.12+; no runtime Python or NOAA access is needed by React after generation. `requirements.lock.txt` records the verified full Python dependency versions; `requirements.txt` lists the direct requirements.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/hail/requirements.lock.txt

python scripts/hail/fetch_sources.py \
  --cache ../../work/hail-cache \
  --start 2020-10-01 --end 2025-12-31

python scripts/hail/rebuild_history.py \
  --cache ../../work/hail-cache --work ../../work/hail-rebuild

python scripts/hail/validate_output.py
python -m unittest discover -s scripts/hail -p 'test_*.py' -v
pnpm test
pnpm build
```

The full source transfer is approximately 1.8 GB of original GeoJSON, plus Census and report data; the gzip cache is substantially smaller. Six bounded download workers are used by default. Re-running uses cached objects, with size checks and retained SHA-256 provenance. To fetch revised source versions, use a **new cache directory** and retain the old manifest. A cached file is intentionally not silently replaced by an upstream revision. Use `--workers 2` for a smaller network/concurrency footprint.

The script discovers actual listed object names and the latest listed annual Storm Events revision. It does not construct presumed dated revision filenames. Missing objects are retained as gaps in the period; failed downloads are recorded. Parsing a different source schema fails a day rather than guessing values.

The import validates source-file SHA-256 checksums, parses the verified schema, builds intersections, validates the final output schema and arithmetic, and only then writes the app's static file. Records from a failed daily file are not partially counted. Boundary or secondary-file checksum failures stop the import. Generation time changes on rebuild; the analytical counts reproduce for unchanged sources and versions.

## Manual official download fallback

If scripted access is blocked, NOAA documents Google Cloud Console and `gsutil` downloads. From the product page choose **Bulk Data Download**, navigate to `datasets/event-catalog/hail/`, and download the original daily GeoJSON objects for the desired dates, including the next UTC day after the final convective day. An equivalent documented command is:

```sh
gsutil -m cp 'gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms_hail_data_2025-*.geojson' ../../work/manual-hail-cache/
gsutil cp 'gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms_hail_data_2026-01-01.geojson' ../../work/manual-hail-cache/
```

Those commands are examples using NOAA's documented object paths. They do not assert that an unlisted date exists. First list the prefix and preserve any unavailable dates as unknown.

Download these verified Census files into the same cache:

- [2024 county boundaries](https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip)
- [2020 ZCTA boundaries](https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip), optional

Preserve filenames `mrms_hail_data_YYYY-MM-DD.geojson` or `.geojson.gz`. Make a manifest and import:

```sh
python scripts/hail/manual_manifest.py \
  --cache ../../work/manual-hail-cache \
  --start 2025-01-01 --end 2025-12-31 \
  --county-file cb_2024_us_county_500k.zip \
  --zcta-file cb_2020_us_zcta520_500k.zip \
  --confirm-complete-utc-exports

python scripts/hail/rebuild_history.py \
  --cache ../../work/manual-hail-cache --work ../../work/manual-hail-rebuild \
  --manifest data/metadata/manual-manifest.json
```

The confirmation flag declares that every provided file covers the full Oklahoma region, all UTC hours, and every represented size bin; it does NOT certify radar uptime. Partial or size-filtered map exports cannot establish zero-exposure days. Do not give them this declaration. If using the interactive EFC export, first establish that completeness, split records by `properties.date`, preserve original properties/geometry, and use the original daily naming convention. Missing daily files remain unknown; an absent date must not be replaced with a made-up empty FeatureCollection. A one-year manual import can show recorded history but cannot generate the exposure projections, which require at least two complete calendar years and qualifying footprint coverage.

Primary EFC CSV exports without polygons are not accepted as spatial footprints. Use GeoJSON for primary intersection analysis. Secondary NOAA Storm Events CSV is supported through the separately verified details-file parser below; points/reports are never fabricated into footprint polygons.

## Spatial method and ZIP treatment

- Census shapefile PRJ files were inspected: both use NAD83 (EPSG:4269). Boundaries are transformed to WGS84 (EPSG:4326), matching standard GeoJSON coordinates.
- Select all counties with `STATEFP=40`; require exactly 77. Their union defines the Oklahoma clipping geometry.
- County exposure: any **positive-area polygon intersection** between an MRMS hail footprint and county boundary. A boundary-only touch does not count. This means hail **somewhere within the county**, not that the whole county or every roof was hit.
- ZCTA exposure: intersect footprints directly with each ZCTA's Oklahoma-clipped polygon. A cross-state ZCTA represents its Oklahoma portion, not its entire interstate postal delivery area.
- County context for a ZCTA: intersect Census county boundaries with the clipped ZCTA and calculate area shares in EPSG:5070 (CONUS Albers equal area). The largest overlap is the primary contextual county; all positive county overlaps are retained. Exposure is never inherited from that county or combined by adding county event counts.
- Different boundary vintages and generalized 1:500,000 geometry can create small boundary slivers. An extremely small overlap is not proof of ZIP delivery service in that county. The app explains this uncertainty.
- [Census ZCTAs](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html) approximate ZIP areas, do not represent every valid ZIP, and can be noncontiguous. A supported five-digit code selects its ZCTA directly. Unsupported codes show no-data information instead of a guessed county or zero-risk result.
- No address lookup, roof point, centroid substitution, or address-level exposure calculation is implemented. Adding one later requires an actual point-in-footprint or equivalent defensible site model.

MRMS has approximately kilometer-scale source resolution; cartographic boundaries and source rounding add uncertainty. Footprints are validated, and any required `make_valid` topology repair is counted in provenance. The delivered import required no such repairs.

## Time, duplicate storms and missing data

NOAA's `convective_day` runs **12:00 UTC through 11:59 UTC the following day**. The parser checks that it agrees with the source UTC date/hour. A county or ZCTA gets at most **one exposure day** for that day, irrespective of hourly polygons, overlapping size bins, report counts or duplicated features. The binary size mask preserves which bins occurred; a separate exclusive maximum-severity count partitions days without double-counting. This is a count of exposure **days**, not a claim that each report or even each day is an independent physical storm.

Both adjacent UTC daily files are required to mark a convective day as catalog-available. This is stricter than counting filename dates alone:

- Requested October–December 2020: 92 days; files begin October 14, so **79 catalog-available days** and 13 unknown days. January–September 2020 is not part of this period. 2020 is always partial and never counted as a complete year.
- `2021-11-20` is absent from the verified object inventory. November 19 and 20 convective days therefore lack a complete pair of UTC files. 2021 has **363/365 catalog-available days**, is labeled **gapped**, and is excluded from the rate denominator.
- 2022, 2023, 2024 and 2025 have complete paired-file calendar coverage. The current estimate uses **these four years**, not an asserted five-year complete record.

An invalid or absent source file is unknown, never a zero-storm observation. A valid empty daily collection records no catalog detections, not a claim of no actual hail. File availability does not establish complete radar operation; **no radar-uptime mask is supplied**. All coverage labels mean catalog-file availability, not verified continuous physical observation. Spatial sensor outages and detection bias remain unquantified.

Historical summary counts can include verified detections on days whose other UTC half is missing, since detection is known; such days do not establish full-day availability and cannot enter an incomplete year's annual-rate denominator.

## Corrected location-exposure calculation (v2)

The original area-anywhere calculation was a target-metric error: a tiny footprint anywhere in a county counted as one whole county day, and a Poisson conversion of that count saturated near 100%. Independent equal-area auditing reproduces all 77 counties' old day counts, proving those counts were correctly assigned, but they were the wrong input for personal-location exposure. `HAIL_SPATIAL_AUDIT.md` records the before/after results.

The current model uses one fixed proxy: modeled hail **≥1.5 inches**. All NOAA categories beginning at 1.5 inches are included; smaller bins are excluded from these estimates. This is exposure to hail potentially capable of damaging a roof, not roof damage, a claim or replacement probability.

### Daily coverage and location-first aggregation

1. Transform footprints and geographic boundaries to EPSG:5070, a CONUS equal-area CRS.
2. Union all qualifying hourly polygons on each convective day. Overlaps are counted once at each location/day.
3. Clip those unions to each county or Oklahoma-clipped ZCTA. No bounding-box overlap, county centroid or whole-county broadcast substitutes for a true overlap.
4. Measure the daily covered area. The descriptive exposed-days/location/year rate is `sum(daily union area) / region area / complete years`. A tiny footprint contributes only its measured geographic coverage, not a full event for every location.
5. Union all qualifying days within each complete year. Partition the region by its exact annual hit pattern: for four years there are at most 16 subsets. Each fixed location retains its own observed years with exposure.
6. At each location x, estimate annual exposure frequency `p(x) = exposed complete years / complete years`. Compute exploratory `1 − (1 − p(x))^T` for T=1/5/10 **before** averaging over the exact spatial partition. This is not `1 − (1 − mean p)^T`, and no Poisson formula or arbitrary scaling factor converts county-anywhere day counts into personal exposure.

This corresponds to resampling whole observed calendar-year footprint fields with replacement for a fixed geographic location. It retains within-year storm clustering and seasonality rather than assuming every report or day is an independent physical storm. It assumes stationary, independent future years, which the short record cannot validate. The annual field is observed historical frequency; the longer projections are explicitly exploratory.

There is no verified residential-location layer in the input set. The weighting is uniform geographic **area**, not a typical-home distribution. ZCTAs use their own smaller polygons directly, not county probabilities inherited from a primary county. No address-specific risk is claimed.

### Typical modeled hail size

At each geographic location/day, the largest qualifying bin wins once across all hourly footprints. For each bin, sum its exclusive exposed area over the complete observation years. The displayed typical size is the unique modal bin by area × distinct exposed days, conditional on qualifying exposure. Smaller overlapping bins and repeated hourly reports cannot dominate by duplicate count. The county-wide maximum is not used. A numerical tie or absence of qualifying data yields no invented typical bin. All 77 counties currently have a modal bin of 1.50–1.99 inches; some ZCTAs have different modes. That comes from the data, not a hardcoded display value.

### Uncertainty and insufficient observations

The implementation enumerates whole-year bootstrap multiplicities for short records and retains 95% **resampling sensitivity ranges** in the data. These are not comprehensive calibrated 95% confidence or forecast intervals, and are no longer printed in the main interface. Bootstrapping four years can underestimate uncertainty, particularly for unobserved spatial patterns.

Only 2022–2025 are fully available calendar years in the current archive. October–December 2020 remains partial; 2021 remains gapped. Missing data are never turned into no-hail days. The rate and annual spatial patterns use the same complete-year denominator.

Five- and ten-year projections assume repetitions of the observed footprint-year distribution. Such resampling cannot invent new spatial patterns outside the observed footprint support, so long-horizon estimates can be biased downward. A location not hit in four years is not known to have zero future risk. Radar uptime/false positives, changing detection, climate trends, storm-year dependence, boundary precision and housing-location weighting are not resolved by these intervals. More historical years and an independently validated hazard model are needed for reliable property forecasts.

Areas with fewer than two complete years, no qualifying footprint coverage, or unusable spatial geometry have null projections and no typical-size claim. The app displays insufficient-data information rather than 0% or an arbitrary substitute.

### Geometry audit and small boundary fragments

The equal-area audit found zero mismatches in the 77 county day totals and rejected 28,010 bounding-box candidates with no true geographic overlap. Raw county and hail geometries were valid. Seven tiny cross-state ZCTA clipping fragments required topology repair **after** projection. These repairs are recorded with before/after areas; they are geometric robustness operations, not probability scaling. All seven repaired fragments have numerical estimates withheld pending boundary verification. One 2.87-square-meter fragment (ZCTA 79034's Oklahoma sliver) also fails the spatial area-partition tolerance. No county was affected. The boundary data are generalized at 1:500,000 and MRMS resolution is approximately kilometer-scale, so such slivers do not support a meaningful residential estimate.

## Secondary Storm Events CSV

Source: [NOAA's official annual details directory](https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/). `fetch_sources.py` discovers actual latest revision filenames from the directory listing. The actual 2025 header and an Oklahoma hail row were inspected before implementing the secondary parser.

Required columns include `STATE_FIPS`, `CZ_TYPE`, `CZ_FIPS`, `EVENT_TYPE`, `EVENT_ID`, `EPISODE_ID`, `BEGIN_DATE_TIME`, `MAGNITUDE`. Filter `STATE_FIPS=40`, `CZ_TYPE=C` and `EVENT_TYPE=Hail`; county FIPS is `40` plus zero-padded `CZ_FIPS`. Retain only dates in the requested period. Deduplicate report IDs; exposure context counts unique **source-local calendar dates**, not report count or independent storm episodes. Hail magnitudes are reported inches; missing magnitudes remain missing.

These supplemental local reporting dates differ from 12Z convective days. Report context is stored separately under each county's `secondaryReports`. It is not added to EFC counts, not used for the rate, not used as a point/polygon substitute, not assigned to ZCTAs, and never used to fill missing MRMS days. No reports is not evidence of no hail.

## Output contract, frontend and future updates

- `data/hail-history.schema.json`: versioned JSON Schema, including nullable spatial estimates. The Python baseline importer supports v1 for ingestion; the app accepts only corrected v2, never the old county-anywhere rate.
- `data/sample-output.json`: actual imported county record with manifest hash.
- `data/metadata/source-manifest.json`: raw source inventory and checksums.
- `data/metadata/location-days.csv.gz`: audit rows `(kind, geoid, convective_day, bin bitmask, maximum bin)` before annual aggregation.
- `public/data/hail-history.json`: geometry-free static summaries for React. Raw national polygons are not bundled.
- `src/models/history.ts`: runtime validation, location lookup and fixed-location spatial projection validation and selection.
- `src/hooks/useHailHistory.ts`: loads only the local static asset, respecting the Vite base path; no runtime NOAA/API request.
- `src/components/HistoricalExposure.tsx`: content inside the existing exposure section, with a simplified single-threshold display and one “How is this calculated?” disclosure.

Schema/field mapping changes belong in the importer, not React components. The v2 artifact can be regenerated with `rebuild_history.py`, which builds intermediate data off-screen, validates the corrected model, and publishes atomically. A failed build never replaces the existing public file. Running the baseline importer alone does not publish a supported location-risk artifact. Unsupported schema versions or malformed artifacts show unavailable data in the app.

This corrected exposure model is intentionally **not passed into the existing roof-damage or financial models** in this change. Those models were left unchanged as requested. Those calculations retain their explicitly labeled experimental point-exposure assumptions and toy fragility tables. This separation avoids converting a large-area footprint statistic into a falsely precise roof-damage probability.

## Tests

Python tests use clearly labeled synthetic geometries for overlaps, touches, duplicate hours, date boundaries, partial years, gaps and zero-count uncertainty; an actual downloaded sample tests the NOAA schema. Synthetic test data are never served as historical records.

Vitest validates the real generated artifact, 77-county coverage, direct ZCTA selection, unsupported ZIP behavior, multi-county context, partial-year exclusion, rate intervals, missing-data semantics and open-ended size bins. Existing financial/model tests continue to run. `validate_output.py` additionally checks schema, category partitions, complete-year denominators, bounds and coverage arithmetic before the artifact is accepted.

### Expected exposed years and repeated exposure

The main display reports expected **years with at least one ≥1.5-inch exposure**, not storm counts or damage years. The source polygons, complete-year selection, spatial partitions and annual probability estimates are unchanged. At a fixed location, p is the fraction of complete observed years hit at least once. No event-rate conversion is needed. Multiple hail days or storms within one year still contribute one annual hit.

For n future years, a stationary independent-year Bernoulli model gives a binomial count of exposed years: expectation n×p, probability of at least two exposed years 1−(1−p)^n−n×p×(1−p)^(n−1), every year p^n, and at least once 1−(1−p)^n. These are calculated for each exact spatial annual-hit partition, then area-weighted. Nonlinear probabilities are **not** calculated from a single county/ZCTA average p. Expected years are linear, so their area average also equals n times the area-averaged annual probability.

The repeated-exposure disclosure defines repetition as exposure in at least two **different years**. Every-year and at-least-once probabilities are secondary statistics. Expected fractional years describe a mean across possible outcomes, not partial storms. Four complete observed years cannot establish precise future probabilities; five- and ten-year results remain exploratory. Spatial heterogeneity, short-record blind spots, stationary risk and annual independence limitations remain unchanged. Missing geographic support stays null. No exposure automatically implies roof damage, repair, a claim or replacement; the financial model remains separate.

`src/models/exposedYears.test.ts` independently enumerates all annual hit/miss sequences at 5%, 20%, and 50% annual probabilities, verifies horizon ordering and edge cases, preserves existing at-least-once spatial estimates, and tests missing data and heterogeneous spatial aggregation.

### Current minimal ZIP display

The current display supersedes the exposed-year card presentation above: one year shows the existing calculated annual exposure probability; five and ten years show `~round(p × horizon)` labeled “Storms.” Rounding uses a strictly greater-than-0.51 fractional cutoff (with machine-precision tolerance at the boundary), not standard rounding. These labels are a simplified expected-exposed-years approximation, not a validated count of individual storms. Multiple storms may occur within a year, and ~0 can be a rounded positive expectation. This limitation is included in the single methodology disclosure.

ZIP changes recalculate directly from the local artifact. A supported ZCTA without a numerical estimate falls back to its verified largest-area-overlap county when that county has a usable estimate, explicitly labeled as county-level. Unknown ZIPs without a verified geographic assignment remain unavailable; no guessed ZIP mapping or demonstration probability is used. No manual probability control is present in this section. Geographic data, spatial model, styles and financial calculations are unchanged.

Validation covers actual ZIPs 73102, 73006 and 73501; county fallback 74103; unknown ZIP 00000; and strict rounding boundary cases including the requested 51% example.

### ZIP-led opening and reveal

The opening uses ZIP entry only. A five-digit ZIP must resolve to an existing Oklahoma-clipped Census ZCTA with a positive county overlap before the hail introduction is mounted. Its primary county is the largest geographic-area overlap recorded in the verified artifact; ZIP and resolved county are stored in application state. This county names the heading; numerical estimates still use the existing ZIP polygon and existing documented county fallback. Unresolved ZIPs receive no guessed county and reveal no risk figures.

The landscape is a replaceable SVG placeholder. The illustrative hail transition mounts anew for a different valid ZIP, runs for ten seconds, fades out, and leaves static clouds. Reduced-motion CSS disables the reveal and falling-hail animations. The animation does not encode probability, hail severity, storm counts, or roof damage. No house graphics accompany risk results. Risk and financial calculations and source data are unchanged.
