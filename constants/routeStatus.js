"use strict";

const ROUTE_STATUS = Object.freeze({
  ACTIVE: "Active",
  INACTIVE: "Inactive",
});

function statusFromActive(isActive) {
  return isActive ? ROUTE_STATUS.ACTIVE : ROUTE_STATUS.INACTIVE;
}

module.exports = { ROUTE_STATUS, statusFromActive };
