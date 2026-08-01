"use strict";

const REPORT_TYPE = Object.freeze({
  ACCIDENT: "Accident",
  DELAY: "Delay",
  TRAFFIC_CONGESTION: "Traffic_Congestion",
  OVERCROWDING: "Overcrowding",
  ROAD_PROBLEM: "Road_Problem",
  MECHANICAL_FAILURE: "Mechanical_Failure",
  OTHER: "Other",
});

const REPORT_TYPE_VALUES = Object.freeze(Object.values(REPORT_TYPE));

function isValidReportType(value) {
  return REPORT_TYPE_VALUES.includes(value);
}

module.exports = {
  REPORT_TYPE,
  REPORT_TYPE_VALUES,
  isValidReportType,
};
