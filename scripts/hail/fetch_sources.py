"""Download documented NOAA/Census objects, discover names via official inventories.
No NOAA application API is guessed. GCS XML listing is the public object-storage
protocol for the bucket linked from the EFC product page. Resume with --cache.
"""
import argparse,concurrent.futures,datetime as dt,gzip,hashlib,json,re,time,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
BUCKET='https://storage.googleapis.com/noaa-ncei-ipg'
PREFIX='datasets/event-catalog/hail/'
NS={'s':'http://doc.s3.amazonaws.com/2006-03-01'}
def read(url):
    last=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=90) as r:return r.read(),dict(r.headers)
        except Exception as e:last=e;time.sleep(attempt+1)
    raise RuntimeError(f'{url}: {last}')
def inventory():
    result=[];marker=''
    while True:
        body,_=read(BUCKET+'?'+urllib.parse.urlencode({'prefix':PREFIX,'marker':marker}))
        root=ET.fromstring(body)
        for item in root.findall('s:Contents',NS):
            result.append({k:item.findtext('s:'+v,namespaces=NS) for k,v in [('key','Key'),('bytes','Size'),('etag','ETag'),('generation','Generation')]})
        if root.findtext('s:IsTruncated',namespaces=NS)!='true':return result
        marker=root.findtext('s:NextMarker',namespaces=NS) or result[-1]['key']
def cached(url,path,expected=None):
    if path.exists():
        body=gzip.decompress(path.read_bytes()) if path.name.endswith('.geojson.gz') else path.read_bytes()
        if expected is not None and len(body)!=int(expected):raise ValueError(f'Cached size mismatch: {path}')
        return {'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'cached':True}
    body,headers=read(url)
    if expected is not None and len(body)!=int(expected):raise ValueError(f'Download size mismatch: {path}')
    path.parent.mkdir(parents=True,exist_ok=True)
    content=gzip.compress(body,compresslevel=1,mtime=0) if path.name.endswith('.geojson.gz') else body
    temp=path.with_name(path.name+'.part');temp.write_bytes(content);temp.replace(path)
    return {'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'etagReceived':headers.get('ETag')}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--cache',type=Path,required=True);ap.add_argument('--output',type=Path,default=Path('data/metadata/source-manifest.json'));ap.add_argument('--start',default='2020-10-01');ap.add_argument('--end',default='2025-12-31');ap.add_argument('--workers',type=int,default=6);a=ap.parse_args()
    start=dt.date.fromisoformat(a.start);end=dt.date.fromisoformat(a.end);objects=inventory()
    chosen=[]
    # Next UTC day is required to finish the last 12Z-to-12Z convective day.
    for obj in objects:
        m=re.search(r'mrms_hail_data_(\d{4}-\d{2}-\d{2})\.geojson$',obj['key'])
        if m and start<=dt.date.fromisoformat(m[1])<=end+dt.timedelta(days=1):chosen.append({**obj,'date':m[1]})
    manifest={'schemaVersion':1,'period':{'start':a.start,'end':a.end},'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'catalogUrl':'https://www.ncei.noaa.gov/products/event-footprint-catalog','inventoryUrl':BUCKET+'?prefix='+PREFIX,'efc':[],'secondary':[],'geography':[],'failures':[]}
    def job(obj):
        url=BUCKET+'/'+obj['key'];name=obj['key'].split('/')[-1]+'.gz'
        try:return {**obj,'url':url,'file':name,'status':'downloaded',**cached(url,a.cache/name,obj['bytes'])}
        except Exception as e:return {**obj,'url':url,'file':name,'status':'missing','error':str(e)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        for n,item in enumerate(pool.map(job,chosen),1):
            manifest['efc'].append(item)
            if n%100==0:print(f'Verified {n}/{len(chosen)} NOAA daily files',flush=True)
    for kind,year,name in [('county',2024,'cb_2024_us_county_500k.zip'),('zcta',2020,'cb_2020_us_zcta520_500k.zip')]:
        url=f'https://www2.census.gov/geo/tiger/GENZ{year}/shp/{name}'
        manifest['geography'].append({'kind':kind,'url':url,'file':name,**cached(url,a.cache/name)})
    indexUrl='https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
    html=read(indexUrl)[0].decode()
    for year in range(start.year,end.year+1):
        names=re.findall(r'StormEvents_details-ftp_v1\.0_d'+str(year)+r'_c\d{8}\.csv\.gz',html)
        if not names:manifest['failures'].append(f'No secondary annual CSV listed for {year}');continue
        name=sorted(set(names))[-1];url=indexUrl+name
        try:manifest['secondary'].append({'year':year,'url':url,'file':name,**cached(url,a.cache/name)})
        except Exception as e:manifest['failures'].append(str(e))
    manifest['efc'].sort(key=lambda row:row['date'])
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(manifest,indent=2)+'\n')
    print(f"Wrote {a.output}: {sum(r['status']=='downloaded' for r in manifest['efc'])} verified files; {sum(r['status']!='downloaded' for r in manifest['efc'])} failed downloads.",flush=True)
if __name__=='__main__':main()
