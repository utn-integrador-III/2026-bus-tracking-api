"use strict";

function createQuery(response = { data: null, error: null }) {
  const query = {};
  const methods = [
    "delete",
    "eq",
    "gt",
    "gte",
    "in",
    "insert",
    "limit",
    "lte",
    "maybeSingle",
    "order",
    "select",
    "single",
    "update",
    "upsert",
  ];

  for (const method of methods) {
    query[method] = jest.fn(() => query);
  }

  query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
  return query;
}

function createSupabaseMock(responses = []) {
  const queue = [...responses];
  const queries = [];

  function nextQuery() {
    const query = createQuery(queue.shift());
    queries.push(query);
    return query;
  }

  const client = {
    from: jest.fn(() => nextQuery()),
    rpc: jest.fn(() => nextQuery()),
  };

  return { client, queries };
}

module.exports = { createQuery, createSupabaseMock };
