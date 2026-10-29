"""Verified EFC GeoJSON + Census polygons -> static Oklahoma area histories.
See docs/HAIL_DATA.md. Failures are coverage gaps, never implicit zero storms.
"""
import argparse,calendar,csv,datetime as dt,gzip,hashlib,io,json,math,platform,sys,zipfile
from collections import defaultdict
from pathlib import Path
import shapefile
from pyproj import Transformer
from scipy.stats import chi2
from shapely.geometry import shape,mapping,box
from shapely import make_valid,STRtree
from shapely.ops import transform,unary_union
BIN_LOWS=[.5,1,1.5,2,2.5,3,4]
BIN_HIGHS=[.99,1.49,1.99,2.49,2.99,3.99,10]
BIN_LABELS=['0.50–0.99 in','1.00–1.49 in','1.50–1.99 in','2.00–2.49 in','2.50–2.99 in','3.00–3.99 in','4+ in']
def dates(start,end):
    while start<=end:yield start;start+=dt.timedelta(days=1)
def digest(body):return hashlib.sha256(body).hexdigest()
def poisson_interval(count,years):
    if years<=0:return None
    return {'estimate':count/years,'lower95':0 if count==0 else float(chi2.ppf(.025,2*count)/2/years),'upper95':float(chi2.ppf(.975,2*(count+1))/2/years)}
def bin_index(properties):
    if 'hail_min' in properties and 'hail_max' in properties:
        low=float(properties['hail_min']);high=float(properties['hail_max'])
        if (low,high) in [(3.0,3.49),(3.5,3.99)]:return 5
        if low not in BIN_LOWS:raise ValueError('Unsupported hail_min bin')
        index=BIN_LOWS.index(low)
        if abs(high-BIN_HIGHS[index])>.001:raise ValueError('Unsupported hail_max bin; do not infer exact maximum')
        return index
    label=str(properties.get('hail_size_range_in','')).replace(' ','').replace('–','-')
    known={f'{low:g}-{high:g}':n for n,(low,high) in enumerate(zip(BIN_LOWS,BIN_HIGHS))}
    # Old documented string-only exports; geometry is still required.
    for n,(low,high) in enumerate(zip(BIN_LOWS,BIN_HIGHS)):known[f'{low:.2f}-{high:.2f}']=n;known[f'{low:.1f}-{high:.2f}']=n
    known.update({'4+':6,'4.0+':6,'4.00+':6,'3.0-3.49':5,'3.5-3.99':5})
    if label not in known:raise ValueError('Missing or unsupported documented hail-size bin')
    return known[label]
def parse_feature(feature,expected_date=None):
    if feature.get('type')!='Feature':raise ValueError('Expected GeoJSON Feature')
    p=feature.get('properties') or {};day=dt.date.fromisoformat(p['date']);conv=dt.date.fromisoformat(p['convective_day'])
    if expected_date and day!=expected_date:raise ValueError('Feature UTC date differs from daily file date')
    hour=str(p['hour_utc']).zfill(4)
    if len(hour)!=4 or not hour.isdigit() or int(hour[:2])>23 or int(hour[2:])>59:raise ValueError('Invalid hour_utc')
    calculated=day-dt.timedelta(days=1) if int(hour)<1200 else day
    if calculated!=conv:raise ValueError('convective_day disagrees with NOAA 12Z convention')
    if p.get('source')!='MRMS':raise ValueError('Hail source must be MRMS')
    geom=feature.get('geometry')
    if not geom or geom.get('type') not in ('Polygon','MultiPolygon'):raise ValueError('Polygon or MultiPolygon geometry required; tabular CSV cannot stand in for a footprint')
    coords=[]
    def walk(value):
        if not isinstance(value,list):raise ValueError('Invalid coordinates')
        if value and isinstance(value[0],(int,float)):
            if len(value)<2 or not all(math.isfinite(v) for v in value[:2]) or not -180<=value[0]<=180 or not -90<=value[1]<=90:raise ValueError('Invalid WGS84 coordinates')
            coords.append(value[:2])
        else:
            for item in value:walk(item)
    walk(geom['coordinates'])
    if not coords:raise ValueError('Empty polygon')
    bounds=(min(c[0] for c in coords),min(c[1] for c in coords),max(c[0] for c in coords),max(c[1] for c in coords))
    return conv,bin_index(p),geom,bounds

