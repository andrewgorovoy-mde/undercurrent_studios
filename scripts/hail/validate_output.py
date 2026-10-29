import argparse,json
from pathlib import Path
from jsonschema import Draft202012Validator,FormatChecker

def validate(payload,schema):
    Draft202012Validator(schema,format_checker=FormatChecker()).validate(payload)
    for name,row in list(payload['counties'].items())+list(payload['zctas'].items()):
        if row['kind']=='county' and not row['id'].startswith('40'):raise ValueError('Non-Oklahoma county')
        for year in row['years']:
            if year['coveredDays']+year['missingDays']!=year['expectedDays']:raise ValueError(f'{name}: coverage arithmetic mismatch')
            if year['recordedExposureDays'] is not None and year['recordedExposureDays']>year['expectedDays']:raise ValueError(f'{name}: exposure days exceed calendar days')
        rate=row['annualExposureRate']
        if rate:
            full=[year['year'] for year in row['years'] if year['status']=='complete']
            if rate['completeYears']!=full:raise ValueError(f'{name}: incomplete year included in rate')
            if not rate['lower95']<=rate['estimate']<=rate['upper95']:raise ValueError('Invalid confidence interval')
            if abs(rate['estimate']-rate['exposureDaysUsed']/len(full))>1e-9:raise ValueError('Incorrect rate denominator')
        if row['recordedExposureDays'] is not None and sum(c['maxDailySeverityDays'] for c in row['sizeCategories'])!=row['recordedExposureDays']:raise ValueError('Duplicate exposure days in exclusive maximum categories')
        if row['status']=='unavailable' and (row['recordedExposureDays'] is not None or rate is not None):raise ValueError('Missing data treated as zero')
    if payload['schemaVersion']==2:
        for row in list(payload['counties'].values())+list(payload['zctas'].values()):
            e=row['propertyExposure'];years=[y['year'] for y in row['years'] if y['status']=='complete'];n=len(years)
            if e['completeYears']!=years:raise ValueError('Spatial exposure includes incomplete calendar years')
            weights=e['locationYearPatternAreaFractions']
            if weights is None:
                if e['probabilities'] is not None:raise ValueError('Unusable spatial geometry cannot produce probabilities')
            elif len(weights)!=(1<<n) or abs(sum(weights)-1)>1e-7:raise ValueError('Spatial patterns must partition geographic area')
            if e['sizeAreaExposureDays'][0]!=0 or e['sizeAreaExposureDays'][1]!=0:raise ValueError('Sub-1.5-inch hail entered qualifying exposure')
            if e['probabilities'] is not None:
                if n<2 or e['qualifyingDaysInCompleteYears']==0:raise ValueError('Unsupported numerical probabilities')
                previous=0
                for horizon in [1,5,10]:
                    p=e['probabilities'][str(horizon)];expected=sum(w*(1-(1-mask.bit_count()/n)**horizon) for mask,w in enumerate(weights))
                    if abs(p['central']-expected)>1e-8 or not p['lower95']<=p['central']<=p['upper95'] or p['central']<previous:raise ValueError('Invalid fixed-location exposure projection')
                    previous=p['central']
                if e['probabilities']['1']['central']>e['annualExposureDaysRate']+1e-7:raise ValueError('Annual probability exceeds expected distinct exposed days')
    return True
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('file',type=Path,nargs='?',default=Path('public/data/hail-history.json'));a=p.parse_args();payload=json.loads(a.file.read_text());validate(payload,json.loads(Path('data/hail-history.schema.json').read_text()));print(f"Validated {len(payload['counties'])} counties, {len(payload['zctas'])} ZCTAs")
