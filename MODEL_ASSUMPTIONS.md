# Oklahoma roof prototype: calculation engine

This is an exploratory model, not an Oklahoma quote, a hazard forecast, an engineering assessment, a coverage decision, or a grant eligibility determination. Reference date: October 27, 2026.

All adjustable assumptions and initial inputs are centralized in `src/data/config.ts`. The UI clones that configuration into shared state; edits recalculate the pure models synchronously. Nothing is uploaded or saved across reloads. Invalid or missing numeric inputs produce an error and unavailable results, rather than retaining a previous estimate.

## Data quality and sources

- **Observed data:** supplemental NOAA Storm Events reports are loaded separately from radar-derived modeled footprints. An OID report provides context about participant premium savings, not an individual projection.
- **Published modeled data:** verified NOAA MRMS-derived footprint histories are integrated for county/ZCTA area exposure. No published roof fragility is implemented yet. The engine accepts a `VulnerabilityModel` provider with its own source and quality metadata.
- **Prototype assumptions:** the geometry factors, cost ranges, fragility tables, lookup scales, approval/frequency parameters and financial modeling conventions below.
- **Demonstration data:** prefilled household and insurance values, invented annual hazard rates, and results derived from these assumptions. User edits are unverified scenario inputs.

Sources are educational context only:

