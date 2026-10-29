"""Synthetic spatial tests only; no synthetic observations enter the application."""
import math,unittest
from shapely.geometry import box,GeometryCollection
from shapely.ops import unary_union
from spatial_exposure import area_fractions_by_year_pattern,projection_from_patterns,project_with_year_bootstrap,union_footprints,exclusive_qualifying_footprints,apply_spatial_quality_policy
class SpatialExposureTests(unittest.TestCase):
    def test_duplicate_hourly_footprints_do_not_double_area(self):
        cell=box(0,0,1,1);self.assertEqual(union_footprints([cell,cell]).area,1)
    def test_overlapping_storms_same_day_are_union_not_sum(self):
        self.assertEqual(union_footprints([box(0,0,2,1),box(1,0,3,1)]).area,3)
    def test_bounding_boxes_are_not_geographic_intersections(self):
        # A footprint fits inside the hole, so bbox overlap cannot imply exposure.
        county=box(0,0,4,4).difference(box(1,1,3,3));hail=box(1.2,1.2,2.8,2.8)
        self.assertTrue(county.envelope.intersects(hail));self.assertEqual(county.intersection(hail).area,0)
    def test_year_patterns_partition_fixed_geographic_locations(self):
        region=box(0,0,4,1);a=box(0,0,2,1);b=box(1,0,3,1)
        weights=area_fractions_by_year_pattern(region,[a,b]);self.assertEqual(weights,[.25,.25,.25,.25])
        self.assertAlmostEqual(projection_from_patterns(weights,2,1),.5)
        self.assertAlmostEqual(projection_from_patterns(weights,2,5),.25+.5*(1-.5**5))
    def test_point_first_aggregation_is_not_a_uniform_county_rate(self):
        # Half always exposed, half never in the observed years. Do not spread
        # the hotspot's hits uniformly across every location in the county.
        weights=area_fractions_by_year_pattern(box(0,0,2,1),[box(0,0,1,1)]*4)
        self.assertAlmostEqual(projection_from_patterns(weights,4,10),.5)
        self.assertNotAlmostEqual(projection_from_patterns(weights,4,10),1-(1-.5)**10)
    def test_year_bootstrap_retains_within_year_pattern_and_bounds(self):
        w=area_fractions_by_year_pattern(box(0,0,4,1),[box(0,0,1,1),box(1,0,2,1),box(1,0,3,1),GeometryCollection()])
        r=project_with_year_bootstrap(w,4,5);self.assertLessEqual(r['lower95'],r['central']);self.assertGreaterEqual(r['upper95'],r['central'])
    def test_repeated_exposure_in_one_year_does_not_create_multiple_hit_years(self):
        region=box(0,0,2,1);day=box(0,0,1,1);annual=union_footprints([day]*20)
        w=area_fractions_by_year_pattern(region,[annual,GeometryCollection(),GeometryCollection(),GeometryCollection()])
        self.assertAlmostEqual(projection_from_patterns(w,4,1),.125)
    def test_invalid_area_weights_rejected(self):
        with self.assertRaises(ValueError):projection_from_patterns([.2,.2],1,5)
        with self.assertRaises(ValueError):projection_from_patterns([1,0],0,5)
    def test_all_geography_is_area_weighted_without_residential_fabrication(self):
        region=box(0,0,10,1);w=area_fractions_by_year_pattern(region,[box(0,0,1,1)])
        self.assertAlmostEqual(w[1],.1)
    def test_typical_size_uses_exclusive_area_day_bins_not_largest_hail(self):
        bins=exclusive_qualifying_footprints({0:box(0,0,100,1),2:box(0,0,3,1),3:box(0,0,1,1)})
        self.assertNotIn(0,bins);self.assertEqual(bins[2].area,2);self.assertEqual(bins[3].area,1)
        self.assertEqual(max(bins,key=lambda i:bins[i].area),2)
    def test_invalid_boundary_support_is_missing_not_scaled_or_zero_risk(self):
        e={'probabilities':{'1':{'central':.2}},'typicalHailSize':{'label':'1.5-1.99'},'annualExposureDaysRate':.25,'qualifyingRecordedDays':2}
        fixed=apply_spatial_quality_policy(e,'zcta','71945',{'projectedAreaRepairs':[{'kind':'zcta','id':'71945'}]})
        self.assertIsNone(fixed['probabilities']);self.assertIsNone(fixed['typicalHailSize']);self.assertEqual(fixed['qualifyingRecordedDays'],2)
        self.assertEqual(apply_spatial_quality_policy(e,'county','40109',{}),e)
if __name__=='__main__':unittest.main()