def record_hit(days,day,index):
    days[day]=days.get(day,0)|(1<<index)
def covered_convective_days(valid_utc,start,end):
    return {day for day in dates(start,end) if day in valid_utc and day+dt.timedelta(days=1) in valid_utc}
def positive_area_intersection(a,b):
    return a.intersects(b) and a.intersection(b).area>0

def records_from_zip(path):
    with zipfile.ZipFile(path) as z:
        stem=next(n[:-4] for n in z.namelist() if n.endswith('.shp'))
        reader=shapefile.Reader(shp=io.BytesIO(z.read(stem+'.shp')),shx=io.BytesIO(z.read(stem+'.shx')),dbf=io.BytesIO(z.read(stem+'.dbf')))
        for rec in reader.iterShapeRecords():yield rec.record.as_dict(),rec.shape

def geography(cache,metadata):
    project=Transformer.from_crs('EPSG:4269','EPSG:4326',always_xy=True).transform
    equal_area=Transformer.from_crs('EPSG:4326','EPSG:5070',always_xy=True).transform
    counties=[];units=[]
    county_source=next(item for item in metadata if item['kind']=='county')
    for p,s in records_from_zip(cache/county_source['file']):
        if p['STATEFP']!='40':continue
        geom=make_valid(transform(project,shape(s.__geo_interface__)))
        row={'id':p['GEOID'],'kind':'county','name':p['NAME'],'countyAssignments':[],'oklahomaAreaFraction':1,'geom':geom}
        counties.append(row);units.append(row)
    if len(counties)!=77:raise ValueError(f'Expected all 77 Oklahoma counties; found {len(counties)}')
    state=unary_union([row['geom'] for row in counties]);tree=STRtree([row['geom'] for row in counties])
    zcta_source=next((item for item in metadata if item['kind']=='zcta'),None)
    if zcta_source:
        for p,s in records_from_zip(cache/zcta_source['file']):
            # Bbox rejection before constructing thousands of nationwide polygons.
            if not box(*s.bbox).intersects(state.envelope):continue
            geom=make_valid(transform(project,shape(s.__geo_interface__)))
            if not geom.intersects(state):continue
            clipped=geom.intersection(state)
            if clipped.area<=0:continue
            clipped_area=transform(equal_area,clipped).area
            if clipped_area<1:continue
            assignments=[]
            for index in tree.query(clipped,predicate='intersects'):
                county=counties[index];overlap=clipped.intersection(county['geom']);area=transform(equal_area,overlap).area
                if area>1:assignments.append({'geoid':county['id'],'name':county['name'],'areaShare':area/clipped_area})
            assignments.sort(key=lambda r:(-r['areaShare'],r['geoid']))
            units.append({'id':p['ZCTA5CE20'],'kind':'zcta','name':p['ZCTA5CE20'],'countyAssignments':assignments,'oklahomaAreaFraction':min(1,clipped_area/transform(equal_area,geom).area),'geom':clipped})
    return units,state

def summarize(unit,daily,start,end,covered_days):
    years=[]
    for year in range(start.year,end.year+1):
        selected=set(dates(max(start,dt.date(year,1,1)),min(end,dt.date(year,12,31))))
        coverage=selected&covered_days;hits={day:mask for day,mask in daily.items() if day.year==year}
        full_calendar=len(selected)==(366 if calendar.isleap(year) else 365)
        status='complete' if full_calendar and coverage==selected else 'partial' if not full_calendar else 'gapped' if coverage else 'missing'
        years.append({'year':year,'status':status,'expectedDays':len(selected),'coveredDays':len(coverage),'missingDays':len(selected-coverage),'recordedExposureDays':len(hits) if coverage or hits else None})
    complete=[row['year'] for row in years if row['status']=='complete']
    used={day:mask for day,mask in daily.items() if day.year in complete}
    rate=poisson_interval(len(used),len(complete)) if len(complete)>=2 else None
    if rate:rate.update({'completeYears':complete,'exposureDaysUsed':len(used),'confidenceLevel':.95,'method':'Poisson Garwood sampling interval; independent exposure-day assumption'})
    counts=[sum(bool(mask&(1<<index)) for mask in daily.values()) for index in range(len(BIN_LOWS))]
    max_bins=[sum(mask.bit_length()-1==index for mask in daily.values()) for index in range(len(BIN_LOWS))]
    largest=max((mask.bit_length()-1 for mask in daily.values()),default=None)
    any_coverage=bool(covered_days) or bool(daily)
    return {key:value for key,value in unit.items() if key!='geom'}|{
        'status':'available' if any_coverage else 'unavailable',
        'recordedExposureDays':len(daily) if any_coverage else None,
        'yearsWithObservedExposure':len({day.year for day in daily}) if any_coverage else None,
        'sizeCategories':[{'id':str(index),'label':BIN_LABELS[index],'lowerIn':BIN_LOWS[index],'upperIn':None if index==len(BIN_LOWS)-1 else BIN_HIGHS[index],'exposureDays':counts[index] if any_coverage else None,'maxDailySeverityDays':max_bins[index] if any_coverage else None} for index in range(len(BIN_LOWS))],
        'largestModeledHail':None if largest is None else {'category':BIN_LABELS[largest],'lowerIn':BIN_LOWS[largest],'upperIn':None if largest==len(BIN_LOWS)-1 else BIN_HIGHS[largest],'exactIn':None},
        'years':years,'annualExposureRate':rate,
    }

