"use strict";

const DEFAULT_INCIDENT_LIST_WINDOW_MINUTES = 60;

function readWindowMinutes() {
  const raw = process.env.INCIDENT_LIST_WINDOW_MINUTES;

  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_INCIDENT_LIST_WINDOW_MINUTES;
  }

  const parsed = Number.parseInt(String(raw), 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_INCIDENT_LIST_WINDOW_MINUTES;
  }

  return parsed;
}

const INCIDENT_LIST_WINDOW_MINUTES = readWindowMinutes();
const INCIDENT_LIST_WINDOW_MS = INCIDENT_LIST_WINDOW_MINUTES * 60 * 1000;

function incidentWindowStart(now = Date.now()) {
  return new Date(now - INCIDENT_LIST_WINDOW_MS).toISOString();
}

module.exports = {
  DEFAULT_INCIDENT_LIST_WINDOW_MINUTES,
  INCIDENT_LIST_WINDOW_MINUTES,
  INCIDENT_LIST_WINDOW_MS,
  incidentWindowStart,
};
