"""Rebuild baseline history + corrected spatial model, publishing only valid v2.
Raw sources remain cached. A partial/failed rebuild never replaces the live file.
"""
import argparse,json,shutil,subprocess,sys
from pathlib import Path
from validate_output import validate

def main():
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--manifest',type=Path,default=Path('data/metadata/source-manifest.json'));p.add_argument('--output',type=Path,default=Path('public/data/hail-history.json'));a=p.parse_args()
    a.work.mkdir(parents=True,exist_ok=True);temporary=a.work/'history-build.json'
    subprocess.run([sys.executable,'scripts/hail/import_history.py','--cache',str(a.cache),'--manifest',str(a.manifest),'--output',str(temporary)],check=True)
    subprocess.run([sys.executable,'scripts/hail/spatial_exposure.py','--cache',str(a.cache),'--manifest',str(a.manifest),'--history',str(temporary),'--work',str(a.work/'spatial'),'--apply'],check=True)
    data=json.loads(temporary.read_text());validate(data,json.loads(Path('data/hail-history.schema.json').read_text()))
    if data['schemaVersion']!=2:raise ValueError('Never publish the county-anywhere baseline as location probability')
    a.output.parent.mkdir(parents=True,exist_ok=True);staging=a.output.with_suffix('.json.tmp');shutil.copyfile(temporary,staging);staging.replace(a.output)
    print(f'Published validated fixed-location spatial artifact: {a.output}')
if __name__=='__main__':main()
