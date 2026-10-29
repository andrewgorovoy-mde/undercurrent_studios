"""Spatial audit and fixed-location exposure calculation. No county-wide event-rate shortcut.
Stage --audit-only never changes the application artifact. --apply adds verified
area-weighted 1.5+ inch footprint statistics to the existing historical output.
"""
import argparse,collections,datetime as dt,gzip,hashlib,itertools,json,math,sqlite3
from pathlib import Path
from pyproj import Transformer,CRS
from shapely import STRtree,from_wkb,to_wkb,make_valid
from shapely.geometry import shape,box,GeometryCollection
from shapely.ops import transform,unary_union
from import_history import parse_feature,geography,records_from_zip,digest,BIN_LOWS,BIN_LABELS
AUDIT_COUNTIES=['Oklahoma','Tulsa','Cleveland','Murray','Texas','Cimarron','Comanche','Garfield','McCurtain','Canadian']
THRESHOLD=1.5
METHOD_VERSION='fixed-location-footprint-year-v1'

def union_footprints(geoms):
    return unary_union(geoms) if geoms else GeometryCollection()

def exclusive_qualifying_footprints(by_bin):
    """Highest modeled bin wins once at each location/day, above the fixed threshold."""
    exclusive={};higher=GeometryCollection()
    for size in sorted((i for i in by_bin if BIN_LOWS[i]>=THRESHOLD),reverse=True):
        exclusive[size]=by_bin[size].difference(higher)
        higher=union_footprints([higher,by_bin[size]])
    return exclusive

def area_fractions_by_year_pattern(region,annual_geoms):
    """Exact polygon partition: each location retains its own annual hit pattern.
    No centroid substitution, grid sampling or uniform county-average rate.
    """
    if region.is_empty or region.area<=0:raise ValueError('Positive regional area required')
    cells={0:region}
    for year_index,annual in enumerate(annual_geoms):
        if annual.is_empty:continue
        next_cells={}
        for mask,geom in cells.items():
            inside=geom.intersection(annual);outside=geom.difference(annual)
            if outside.area>0:next_cells[mask]=outside
            if inside.area>0:next_cells[mask|(1<<year_index)]=inside
        cells=next_cells
    weights=[0.0]*(1<<len(annual_geoms))
    for mask,geom in cells.items():weights[mask]=geom.area/region.area
    if not math.isclose(sum(weights),1,rel_tol=1e-7,abs_tol=1e-8):raise ValueError(f'Spatial pattern areas do not partition region: sum={sum(weights):.12g}, area={region.area:.12g} m2')
    return weights

def projection_from_patterns(weights,years,horizon,year_counts=None):
    if years<1 or horizon<1:raise ValueError('Positive year count and horizon required')
    if len(weights)!=(1<<years):raise ValueError('Spatial pattern vector has the wrong length')
    if any(not math.isfinite(w) or w<0 for w in weights) or not math.isclose(sum(weights),1,abs_tol=1e-7):raise ValueError('Invalid area weights')
    if year_counts is not None and (len(year_counts)!=years or sum(year_counts)!=years):raise ValueError('Invalid year bootstrap multiplicities')
    probability=0
    for mask,weight in enumerate(weights):
        hit_years=mask.bit_count() if year_counts is None else sum(n for index,n in enumerate(year_counts) if mask&(1<<index))
        p=hit_years/years
        probability+=weight*(1-(1-p)**horizon)
    return probability

def compositions(total,parts):
    if parts==1:yield (total,);return
    for first in range(total+1):
        for rest in compositions(total-first,parts-1):yield (first,)+rest

def weighted_quantile(values,quantile):
    cumulative=0
    for value,weight in sorted(values):
        cumulative+=weight
        if cumulative>=quantile-1e-12:return value
    return max(value for value,_ in values)

def project_with_year_bootstrap(weights,years,horizon):
    central=projection_from_patterns(weights,years,horizon)
    samples=[]
    # Exact whole-year bootstrap for the current short record. A fixed seed,
    # 4096 resamples bounds runtime if future imports provide >7 years.
    if years<=7:
        for counts in compositions(years,years):
            mass=math.factorial(years)/math.prod(math.factorial(n) for n in counts)/years**years
            samples.append((projection_from_patterns(weights,years,horizon,counts),mass))
    else:
        import random
        rng=random.Random(0)
        for _ in range(4096):
            counts=[0]*years
            for _ in range(years):counts[rng.randrange(years)]+=1
            samples.append((projection_from_patterns(weights,years,horizon,counts),1/4096))
    return {'central':central,'lower95':min(central,weighted_quantile(samples,.025)),'upper95':max(central,weighted_quantile(samples,.975)),
            'interpretation':'Empirical annual footprint-year resampling; exploratory, not a validated property forecast'}

