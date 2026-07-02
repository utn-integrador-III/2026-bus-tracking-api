"use strict";

const TRIP_STATUS = Object.freeze({
  SCHEDULED: "Scheduled",
  PENDING: "Pending",
  IN_PROGRESS: "In_Progress",
  STOPPED: "Stopped",
  DELAYED: "Delayed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

const TRIP_STATUS_VALUES = Object.freeze(Object.values(TRIP_STATUS));

const CONSUMER_VISIBLE_STATUSES = Object.freeze(
  TRIP_STATUS_VALUES.filter(
    (status) => status !== TRIP_STATUS.CANCELLED && status !== TRIP_STATUS.COMPLETED,
  ),
);

function isValidTripStatus(value) {
  return TRIP_STATUS_VALUES.includes(value);
}

module.exports = {
  TRIP_STATUS,
  TRIP_STATUS_VALUES,
  CONSUMER_VISIBLE_STATUSES,
  isValidTripStatus,
};
