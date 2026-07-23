"use strict";

const ROLES = Object.freeze({
  PASSENGER: "Passenger",
  DRIVER: "Driver",
  ADMIN: "Admin",
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

function isValidRole(value) {
  return ROLE_VALUES.includes(value);
}

module.exports = { ROLES, ROLE_VALUES, isValidRole };