def check_crs(cache,manifest):
    import zipfile
    result=[]
    for source in manifest['geography']:
        with zipfile.ZipFile(cache/source['file']) as z:
            prj=z.read(next(n for n in z.namelist() if n.endswith('.prj'))).decode()
        code=CRS.from_wkt(prj).to_epsg()
        if code!=4269:raise ValueError('Unexpected Census CRS; transformation must be reviewed')
        result.append({'kind':source['kind'],'sourceCrs':code,'intersectionCrs':5070,'areaUnits':'square meters'})
    return result

def extract(cache,manifest,db_path):
    """Independent equal-area geographic audit, including original .5+ day counts."""
    fingerprint=digest(json.dumps(manifest,sort_keys=True).encode())
    if db_path.exists():
        con=sqlite3.connect(db_path)
        try:
            old=json.loads(con.execute('select value from metadata where key="audit"').fetchone()[0])
            if old['manifestSha256']==fingerprint and old['methodVersion']==METHOD_VERSION:
                con.close();return old
        except (sqlite3.Error,TypeError,KeyError):pass
        con.close();raise ValueError('Audit cache differs from inputs/version. Use a new --work directory.')
    db_path.parent.mkdir(parents=True,exist_ok=True)
    units,state=geography(cache,manifest['geography']);counties=[u for u in units if u['kind']=='county']
    project=Transformer.from_crs(4326,5070,always_xy=True).transform
    county_shapes=[transform(project,c['geom']) for c in counties];tree=STRtree(county_shapes)
    con=sqlite3.connect(db_path);con.executescript('create table footprints(day text,bin integer,geom blob);create index day_idx on footprints(day);create table metadata(key text primary key,value text);')
    audit={'methodVersion':METHOD_VERSION,'manifestSha256':fingerprint,'crs':check_crs(cache,manifest),'rawFeatures':0,'bboxCandidates':0,'positiveAreaIntersections':0,'bboxOnlyRejected':0,'boundaryOnlyRejected':0,'invalidHailGeometries':0,'invalidCountyGeometries':sum(not g.is_valid for g in county_shapes),'invalidFiles':[],
           'countyDays':{c['name']:{} for c in counties},'countyAreaKm2':{c['name']:g.area/1e6 for c,g in zip(counties,county_shapes)}}
    start=dt.date.fromisoformat(manifest['period']['start']);end=dt.date.fromisoformat(manifest['period']['end'])
    for n,source in enumerate(manifest['efc'],1):
        try:
            body=gzip.decompress((cache/source['file']).read_bytes())
            if digest(body)!=source['sha256']:raise ValueError('Checksum mismatch')
            local_rows=[];local_hits=collections.defaultdict(dict)
            for f in json.loads(body)['features']:
                day,index,geom_json,bounds=parse_feature(f,dt.date.fromisoformat(source['date']));audit['rawFeatures']+=1
                if not start<=day<=end or not box(*bounds).intersects(state.envelope):continue
                raw=shape(geom_json)
                if not raw.is_valid:audit['invalidHailGeometries']+=1;raw=make_valid(raw)
                geom=transform(project,raw);candidates=tree.query(geom);audit['bboxCandidates']+=len(candidates);positive=False
                for target in candidates:
                    county_geom=county_shapes[target]
                    if not geom.intersects(county_geom):audit['bboxOnlyRejected']+=1;continue
                    if geom.intersection(county_geom).area<=0:audit['boundaryOnlyRejected']+=1;continue
                    audit['positiveAreaIntersections']+=1;positive=True
                    name=counties[target]['name'];key=day.isoformat();local_hits[name][key]=local_hits[name].get(key,0)|(1<<index)
                if positive and BIN_LOWS[index]>=THRESHOLD:local_rows.append((day.isoformat(),index,sqlite3.Binary(to_wkb(geom))))
            con.executemany('insert into footprints values(?,?,?)',local_rows)
            for name,hits in local_hits.items():
                for day,mask in hits.items():audit['countyDays'][name][day]=audit['countyDays'][name].get(day,0)|mask
            con.commit()
        except Exception as e:audit['invalidFiles'].append({'date':source['date'],'error':str(e)})
        if n%200==0:print(f'Independent spatial audit {n}/{len(manifest["efc"])} files',flush=True)
    if audit['invalidFiles']:con.close();raise ValueError(f'Audit found invalid files: {audit["invalidFiles"][:3]}; do not apply results')
    con.execute('insert into metadata values(?,?)',('audit',json.dumps(audit)));con.commit();con.close();return audit

