"""Create an auditable manifest for manually downloaded original NOAA daily exports.
Does not infer zero days from an absent file or from a spatial/severity-filtered CSV.
"""
import argparse,datetime as dt,gzip,json,re
from pathlib import Path
from import_history import digest

def main():
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);p.add_argument('--start',required=True);p.add_argument('--end',required=True);p.add_argument('--county-file',required=True);p.add_argument('--zcta-file');p.add_argument('--output',type=Path,default=Path('data/metadata/manual-manifest.json'));p.add_argument('--confirm-complete-utc-exports',action='store_true',help='Confirm each provided daily file includes ALL Oklahoma locations, ALL hours and ALL hail-size bins, not a filtered result.');a=p.parse_args()
    if not a.confirm_complete_utc_exports:p.error('Daily file presence alone does not establish coverage. Confirm unfiltered complete UTC-day exports explicitly.')
    dt.date.fromisoformat(a.start);dt.date.fromisoformat(a.end)
    m={'schemaVersion':1,'origin':'manual','retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'period':{'start':a.start,'end':a.end},'catalogUrl':'https://www.ncei.noaa.gov/products/event-footprint-catalog','coverageDeclaration':'User-confirmed complete daily Oklahoma, all sizes >=0.5 in, all hours. Radar uptime not certified.','efc':[],'geography':[],'secondary':[]}
    for file in sorted(a.cache.glob('mrms_hail_data_*.geojson*')):
        match=re.fullmatch(r'mrms_hail_data_(\d{4}-\d\d-\d\d)\.geojson(?:\.gz)?',file.name)
        if not match:continue
        body=gzip.decompress(file.read_bytes()) if file.name.endswith('.gz') else file.read_bytes()
        if not a.start<=match[1]<=str(dt.date.fromisoformat(a.end)+dt.timedelta(days=1)):continue
        m['efc'].append({'date':match[1],'file':file.name,'status':'downloaded','sha256':digest(body),'url':'https://storage.googleapis.com/noaa-ncei-ipg/datasets/event-catalog/hail/'+file.name.removesuffix('.gz')})
    for kind,name in [('county',a.county_file),('zcta',a.zcta_file)]:
        if name:m['geography'].append({'kind':kind,'file':name,'sha256':digest((a.cache/name).read_bytes()),'url':'https://www2.census.gov/geo/tiger/'})
    if not m['efc']:p.error('No original daily NOAA GeoJSON files found; CSVs without polygons are not footprint inputs.')
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(m,indent=2)+'\n');print(a.output)
if __name__=='__main__':main()