def secondary_reports(cache,sources,start,end):
    by_county=defaultdict(lambda:{'days':set(),'events':set(),'largestReportedIn':None});schema=None
    required={'STATE_FIPS','CZ_TYPE','CZ_FIPS','EVENT_TYPE','EVENT_ID','EPISODE_ID','BEGIN_DATE_TIME','MAGNITUDE'}
    for source in sources:
        with gzip.open(cache/source['file'],'rt',newline='') as stream:
            reader=csv.DictReader(stream);schema=reader.fieldnames
            if not required.issubset(reader.fieldnames or []):raise ValueError('Storm Events details CSV schema changed')
            for row in reader:
                if row['STATE_FIPS']!='40' or row['CZ_TYPE']!='C' or row['EVENT_TYPE']!='Hail':continue
                day=dt.datetime.strptime(row['BEGIN_DATE_TIME'],'%d-%b-%y %H:%M:%S').date()
                if not start<=day<=end:continue
                geoid='40'+row['CZ_FIPS'].zfill(3);item=by_county[geoid];item['days'].add(day.isoformat());item['events'].add(row['EVENT_ID'])
                if row['MAGNITUDE']:
                    value=float(row['MAGNITUDE'])
                    if value>0:item['largestReportedIn']=max(item['largestReportedIn'] or 0,value)
    return {key:{'reportedCalendarDays':len(row['days']),'distinctReportIds':len(row['events']),'largestReportedIn':row['largestReportedIn']} for key,row in by_county.items()},schema