def apply_spatial_quality_policy(exposure,kind,geoid,audit):
    """A repaired invalid source boundary is not a verified property support area.
    Preserve recorded detections, but withhold numerical estimates pending review.
    No probability is scaled, replaced by zero, or inherited from another county.
    """
    if any(r['kind']==kind and r['id']==geoid for r in audit.get('projectedAreaRepairs',[])):
        exposure=dict(exposure)
        exposure['unavailableReason']='The Oklahoma boundary fragment requires topology repair after projection; no verified residential spatial support is available.'
        exposure['probabilities']=None;exposure['typicalHailSize']=None;exposure['annualExposureDaysRate']=None
    return exposure

def build_statistics(cache,manifest,history,work,only_counties=None):
    db=work/'footprints.sqlite';audit=extract(cache,manifest,db)
    mismatches=[]
    for name,row in history['counties'].items():
        actual=len(audit['countyDays'][name]);expected=row['recordedExposureDays']
        if actual!=expected:mismatches.append({'county':name,'oldDays':expected,'recomputedEqualAreaDays':actual})
    audit['oldDayCountMismatches']=mismatches
    audit['distinctCountyCountTotals']=len({len(days) for days in audit['countyDays'].values()})
    if mismatches:raise ValueError(f'Geographic audit differs from previous assignments: {mismatches}; investigate before changing application')
    units,_=geography(cache,manifest['geography'])
    if only_counties:units=[u for u in units if u['kind']=='county' and u['name'] in only_counties]
    project=Transformer.from_crs(4326,5070,always_xy=True).transform
    geoms=[];audit['projectedAreaRepairs']=[]
    for u in units:
        raw=transform(project,u['geom']);geom=raw
        if not raw.is_valid:
            geom=make_valid(raw)
            audit['projectedAreaRepairs'].append({'kind':u['kind'],'id':u['id'],'areaBeforeM2':raw.area,'areaAfterM2':geom.area})
        if geom.is_empty or geom.area<=0:raise ValueError(f"No usable projected area for {u['id']}")
        geoms.append(geom)
    tree=STRtree(geoms)
    # The original artifact contains validated paired-file observation coverage.
    complete=[y['year'] for y in next(iter(history['counties'].values()))['years'] if y['status']=='complete']
    if len(complete)>12:raise ValueError('Exact spatial-pattern partition for >12 years needs a new scalable implementation')
    metrics=[{'dailyArea':{},'binAreaDays':[0.0]*7,'yearPieces':{year:[] for year in complete}} for _ in units]
    con=sqlite3.connect(db);days=[r[0] for r in con.execute('select distinct day from footprints order by day')]
    for day_count,day in enumerate(days,1):
        year=int(day[:4]);source=collections.defaultdict(list)
        for size,wkb in con.execute('select bin,geom from footprints where day=?',(day,)):source[size].append(from_wkb(wkb))
        by_bin={size:union_footprints(shapes) for size,shapes in source.items()}
        daily=union_footprints(list(by_bin.values()))
        # Higher modeled size wins at each location/day, once, across ALL hours.
        exclusive=exclusive_qualifying_footprints(by_bin)
        for index in tree.query(daily,predicate='intersects'):
            clip=daily.intersection(geoms[index]);area=clip.area
            if area<=0:continue
            m=metrics[index];m['dailyArea'][day]=area
            if year in complete:
                m['yearPieces'][year].append(clip)
                for size,geom in exclusive.items():
                    if not geom.is_empty:m['binAreaDays'][size]+=geom.intersection(geoms[index]).area
        if day_count%100==0:print(f'Dissolved and measured {day_count}/{len(days)} qualifying convective days',flush=True)
    con.close();result={}
    for n,(u,region,m) in enumerate(zip(units,geoms,metrics),1):
        annual=[union_footprints(m['yearPieces'][year]) for year in complete]
        unavailable_reason=None
        try:weights=area_fractions_by_year_pattern(region,annual)
        except ValueError as error:
            if u['kind']=='county':raise ValueError(f"{u['name']}: {error}") from error
            weights=None;unavailable_reason=str(error)
            audit.setdefault('unusableSpatialPartitions',[]).append({'kind':u['kind'],'id':u['id'],'reason':str(error)})
        valid_areas=[a for day,a in m['dailyArea'].items() if int(day[:4]) in complete]
        days_by_year={str(year):sum(int(day[:4])==year for day in m['dailyArea']) for year in complete}
        totals=sum(valid_areas);bins=m['binAreaDays'];mode=max(range(7),key=lambda i:bins[i])
        modal_ties=[i for i,value in enumerate(bins) if value>0 and math.isclose(value,bins[mode],rel_tol=1e-9,abs_tol=1e-6)]
        qualified=bool(totals>0 and len(complete)>=2 and weights is not None)
        result[(u['kind'],u['id'])]={
            'thresholdIn':THRESHOLD,'weighting':'area','unavailableReason':unavailable_reason,'locationInterpretation':'Uniformly sampled fixed geographic location within the county or Oklahoma-clipped ZCTA; not a typical home or address estimate',
            'completeYears':complete,'qualifyingRecordedDays':len(m['dailyArea']),
            'qualifyingDaysInCompleteYears':len(valid_areas),'qualifyingDaysByYear':days_by_year,
            'meanDailyCoverageFraction':sum(valid_areas)/len(valid_areas)/region.area if valid_areas else None,
            'annualExposureDaysRate':totals/region.area/len(complete) if complete and weights is not None else None,
            'annualHitAreaFractions':[g.area/region.area for g in annual],
            'locationYearPatternAreaFractions':weights,
            'probabilities':{str(t):project_with_year_bootstrap(weights,len(complete),t) for t in [1,5,10]} if qualified else None,
            'typicalHailSize':{'id':str(mode),'label':BIN_LABELS[mode],'areaExposureDayShare':bins[mode]/sum(bins)} if qualified and len(modal_ties)==1 else None,
            'sizeAreaExposureDays':[value/region.area for value in bins],
            'model':'Empirical complete-year footprint blocks; exposure evaluated at fixed geographic locations before area aggregation. Years resampled independently with replacement.',
            'limitations':'Only a short observed footprint-year record. Unhit locations are not known to have zero future risk. Year resampling cannot introduce unseen spatial patterns. Bootstrap bounds omit radar, climate and housing-location uncertainty. 5- and 10-year values are exploratory.',
        }
        result[(u['kind'],u['id'])]=apply_spatial_quality_policy(result[(u['kind'],u['id'])],u['kind'],u['id'],audit)
        if n%100==0:print(f'Fixed-location annual pattern calculations {n}/{len(units)} areas',flush=True)
    return result,audit

