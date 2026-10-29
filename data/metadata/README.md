# Event Footprint Catalog Data README

## Overview
This dataset contains comprehensive geospatial and event-level metadata for severe convective storm footprints as part of the Event Footprint Catalog product. This data is intended for public use and is hosted on Google Cloud Storage. Contact industryproving.grounds@noaa.gov for questions or more information.

## Missing & Invalid Values
This dataset explicitly represents invalid or missing data for certain fields. The value that is used to represent missing data is specific to the data type of the field:\
Integer = -99\
Float = -99.0*\
String = “”\
Datetime = Null\
Arrays = []\
*Width is set to 0.99 due to footprint display requirements for the Event Footprint Catalog product.\
Users should filter or handle these explicitly when running statistical analyses or geospatial processing. The tornado schema table provides information about what missing data value is used for each field.


## Metadata

### 1. Tornado Dataset Schema
The tornado data comes from the Damage Assessment Toolkit (DAT) and the Storm Events Database (SED). Data from the DAT can be provided in three ways: damage polygons representing the damage regions, tornado track lines, or damage polygons and track lines for the same tornado. The table below represents all of the fields that are available for each tornado in the EFC output GeoJSON files. The "_line" fields are only used for tornados that are represented by both damage polygons and track lines.

Metadata information for Tornadoes:


