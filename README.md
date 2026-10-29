# Is Your Roof Ready?

Oklahoma roof education prototype using React, TypeScript, Vite and plain CSS. Existing layout, editable SVG houses, keyboard/pointer reveal and recovery timeline are retained. The calculation engine now separates roof size/cost, claims, physical vulnerability, multi-year risk and expected financial cost.

## Run locally

Use Node.js 22+ and pnpm 11 (the project pins the package manager):

```sh
pnpm install
pnpm dev
```

Open Vite's printed Local URL, normally http://127.0.0.1:5173. Build or test with:

```sh
pnpm test          # Vitest, one complete run
pnpm test:watch    # watch model tests while editing
pnpm build        # production TypeScript check and static bundle
pnpm preview      # serve the production bundle
```

Answers and editable assumptions are browser memory only. There is no backend or policy upload. Verified NOAA MRMS footprint history is bundled for all 77 counties and 696 Oklahoma-intersecting ZCTAs. Supported ZIPs select Census ZCTAs directly; unsupported ZIPs show no data. ZCTAs are geographic approximations, not exact USPS delivery boundaries. No deployment is performed.

## Adjustable assumptions

`src/data/config.ts` is the single source of defaults and adjustable assumptions: unit-cost ranges, slope and complexity, material factors, fragility tables/scales, hazard rates, claims assumptions, grant requirements, premium changes and replacement schedule. On-page expandable controls edit a cloned shared-state configuration. Core home and claim controls remain in their existing sections. Invalid edits show an error and remove estimates until corrected.

- Home → **Roof size and editable local cost ranges**: geometry, labor/material ranges, removal and decking. Low/central/high costs are shown; central costs feed comparison.
- Home → **Editable prototype fragility tables**: selected material's severity rows and lookup scales. No engineering calibration is claimed.
- Insurance → **Hypothetical coverage and approval**: coverage, decision, approved share and completed repairs. Unknown coverage/basis or a pending claim assumes no payment.
- Location exposure → **Historical sources, size categories and limitations**: real MRMS footprint history, coverage gaps, size categories, rate intervals and sources.
- Comparison assumptions → **Experimental roof-point hazard assumptions**: manually assumed point-exposure rates, independent event count, future claim filing/approval probabilities. These are separate from regional history.
- Comparison → **Grant, premium, schedule and storm assumptions**: all grant conditions, requested amount, eligible work, annual premium changes, schedule and shared storm quantile.

Grant defaults to zero until eligibility, approval and funding are all selected. The $10,000 program ceiling and $749 illustrative annual savings are configurable, conditional assumptions. Insurance never automatically pays for all damage. The engine distinguishes initial versus final-potential RCV payments and never double-counts recovery.

## Model architecture

| File | Responsibility |
| --- | --- |
| `src/models/domain.ts` | Typed cost, claim, fragility, hazard, grant and model-provider contracts |
| `src/models/validation.ts` | Pure numeric/category validation |
| `src/models/roofCost.ts` | Footprint-based roof area and low/central/high replacement costs |
| `src/models/insurance.ts` | Explicit approval/coverage, ACV/RCV, deductible and capped payments |
| `src/models/vulnerability.ts` | Editable illustrative tables and validated outcome distribution |
| `src/models/risk.ts` | Stationary multi-severity Poisson risk, Bernoulli helper and independent counts |
| `src/models/financial.ts` | Three alternatives, conditional grants and survival-weighted schedules |
| `src/models/calculations.ts` | Composition adapter used by the existing application |
| `src/components/ModelControls.tsx` | Assumption inputs using the established styling system |
| `src/components/EngineResults.tsx` | Probability distinctions and three-way financial table |
| `src/sections/App.tsx` | Existing layout and shared input state |

`VulnerabilityModel.evaluate` can be implemented by a future published provider. `compare(home, policy, scenario, settings, provider)` accepts an optional provider; risk and financial modules also accept it directly. Li, Porter and Goda (2024) is documented as a future source, with no coefficients copied or fabricated. Category-to-diameter mapping requires validation before importing a continuous published function.

## Interpretation

The selected storm is a hypothetical physical outcome and claim cash-flow calculation. Expected 1/5/10-year costs instead integrate all severity rates, damage branches, future filing and approval chances. Changing only the selected storm does not change expected costs. Historical area exposure is displayed separately from the experimental point-exposure / roof-damage scenario. Regional exposure cannot be interpreted as a roof-point probability. Four separate experimental scenario risks remain: assumed point exposure, physical damage, a positive-payment insured claim, and full replacement.

Keeping the old roof transitions to a new conventional roof after storm replacement or scheduled work. Scheduled work is charged only if still needed. Insurance payouts compensate losses; they are not investment returns. All costs are undiscounted and fragility/hazard inputs remain prototype assumptions.

Read **MODEL_ASSUMPTIONS.md** for all formulas, default values, source classifications and limitations, including climate, aging, independence, uncertain estimates and payment-limit ordering.

## Future static deployment

`pnpm build` produces `dist`. The existing relative Vite base supports a future GitHub Pages subpath and iframe embedding. Publish `dist` when ready; no hosting or external data connection is required for local exploration.

## Historical NOAA/Census pipeline

See **docs/HAIL_DATA.md** for verified source schemas, actual import counts, source provenance, download/import commands, manual download fallback, polygon methods, missing-data rules and limitations. The current static artifact is `public/data/hail-history.json`. No runtime NOAA API request is made. Importing a future compatible data file does not require changing React components.

After activating the documented Python environment:

```sh
pnpm run test:data
pnpm run data:validate
```

The historical annual rate uses complete catalog years 2022–2025. October–December 2020 is partial; a missing 2021 UTC file makes that year gapped and excluded from the rate denominator. Rates count exposure days somewhere in a county/ZCTA, not independent reports or hail at an individual roof. Sampling intervals exclude radar, climate and spatial-assignment uncertainties. No published damage fragility is integrated.

## Corrected ≥1.5-inch exposure model

The current v2 history file replaces the retired county-anywhere Poisson probabilities. Exposure is computed from daily unions and exact annual footprint overlap patterns at fixed locations before county/ZCTA area averaging. There are no residential-location weights, so results are explicitly area-weighted. A one-year estimate and exploratory five-/ten-year projections share the existing three-card layout. Typical hail size is the modal qualifying NOAA bin by exclusive exposed area-days, not the county maximum. Unsupported data show no numerical estimate.

See `docs/HAIL_SPATIAL_AUDIT.md` and `data/metadata/hail-spatial-debug.csv` for the ten-county before/after debugging results and the no-broadcast / true-intersection checks. The financial models are unchanged.

To rebuild after fetching official files, activate the documented Python environment and run:

```sh
python scripts/hail/rebuild_history.py --cache ../../work/hail-cache --work ../../work/hail-rebuild
python scripts/hail/validate_output.py
pnpm test
pnpm run test:data
pnpm build
```

The app rejects the legacy v1 metric. Use the complete rebuild wrapper, not the baseline importer alone. Projections resample complete observed years at fixed locations; they are exploratory and cannot account for unseen spatial patterns, climate changes or residential-location differences. Read the method limitations before interpreting them as personal forecasts.