def audit_rows(history,stats,audit):
    rows=[]
    for name in AUDIT_COUNTIES:
        old=history['counties'][name];r=stats[('county',old['id'])]
        rows.append({'county':name,'recordedHailDays05In':old['recordedExposureDays'],'recordedHailDays15In':r['qualifyingRecordedDays'],'qualifyingDaysCompleteYears':r['qualifyingDaysInCompleteYears'],
          'meanCoveragePerQualifyingDayPercent':None if r['meanDailyCoverageFraction'] is None else 100*r['meanDailyCoverageFraction'],
          'areaWeightedExposureDaysPerYear':r['annualExposureDaysRate'],'probabilities':r['probabilities'],'typicalHailSize':r['typicalHailSize'],'completeYears':r['completeYears']})
    return rows

def main():
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--manifest',type=Path,default=Path('data/metadata/source-manifest.json'));p.add_argument('--history',type=Path,default=Path('public/data/hail-history.json'));p.add_argument('--apply',action='store_true');a=p.parse_args()
    history=json.loads(a.history.read_text());manifest=json.loads(a.manifest.read_text())
    stats,audit=build_statistics(a.cache,manifest,history,a.work,None if a.apply else AUDIT_COUNTIES)
    rows=audit_rows(history,stats,audit)
    # Retain the audit separately; no application update without --apply.
    report={'thresholdIn':THRESHOLD,'weighting':'area; no verified residential-location weights available','geographicAudit':{k:v for k,v in audit.items() if k!='countyDays'},'rows':rows}
    a.work.mkdir(parents=True,exist_ok=True);(a.work/'debugging-results.json').write_text(json.dumps(report,indent=2)+'\n')
    for row in rows:print(json.dumps(row),flush=True)
    if a.apply:
        for group in ['counties','zctas']:
            for row in history[group].values():
                row['propertyExposure']=stats[(row['kind'],row['id'])]
                row['annualExposureRate']=None # Deprecated county-anywhere rate must never drive probabilities.
        history['schemaVersion']=2
        history['generatedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
        history['method']['severityThresholdIn']=THRESHOLD
        history['method']['uncertainty']='Whole observed calendar years resampled at fixed geographic locations; bootstrap sampling bounds, not a comprehensive predictive interval'
        history['method']['propertyExposure']='1.5+ inches; daily footprint union in EPSG:5070; exact annual spatial-pattern partition; area-weighted, not residentially weighted; no Poisson conversion of county-wide event counts'
        history['provenance']['spatialExposureMethod']=METHOD_VERSION
        from validate_output import validate
        (a.work/'candidate-history.json').write_text(json.dumps(history,separators=(',',':'),allow_nan=False)+'\n')
        validate(history,json.loads(Path('data/hail-history.schema.json').read_text()))
        temporary=a.history.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(history,separators=(',',':'),allow_nan=False)+'\n');temporary.replace(a.history)
if __name__=='__main__':main()