| Field | Data Type | Description | Valid Values | Invalid Values |
| :--- | :--- | :--- | :--- | :--- |
| `objectid` | Int | Unique identifier assigned to each tornado polygon. SED data is 8 digits, the leading 4 are the year, and the trailing 4 are incremental. | Greater than or equal to 1 | Can never be missing |
| `event_id` | String | Name of the tornado | String that describes the tornado. | `""` |
| `stormdate` | Datetime | Time at which the tornado occurred (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `starttime` | Datetime | Time the tornado started (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `endtime` | Datetime | Time the tornado ended (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `CZ_TIMEZONE` | String | Time zone for the location of the tornado | Time zone code & offset (ex: CDT-5) | `""` |
| `startlat` | Float | Latitude where the tornado started | Range of -90 to 90 up to 4 decimals. | -99.0 |
| `startlon` | Float | Longitude where the tornado started | Range of -180 to 180 up to 4 decimals | -99.0 |
| `endlat` | Float | Latitude where the tornado ended | Range of -90 to 90 up to 4 decimals | -99.0 |
| `endlon` | Float | Longitude where the tornado ended | Range of -180 to 180 up to 4 decimals | -99.0 |
| `length` | Float | Total length of the tornado path (miles) | Greater than or equal 0, up to two decimal places  | -99.0 |
| `width` | Float | Maximum width of the tornado path (yards) | Greater than 0  | 0.99 |
| `injuries` | Int | The total number of injuries due to the tornado | Greater than or equal to 0 | -99 |
| `fatalities` | Int | The total number of deaths due to the tornado | Greater than or equal to 0 | -99 |
| `efscale` | String | Enhanced Fujita rating of the tornado | EFU, EF0, EF1, EF2, EF3, EF4, or EF5 | `""` |
| `efnum` | Int | Enhanced Fujita rating of the tornado without "EF" | 0, 1, 2, 3, 4, 5, or -1 | -99 |
| `qc` | String | Indicator if the tornado data has been quality controlled by the Damage Assessment Toolkit | String: Y or N | `""` |
| `maxwind` | Float | Maximum windspeed (mph) | Greater than or equal to 0 | -99.0 |
| `globalid` | String | UUID of the tornado | Alphanumeric string of (8-4-4-4-12 characters) | `""` |
| `cropdamage` | String | Total amount of crop damage in dollars | e.g: 3.00K, 15.00M | `""` |
| `propdamage` | String | Total amount of property damage in dollars | e.g: 3.00K, 15.00M | `""` |
| `created_user` | String | Information about the user who created the entry in the Damage Assessment Toolkit | Name of the user who created the entry | `""` |
| `created_date` | Datetime | Date the entry was created in the Damage Assessment Toolkit (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `last_edited_user` | String | Information about the user who most recently edited the entry in the Damage Assessment Toolkit | Name of the user who updated the entry | `""` |
| `last_edited_date` | Datetime | Date the entry was last edited in the Damage Assessment Toolkit (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `comments` | String | Event narrative associated with the tornado | Any information associated with the tornado. May include external links. | `""` |
| `Shape__Length` | Float | Length of the tornado polygon (miles) |Greater than 0 or equal to 0 | -99.0 |
| `wfo` | String | Weather forecasting office | Three digit alphanumeric code | `""` |
| `path_guid` | String | UUID attached to a path | Alphanumeric string of (8-4-4-4-12 characters) | `""` |
| `Shape__Area` | Float | Area of the tornado polygon (sq mi) | Greater than or equal to 0 | -99.0 |
| `source` | String | Source of the data | DAT or SED | Can never be missing |
| `edit_user` | String | Information about the user who edited the tornado data | Name of user who edited the entry | `""` |
| `edit_time` | Datetime | Time the tornado data was last edited (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `area_acres` | Float | Computed area of the damage region (acres) | Greater than 0 | -99.0 |
| `parents` | Array of Ints | Damage region that encloses all other damage regions | List of objectids | "[]" |
| `children` | Array of Ints | List of damage regions that are enclosed by another damage region | List of objectids | "[]" |
| `max_efscale` | String | Maximum Enhanced Fujita rating for all damage regions | EFU, EF0, EF1, EF2, EF3, EF4, EF5 | `""` |
| `objectid_line` | Int | Unique identifier assigned to each tornado polygon. Data from SED may have matching ids across years. | Greater than or equal to 1. | -99 |
| `event_id_line` | String | Name of the tornado | String that describes the tornado. | `""` |
| `stormdate_line` | Datetime | Time at which the tornado occurred (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `starttime_line` | Datetime | Time the tornado started (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `endtime_line` | Datetime | Time the tornado ended (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `startlat_line` | Float | Latitude where the tornado started | Range of -90 to 90 up to 4 decimals. | -99.0 |
| `startlon_line` | Float | Longitude where the tornado started | Range of -180 to 180 up to 4 decimals | -99.0 |
| `endlat_line` | Float | Latitude where the tornado ended | Range of -90 to 90 up to 4 decimals | -99.0 |
| `endlon_line` | Float | Longitude where the tornado ended | Range of -180 to 180 up to 4 decimals | -99.0 |
| `length_line` | Float | Total length of the tornado path (miles) | Greater than 0, up to 4 decimal places  | -99.0 |
| `width_line` | Float | Total width of the tornado path (yards) | Greater than or equal to 0 | -99.0 |
| `injuries_line` | Int | The total number of injuries due to the tornado | Greater than or equal to 0 | -99 |
| `fatalities_line` | Int | The total number of deaths due to the tornado | Greater than or equal to 0 | -99 |
| `efscale_line` | String | Enhanced Fujita rating of the tornado | EFU, EF0, EF1, EF2, EF3, EF4, or EF5 | `""` |
| `efnum_line` | Int | Enhanced Fujita rating of the tornado without "EF" | 0, 1, 2, 3, 4, 5, or -1 | -99 |
| `qc_line` | String | Indicator if the tornado data has been quality controlled by the Damage Assessment Toolkit | Y or N | `""` |
| `maxwind_line` | Float | Maximum windspeed (mph) | Greater than or equal to 0 | -99.0 |
| `globalid_line` | String | UUID of the storm | Alphanumeric string of (8-4-4-4-12 characters) | `""` |
| `cropdamage_line` | String | Total amount of crop damage in dollars | e.g: 3.00K, 15.00M | `""` |
| `propdamage_line` | String | Total amount of property damage in dollars | e.g: 3.00K, 15.00M | `""` |
| `edit_user_line` | String | Information about the user who edited the tornado data | Name of user who edited the entry | `""` |
| `created_user_line` | String | Information about the user who created the entry in the Damage Assessment Toolkit | Name of user who created the entry | `""` |
| `created_date_line` | Datetime | Date the entry was created in the Damage Assessment Toolkit (UTC) | YYYY-MM-DDThh:mm:ssZ | Null |
| `last_edited_user_line` | String | Information about the user who most recently edited the entry in the Damage Assessment Toolkit | Name of user who edited the entry | `""` |
| `last_edited_date_line` | Datetime | Date the entry was last edited in the Damage Assessment Toolkit (UTC)| YYYY-MM-DDThh:mm:ssZ | Null |
| `comments_line` | String | Event narrative associated with the tornado | Any information associated with the tornado. May include external links. | `""` |
| `Shape__Length_line`| float | Length of the tornado polygon (miles) | Greater than or equal to 0| -99.0 |
| `wfo_line` | String | Weather forecasting office | Three digit alphanumeric code | `""` |
| `source_line` | String | Source of the data | DAT or SED | `""` |
| `convective_day` | Datetime | The convective day the storm occurred on. A convective day is from 12:00 UTC on one day until 11:59 UTC on the next calendar day. | YYYY-MM-DD | Can never be missing |
| `geometry` | Object | Contains all of the points of the polygon | { "type": "Polygon", "coordinates": } - will include list of coordinates | Can never be missing |

---

### 2. Hail Dataset Schema
Metadata information for hail:

| Field | Data Type | Description | Valid Values |
| :--- | :--- |:--- | :--- |
| `hail_size_range_in` | String | Bins for hail size (inches) | 0.5 - 0.99, 1.0 - 1.49, 1.50 - 1.99, 2.0 - 2.49, 2.50 - 2.99, 3.0 - 3.49, 3.5 - 3.99, 4+ |
| `date` | Datetime | Date when the hail event occurred | YYYY-MM-DD |
| `hour_utc`| String | Time when the hail event occurred (UTC) | hhmm |
| `source` | String | Source of the data | MRMS |
| `convective_day`| Datetime | The convective day on which the storm occurred. A convective day is from 12:00 UTC on one day until 11:59 UTC on the next calendar day. | YYYY-MM-DD |
| `geometry` | Object | Contains all of the points of the polygon | { "type": "Polygon", "coordinates": } - will include list of coordinates

---

