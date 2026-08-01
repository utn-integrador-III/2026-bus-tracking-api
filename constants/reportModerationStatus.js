"use strict";

const REPORT_MODERATION_STATUS = Object.freeze({
  PENDING: "pending",
  VALIDATED: "validated",
  DISMISSED: "dismissed",
});

const REPORT_MODERATION_STATUS_VALUES = Object.freeze(Object.values(REPORT_MODERATION_STATUS));

const PASSENGER_VISIBLE_MODERATION_STATUSES = Object.freeze(
  REPORT_MODERATION_STATUS_VALUES.filter(
    (status) => status !== REPORT_MODERATION_STATUS.DISMISSED,
  ),
);

function isVisibleToPassengers(status) {
  if (status === undefined || status === null) {
    return true;
  }
  return PASSENGER_VISIBLE_MODERATION_STATUSES.includes(status);
}

module.exports = {
  REPORT_MODERATION_STATUS,
  REPORT_MODERATION_STATUS_VALUES,
  PASSENGER_VISIBLE_MODERATION_STATUSES,
  isVisibleToPassengers,
};
