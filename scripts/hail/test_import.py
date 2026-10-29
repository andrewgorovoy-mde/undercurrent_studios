"""Synthetic geometries below are tests only, never shipped as NOAA observations."""
import datetime as dt,json,math,unittest
from pathlib import Path
from shapely.geometry import box
from import_history import parse_feature,bin_index,record_hit,covered_convective_days,positive_area_intersection,summarize,dates,poisson_interval
D=dt.date
class ImportTests(unittest.TestCase):
    def feature(self):
        return {'type':'Feature','properties':{'date':'2025-01-02','hour_utc':'0100','convective_day':'2025-01-01','source':'MRMS','hail_min':1,'hail_max':1.49,'hail_size_range_in':'1.0-1.49'},'geometry':{'type':'Polygon','coordinates':[[[-98,35],[-97,35],[-97,36],[-98,36],[-98,35]]]}}
    def unit(self):return {'id':'40109','kind':'county','name':'Synthetic test county','countyAssignments':[],'oklahomaAreaFraction':1}
    def test_actual_downloaded_noaa_schema(self):
        feature=json.loads(Path('data/raw/mrms_hail_data_2020-10-14.geojson').read_text())['features'][0]
        day,index,_,_=parse_feature(feature,D(2020,10,14));self.assertEqual(day,D(2020,10,14));self.assertEqual(index,0)
    def test_utc_to_convective_day(self):self.assertEqual(parse_feature(self.feature())[0],D(2025,1,1))
    def test_invalid_missing_fields(self):
        for key in ['date','convective_day','hour_utc','source']:
            f=self.feature();del f['properties'][key]
            with self.assertRaises((KeyError,ValueError)):parse_feature(f)
    def test_invalid_geometry_and_dates(self):
        f=self.feature();f['properties']['convective_day']='2025-01-02'
        with self.assertRaises(ValueError):parse_feature(f)
        f=self.feature();f['geometry']={'type':'Point','coordinates':[-97,35]}
        with self.assertRaises(ValueError):parse_feature(f)
        f=self.feature();f['geometry']['coordinates'][0][0][0]=float('nan')
        with self.assertRaises(ValueError):parse_feature(f)
    def test_actual_broad_three_inch_bin_and_documented_finer_bins(self):
        self.assertEqual(bin_index({'hail_min':3,'hail_max':3.99}),5)
        self.assertEqual(bin_index({'hail_min':3.5,'hail_max':3.99}),5)
        self.assertEqual(bin_index({'hail_size_range_in':'3.0-3.99'}),5)
    def test_open_bin_is_not_ten_inch_measurement(self):
        self.assertEqual(bin_index({'hail_min':4,'hail_max':10}),6)
        days={D(2025,1,1):1<<6};r=summarize(self.unit(),days,D(2025,1,1),D(2025,12,31),set(dates(D(2025,1,1),D(2025,12,31))))
        self.assertEqual(r['largestModeledHail']['lowerIn'],4);self.assertIsNone(r['largestModeledHail']['upperIn']);self.assertIsNone(r['largestModeledHail']['exactIn'])
    def test_duplicate_reports_polygons_and_hours_count_once(self):
        hits={};day=D(2025,1,1)
        record_hit(hits,day,0);record_hit(hits,day,0);record_hit(hits,day,1)
        r=summarize(self.unit(),hits,day,D(2025,12,31),set(dates(day,D(2025,12,31))))
        self.assertEqual(r['recordedExposureDays'],1);self.assertEqual(r['sizeCategories'][0]['exposureDays'],1);self.assertEqual(r['sizeCategories'][1]['exposureDays'],1);self.assertEqual(sum(b['maxDailySeverityDays'] for b in r['sizeCategories']),1)
    def test_boundary_touch_is_not_positive_area_exposure(self):
        self.assertFalse(positive_area_intersection(box(0,0,1,1),box(1,0,2,1)));self.assertTrue(positive_area_intersection(box(0,0,1,1),box(.5,.5,2,2)))
    def test_adjacent_utc_files_required(self):
        self.assertEqual(covered_convective_days({D(2025,1,1),D(2025,1,3),D(2025,1,4)},D(2025,1,1),D(2025,1,3)),{D(2025,1,3)})
    def test_partial_2020_not_used_as_full_year(self):
        start=D(2020,10,1);end=D(2022,12,31);covered=set(dates(start,end));hits={D(2020,11,1):1,D(2021,5,1):1,D(2022,5,1):2}
        r=summarize(self.unit(),hits,start,end,covered)
        self.assertEqual(r['years'][0]['status'],'partial');self.assertEqual(r['annualExposureRate']['completeYears'],[2021,2022]);self.assertEqual(r['annualExposureRate']['estimate'],1)
    def test_gaps_not_zero_or_an_annual_denominator(self):
        r=summarize(self.unit(),{},D(2021,1,1),D(2022,12,31),set())
        self.assertEqual(r['status'],'unavailable');self.assertIsNone(r['recordedExposureDays']);self.assertIsNone(r['annualExposureRate']);self.assertTrue(all(y['recordedExposureDays'] is None for y in r['years']))
    def test_gapped_year_excluded_even_if_almost_complete(self):
        start=D(2021,1,1);end=D(2023,12,31);covered=set(dates(start,end))-{D(2021,3,1)}
        r=summarize(self.unit(),{D(2021,5,1):1,D(2022,5,1):1,D(2023,5,1):1},start,end,covered)
        self.assertEqual(r['annualExposureRate']['completeYears'],[2022,2023]);self.assertEqual(r['years'][0]['status'],'gapped')
    def test_zero_detections_has_positive_uncertainty(self):
        rate=poisson_interval(0,5);self.assertEqual(rate['estimate'],0);self.assertGreater(rate['upper95'],0);self.assertEqual(rate['lower95'],0)
if __name__=='__main__':unittest.main()