def build(cache,manifest,output,audit):
    start=dt.date.fromisoformat(manifest['period']['start']);end=dt.date.fromisoformat(manifest['period']['end'])
    for source in manifest['geography']+manifest.get('secondary',[]):
        if digest((cache/source['file']).read_bytes())!=source['sha256']:raise ValueError(f"Checksum mismatch: {source['file']}")
    units,state=geography(cache,manifest['geography']);tree=STRtree([row['geom'] for row in units]);bbox=state.envelope
    all_days=defaultdict(dict);valid_utc=set();failures=[];feature_count=0;intersecting=0;repaired=0
    for n,source in enumerate(manifest['efc'],1):
        utc=dt.date.fromisoformat(source['date']);local=defaultdict(dict)
        try:
            if source['status']!='downloaded':raise ValueError(source.get('error','Source unavailable'))
            body=gzip.decompress((cache/source['file']).read_bytes()) if source['file'].endswith('.gz') else (cache/source['file']).read_bytes()
            if digest(body)!=source['sha256']:raise ValueError('Raw source checksum mismatch')
            collection=json.loads(body)
            if collection.get('type')!='FeatureCollection' or not isinstance(collection.get('features'),list):raise ValueError('Expected GeoJSON FeatureCollection with features array')
            for feature in collection['features']:
                day,index,geometry_json,bounds=parse_feature(feature,utc);feature_count+=1
                if not start<=day<=end or not box(*bounds).intersects(bbox):continue
                geom=shape(geometry_json)
                if not geom.is_valid:geom=make_valid(geom);repaired+=1
                if geom.is_empty:raise ValueError('Invalid empty geometry after repair')
                for target in tree.query(geom,predicate='intersects'):
                    if not positive_area_intersection(geom,units[target]['geom']):continue
                    intersecting+=1;key=(units[target]['kind'],units[target]['id']);record_hit(local[key],day,index)
            valid_utc.add(utc)
            for key,days in local.items():
                for day,mask in days.items():all_days[key][day]=all_days[key].get(day,0)|mask
        except Exception as e:failures.append({'date':source['date'],'file':source['file'],'error':str(e)})
        if n%200==0:print(f'Spatially validated {n}/{len(manifest["efc"])} daily files',flush=True)
    # Each convective day spans parts of two UTC files. Both must be verified.
    covered=covered_convective_days(valid_utc,start,end)
    missing=[day.isoformat() for day in dates(start,end) if day not in covered]
    sed,sed_schema=secondary_reports(cache,manifest.get('secondary',[]),start,end)
    counties={};zctas={}
    for unit in units:
        summary=summarize(unit,all_days[(unit['kind'],unit['id'])],start,end,covered)
        if unit['kind']=='county':summary['secondaryReports']=sed.get(unit['id']);counties[unit['name']]=summary
        else:zctas[unit['id']]=summary
    payload={'schemaVersion':1,'status':'verified-import' if manifest.get('origin','download')=='download' else 'manual-import','generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'period':manifest['period'],
      'sources':[{'name':'NOAA Event Footprint Catalog / MRMS','url':manifest['catalogUrl'],'quality':'Published modeled data'},{'name':'NOAA Storm Events Database · supplemental reports','url':'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/','quality':'Observed data'}]+[{'name':'US Census '+row['kind'],'url':row['url'],'quality':'Observed geography'} for row in manifest['geography']],
      'provenance':{'sourceManifestSha256':digest(json.dumps(manifest,sort_keys=True).encode()),'rawFeatureCount':feature_count,'positiveAreaIntersections':intersecting,'repairedPolygonCount':repaired,'pythonVersion':platform.python_version()},
      'method':{'spatial':'positive-area polygon intersection; counties and Oklahoma-clipped ZCTAs; no address or point probability','timeUnit':'convective day, 12:00 UTC to next 11:59 UTC','severityThresholdIn':.5,'denominator':'Only full calendar years with both UTC source files verified for every convective day; at least two complete years required','missing':'Absent, failed or invalid daily files are unknown, not zero hail. File availability does not certify radar uptime.','uncertainty':'95% Poisson Garwood interval on exposure-day counts; excludes radar, climate and spatial-assignment uncertainty','zcta':'Exposure uses all Oklahoma portions of a ZCTA. Largest equal-area county overlap is context only, never the exposure assignment.'},
      'coverage':{'verifiedUtcFiles':len(valid_utc),'requestedConvectiveDays':(end-start).days+1,'coveredConvectiveDays':len(covered),'missingConvectiveDates':missing,'failedFiles':failures,'radarUptimeVerified':False},'counties':dict(sorted(counties.items())),'zctas':dict(sorted(zctas.items()))}
    from validate_output import validate
    validate(payload,json.loads(Path('data/hail-history.schema.json').read_text()))
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(payload,separators=(',',':'),allow_nan=False)+'\n')
    audit.parent.mkdir(parents=True,exist_ok=True)
    with gzip.open(audit,'wt',newline='') as f:
        writer=csv.writer(f);writer.writerow(['kind','geoid','convective_day','size_bin_bitmask','max_size_bin'])
        for (kind,geoid),days in sorted(all_days.items()):
            for day,mask in sorted(days.items()):writer.writerow([kind,geoid,day.isoformat(),mask,mask.bit_length()-1])
    print(json.dumps({'output':str(output),'counties':len(counties),'zctas':len(zctas),'verifiedUtcFiles':len(valid_utc),'missingConvectiveDays':len(missing),'failedFiles':len(failures),'sedHeader':sed_schema}),flush=True)
    return payload

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--cache',type=Path,required=True);ap.add_argument('--manifest',type=Path,default=Path('data/metadata/source-manifest.json'));ap.add_argument('--output',type=Path,default=Path('public/data/hail-history.json'));ap.add_argument('--audit',type=Path,default=Path('data/metadata/location-days.csv.gz'));a=ap.parse_args();build(a.cache,json.loads(a.manifest.read_text()),a.output,a.audit)
if __name__=='__main__':main()