1. [OID Strengthen Oklahoma Homes](https://www.oid.ok.gov/okready/): grant maximum and conditional program requirements. Grant cannot pay an insurance deductible. Eligibility and eligible work require actual program review.
2. [OID December 8, 2025 participant report](https://www.oid.ok.gov/release_120825-1/): reports savings of **around $750 annually**. The exact **$749** default remains a requested prototype assumption; no individual discount is guaranteed.
3. [OID Post-Disaster Claims Guide](https://www.oid.ok.gov/wp-content/uploads/2024/04/publication-post-disaster-claims-guide-1.pdf): RCV, ACV and claims concepts. This engine's explicit limit-ordering convention does not interpret actual policy wording.
4. [Li, Porter and Goda (2024), Hail hazard modeling with uncertainty analysis and roof damage estimation of residential buildings in North America](https://media.cocorahs.org/docs/Journal_Disaster_Risk_Reduction_2024_CoCoRaHS_Hail.pdf): future fragility integration reference. No coefficients, calibrated probabilities, numerical performance claims or research findings from this paper are implemented.
5. [IBHS technical documents](https://fortifiedhome.org/technical-documents/): FORTIFIED standard requirements. Designation is not a guarantee against damage; selected impact class and system efficacy in this prototype are separate assumptions.

## 1. Roof area and replacement costs — `roofCost.ts`

```
roof area = total interior floor area / stories × slope factor × complexity factor
conventional unit cost = materials × material cost factor
                       + labor
                       + optional removal
                       + decking cost × affected decking fraction
conventional cost = roof area × conventional unit cost
FORTIFIED cost = conventional cost + roof area × additional FORTIFIED unit cost
```

Floor area is not roof area. The footprint approximation assumes roughly equal floor areas on each story; garages, overhangs, additions, waste and individual roof planes are not measured. Slope and complexity factors are adjustable and must be at least 1. Stories must be a positive integer. Fractional/unequal stories require a future geometry model.

Initial slope is **1.2**. Complexity presets are simple **1**, moderate **1.15**, complex **1.35**, unknown **1.15**. Changing the preset updates the numeric complexity factor; a direct numeric edit overrides it. Complexity is applied once, through area.

All unit costs below are invented editable **$/roof sq ft**, not national prices repackaged as Oklahoma quotes:

| Cost | Low | Central | High |
| --- | ---: | ---: | ---: |
| Conventional materials | 3 | 4 | 5 |
| Local labor | 2 | 3 | 4 |
| Additional FORTIFIED work | 1 | 1.5 | 2.5 |
| Removal | 0.5 | 1 | 1.5 |
| Decking, per affected sq ft | 2 | 3 | 4 |

Removal starts enabled; decking fraction starts at **0** and is editable from 0 to 1. Material factors, applied only to materials: standard asphalt **1**, impact-resistant asphalt **1.3**, metal **1.8**, tile **2.3**, other **1.3**, unknown **1.2**. They are configuration assumptions, not measured Oklahoma cost relativities.

Low, central and high costs combine the corresponding endpoints. They are scenarios, not statistical confidence intervals. The central estimate feeds insurance, specific storm and expected financial comparisons. Vary unit costs to explore uncertainty. Additional permits, tax, evaluation fees, structural work, financing, temporary repairs, interior water loss and contents damage are not separately priced. The additional FORTIFIED cost is an editable placeholder rather than a construction specification.

## 2. Insurance — `insurance.ts`

Inputs explicitly include coverage (covered/excluded/unknown), decision (approved/denied/pending), approved share of physical loss, RCV/ACV/unknown basis, fixed or percent deductible, dwelling coverage, roof payment cap, roof depreciation and completed-repair status.

```
deductible = fixed dollars, OR percentage × dwelling coverage
approved loss = physical loss × approved share
  (only for explicitly covered, approved damage with known settlement basis)
depreciation = approved loss × roof depreciation fraction
payment cap = min(roof payment limit, dwelling coverage)
initial payment = min(cap, max(0, approved loss − depreciation − deductible))
final potential RCV = min(cap, max(0, approved loss − deductible))
final potential ACV = initial payment
recoverable depreciation = final potential payment − initial payment
selected payment = final potential RCV if repair/recovery conditions are met,
                   otherwise initial payment
out-of-pocket = entire physical loss − selected payment
```

**Ordering convention:** coverage limits cap insurer payments **after** deductible/depreciation. A limit on eligible repair scope would require different policy logic. This is documented, tested scenario behavior, not a statement that every policy uses this order. A separate deductible and payment cap are applied to each independent storm; annual aggregate limits and multi-event deductible provisions are not modeled. The entire approved amount is assumed depreciable; material-versus-labor depreciation, endorsements, matching, multiple deductibles, disputes and additional coverages are not interpreted.

RCV recovery is potential, contingent on required work and policy conditions. Recoverable depreciation is never added twice or assumed paid before the user selects completion. Out-of-pocket for an uncompleted RCV claim includes temporarily unrecovered depreciation and is a cash-flow illustration, not necessarily the final ultimate expense.

Unknown coverage/basis, a pending decision, or exclusion/denial yields no assumed payment. This represents unresolved coverage conservatively, not a prediction of denial. Unknown roof-specific limitations use the dwelling cap in the chosen scenario, with a disclosure. Partial approval leaves the unapproved portion with the homeowner. Fresh conventional and FORTIFIED roofs use **0** depreciation as a prototype assumption. Betterment coverage for enhanced replacement is not automatically inferred: users must set the approved share and coverage terms appropriately.

Default policy: RCV, **2%** wind/hail deductible on **$300,000** dwelling coverage, **35%** roof depreciation, **$3,000** annual premium, unknown roof limitations, and a **$15,000** roof cap if that option is selected. Switching to fixed deductible initializes **$2,500**. Scenario coverage starts **unknown**, approval **pending**, approved fraction **0.8**, and repairs **not completed**. These are all demonstration choices.

## 3. Roof vulnerability — `vulnerability.ts` and `domain.ts`

`VulnerabilityModel.evaluate(FragilityInput)` returns mutually exclusive probabilities of **no damage**, **repair**, and **full replacement**, plus the repair fraction of replacement cost. Outcomes must be finite, bounded in [0,1], and sum to 1. Inputs cover hail category, material, impact-resistance class, age, prior damage, roof condition and conventional/FORTIFIED system.

The starter provider is identified as `editable-toy-fragility-v1`, quality **Prototype assumption**. It is a transparent table exercise. These are NOT invented engineering research coefficients or claims of measured performance.

Each tuple below is `(damage probability, replacement conditional on damage, repair fraction of replacement cost)` before the editable lookup scales:

| Material | Small hail | Large hail | Very large hail |
| --- | --- | --- | --- |
| Standard asphalt | (0.12, 0.05, 0.10) | (0.40, 0.25, 0.30) | (0.75, 0.60, 0.50) |
| Impact-resistant asphalt | (0.08, 0.03, 0.08) | (0.28, 0.20, 0.25) | (0.60, 0.50, 0.45) |
| Metal | (0.10, 0.04, 0.12) | (0.30, 0.20, 0.30) | (0.65, 0.50, 0.45) |
| Tile | (0.10, 0.04, 0.10) | (0.35, 0.22, 0.30) | (0.70, 0.55, 0.50) |
| Other / unknown | (0.12, 0.05, 0.10) | (0.40, 0.25, 0.30) | (0.75, 0.60, 0.50) |

Hail categories are illustrative severity bins, not diameter thresholds or validated engineering definitions. The existing mild/moderate/severe slider selects small/large/veryLarge; the no-storm position has no physical damage. Annual hazard integration uses all categories regardless of that slider.

Toy lookup scales for damage probability:

- Impact: unknown/unrated **1**, class 1 **0.95**, class 2 **0.9**, class 3 **0.8**, class 4 **0.7**.
- Age ≤5 years **0.8**, ≤15 **1**, ≤200 **1.2**; band boundaries and scales live in config.
- Prior damage **1.15** if yes, otherwise **1**.
- Condition: good **0.95**, fair **1**, poor **1.1**, unknown **1**.
- FORTIFIED roof-system lookup **0.65**, conventional **1**.

These multipliers are deliberately editable toy adjustments, not research-calibrated relationships. Combined damage probability is clamped to 1. Replacement probability = damage probability × replacement-given-damage; repair probability is the remainder of damage. Unknown impact class is not inferred from the material label, avoiding an automatic class certification.

The new conventional strategy uses the chosen current material/impact class but age 0, no prior damage and good condition. The FORTIFIED strategy additionally uses the configured upgraded impact rating, initially **Class 4**. This is an installation scenario assumption, not a claim that every FORTIFIED roof has that rating. Material and impact effects may overlap in this toy model; a calibrated published provider must replace this construction rather than inherit arbitrary scales.

Future integration: pass a published implementation to `compare(..., settings, provider)`, or directly to risk/finance functions. Preserve the paper's applicable roof types, outcome definitions, units, age domain and uncertainty. Any conversion from published hail diameters to this UI's categories requires explicit bin definitions and validation. The starter interface also permits optional hail diameter in millimeters for a later adapter; no diameter is inferred or used by the current tables.

## 4. Multi-year hazard and risk — `risk.ts`

Initial annual Poisson storm rates are small **0.12**, large **0.04**, veryLarge **0.01 events/year**. They are invented demonstration rates, identical for all counties and ZIPs. These experimental point rates are not the separately imported NOAA county/ZCTA histories. Supported ZIP inputs select ZCTA area histories, not a point hazard. Counts in categories are independent; each storm belongs to a single severity category, so severity rates must not count the same event twice.

For each severity `k`, rate `λk`, conditional damage `dk`, replacement `rk` and positive-payment chance `ck`:

```
hail exposure(T) = 1 − exp(−T × sum λk)
physical damage(T) = 1 − exp(−T × sum λk × dk)
insured claim(T) = 1 − exp(−T × sum λk × ck)
full replacement(T) = 1 − exp(−T × sum λk × rk)
```

These four probabilities answer different questions. “Insured claim” is explicitly defined in this UI as **positive insurer payment**, not claim filing alone. For each repair/replacement outcome, `ck` includes its physical probability, claim filing chance, approval chance, known coverage/basis and a payment exceeding zero after deductible and limits. Filing chance defaults to **0.9** and future approval chance to **0.8**, both editable assumptions. An unapproved or below-deductible loss can still be physical damage or require replacement.

Future approval probability is separate from the selected storm's specific decision. Multi-year paid-claim and expected financial calculations assume repairs completed and conditional approval, then weight compensation by filing × future approval chances. Coverage/basis exclusions still apply; pending status for a single storm is not propagated as a permanent future denial.

The exported Bernoulli helper computes `1 − (1 − p)^T` for an annual probability; it is not used interchangeably with a Poisson **rate**. For exactly `N` independent storms (default **3**), severity mix weights are `λk / sum λk`, and probability of at least one outcome is `1 − (1 − per-event probability)^N`. This conditional count exercise does not alter annual expected costs. If all rates are zero, a positive count has no defined severity mix and its result is marked unavailable. Zero events gives zero exposure and zero damage.

**Limitations:** 1/5/10-year outputs assume stationary rates, independence, constant severity mix and a fixed initial roof profile. Small samples can make apparent rates highly uncertain; correlated storms, climate changes, changes in exposure and aging roofs can invalidate these assumptions. Hazard/provider uncertainty is not propagated into confidence bands. A fixed-profile probability of any replacement is not a forecast of repeated replacements.

## 5. Financial comparison — `financial.ts`

Three alternatives are modeled: keep current, replace conventionally now, or replace with FORTIFIED now.

- Keep upfront: **$0**.
- Conventional upfront: central conventional installation cost; no grant.
- FORTIFIED upfront: central enhanced installation cost minus the eligible grant.
- Conventional annual premium change: **$0** initially.
- FORTIFIED annual premium change: **−$749** initially, editable; premiums floor at zero. A positive change is an increased expense.
- Scheduled conventional replacement for the retained roof: **none** initially; user may select the start of years 1–10.

Grant starts **$0** because eligibility, award approval and funding availability all default to **false/unknown**. Only if all are explicitly true:

```
grant = min(requested amount, program maximum, eligible installation cost)
```

Requested defaults to **$10,000**, program maximum **$10,000**, eligible share of installation **1**. The eligible-cost share is a hypothetical input, not program adjudication. A grant never pays the deductible, storm repairs or insurance shortfall, and it is subtracted only once from upfront work. No future grant after a storm is assumed.

Expected event cost integrates repair/replacement probabilities and losses across **all severities**. For each branch, insurer compensation is capped by coverage/approval terms, weighted by filing and future approval chances, and subtracted from physical loss. Premiums and scheduled work are separate expenses:

```
expected horizon cost = upfront after grant + premiums
                      + expected physical storm loss − expected insurer compensation
                      + expected still-needed scheduled replacement
```

Insurance compensation is never positive investment income. Avoided damage is not credited again as an extra cash benefit. Low/central/high replacement inputs are not investment-return estimates.

### Avoiding duplicate scheduled replacement

The retained roof has an old-roof state and a renewed conventional state. A full replacement after a storm moves it to the renewed state even when uninsured; this assumes the homeowner completes the physical replacement. Replacement is a thinned Poisson event with the old profile's fixed rate `r`. The probability still in the old state after time `t` is `exp(−rt)`.

For each year, expected time in the old state is `old share × (1 − exp(−r))/r`, or the full old share if `r=0`. Remaining time uses new conventional costs, vulnerability, zero depreciation and the configured conventional premium. This integrates within-year transitions rather than charging old-roof losses for the entire year after renewal.

At the start of the scheduled year, scheduled expense is `old share × conventional installation cost`; this replaces only roofs not already storm-replaced. Old share is then zero. New strategies are already renewed and are never charged the retained roof's schedule. After renewal, repairs/replacements restore the same stationary new-roof profile. Continuous aging and repeated end-of-life schedules are not simulated.

No inflation, discounting, residual roof value, financing, home sale, maintenance, tax, appraisal changes, claim-driven repricing or monetized disruption is included. This is an undiscounted homeowner cash-expense comparison, not a lifecycle net-present-value model.

## Single hypothetical storm versus expected cost

The illustration uses a shared deterministic outcome quantile, initially **0.15**, for the selected hail category. Full replacement occupies `[0,pReplacement)`, repair the next interval, and no damage the remainder. A quantile is a scenario selector, not an observed storm or precision damage forecast. Selecting no storm forces all three physical losses to zero. Repairs cost the selected table fraction of each strategy's central full replacement cost; full replacement costs that strategy's full amount.

Specific-storm claims respect the user-selected coverage, approval, approved fraction and repair completion. Changing the storm slider or quantile changes this scenario, not the distribution-integrated horizon costs. SVG damage marks are a visual convention based on the resulting loss fraction, not a validated count or location of impacts. Recovery remains qualitative; no days saved or disruption costs are invented.

## Validation, defaults and reproducibility

Home defaults: **2,000** interior sq ft, **1** story, **12** roof years, standard asphalt, moderate complexity, no prior damage, unknown condition and impact class, and no chosen location. Unknown age is stored as −1 and uses **12**; unknown stories uses **1**; unknown prior damage assumes no recorded prior damage. Other missing required numeric values are rejected rather than imputed.

Functions reject NaN/infinities, negative dollars/rates, probabilities outside [0,1], incomplete/reversed ranges, invalid integer counts, unsupported input categories and invalid provider outcomes. UI display formatting uses an em dash for unavailable values. Invalid edits retain the controls so the user can correct them.

Vitest tests include fixed/percentage deductible bases, ACV/RCV and recovery, depreciation, below-deductible losses, limits, explicit coverage/approval, grant caps/conditions, geometry and optional work, annual/Poisson/count probabilities, severity mixtures, pluggable providers, loss/payment accounting, scheduled-replacement survival weighting, premium floors, live composition and invalid/missing inputs. `pnpm test` runs all tests; `pnpm build` type-checks production TypeScript and builds the Vite bundle.

## Historical exposure integration

The historical exposure section now uses a verified local NOAA/Census artifact. See `docs/HAIL_DATA.md` for its separate statistical and geographic methods, source inventory, schema verification, exact coverage gaps and reproducible commands. `src/models/history.ts` computes the area-exposure horizon probabilities and bounds. The existing cost/insurance/fragility/financial calculation engine and scenario settings are unchanged by this integration.

County/ZCTA historical rates describe hail somewhere within a region and must not be substituted for a roof-point rate in this model. The UI labels the conditional roof-damage / insured-claim / replacement and expected financial calculations **experimental** and retains their manually assumed point-hazard settings. Historical MRMS footprints remain modeled estimates, not confirmed ground hail size measurements. Radar uptime is unverified and incomplete files are never counted as zero storms. The current annual area-rate denominator uses 2022–2025, excluding partial 2020 and gapped 2021.

## Exposure metric correction: v2

The published hail exposure percentages now use a single **1.5-inch-or-larger proxy**, exact daily union coverage and annual hit patterns at fixed geographic locations before area averaging. County-anywhere day counts are retained as historical audit information but no longer generate a Poisson probability. The descriptive exposed-days/location/year rate is area-adjusted, and the 1/5/10-year probabilities use whole-calendar-year resampling, not `1 − exp(−county day rate × years)`.

Typical modeled hail size is the unique modal qualifying bin by exclusive geographic area-days, with the largest bin counted once at a location/day. Main-interface sampling bounds, event counts and long methodology text have moved into one disclosure. The actual data support different estimates by county and ZCTA; no scaling correction is applied.

There is no verified residential-location weighting. Estimates are area-weighted, not representative of a typical home or a specified address. Four complete years (2022–2025) do not establish reliable long-range forecasts. Resampling cannot introduce unseen footprint patterns; estimates can understate future exposure outside the short observed support. No qualifying observations or unusable geometry yields null, not zero risk. `docs/HAIL_SPATIAL_AUDIT.md` is the authoritative correction audit. The financial and insurance model implementations are unchanged.
