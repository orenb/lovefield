/**
 * @license
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
goog.setTestOnly();
goog.require('goog.Promise');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.jsunit');
goog.require('goog.userAgent.product');
goog.require('hr.db');
goog.require('lf.Global');
goog.require('lf.proc.ObserverTask');
goog.require('lf.query');
goog.require('lf.service');
goog.require('lf.testing.hrSchemaSampleData');


/** @type {!goog.testing.AsyncTestCase} */
var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(
    'QueryTaskTest');


/** @type {!hr.db.Database} */
var db;


/** @type {!lf.BackStore} */
var backStore;


/** @type {!lf.cache.Cache} */
var cache;


/** @type {!lf.proc.QueryEngine} */
var queryEngine;


/** @type {!Array.<!lf.Row>} */
var rows;


/** @type {!hr.db.schema.Job} */
var j;


/** @const {number} */
var ROW_COUNT = 3;


function setUp() {
  asyncTestCase.waitForAsync('setUp');
  hr.db.getInstance(undefined, true).then(function(database) {
    db = database;
    backStore = lf.Global.get().getService(lf.service.BACK_STORE);
    cache = lf.Global.get().getService(lf.service.CACHE);
    queryEngine = lf.Global.get().getService(lf.service.QUERY_ENGINE);
    j = db.getSchema().getJob();
  }).then(function() {
    asyncTestCase.continueTesting();
  }, fail);
}


function tearDown() {
  asyncTestCase.waitForAsync('tearDown');
  db.delete().from(j).exec().then(function() {
    asyncTestCase.continueTesting();
  });
}


/**
 * Inserts sample Job rows in the Jobs table.
 * @return {!IThenable}
 */
function insertSampleJobs() {
  rows = [];
  for (var i = 0; i < ROW_COUNT; ++i) {
    var job = lf.testing.hrSchemaSampleData.generateSampleJobData(db);
    job.setId('jobId' + i.toString());
    rows.push(job);
  }
  return db.insert().into(j).values(rows).exec();
}


/**
 * Tests that registered observers are notified as a result of executing an
 * ObserveTask.
 */
function testExec() {
  // TODO: Array.observe currently exists only in Chrome. Polyfiling mechanism
  // not ready yet, see b/18331726. Remove this once fixed.
  if (!goog.userAgent.product.CHROME) {
    return;
  }

  asyncTestCase.waitForAsync('testExec');

  var selectQuery = /** @type {!lf.query.SelectBuilder} */ (
      db.select().from(j)).getQuery();

  var observerCallback = function(changes) {
    // Expecting one "change" record for each insertion.
    assertEquals(ROW_COUNT, changes.length);
    changes.forEach(function(change) {
      assertEquals(1, change['addedCount']);
    });

    lf.query.unobserve(selectQuery, observerCallback);
    asyncTestCase.continueTesting();
  };

  insertSampleJobs().then(function() {
    // Start observing.
    lf.query.observe(selectQuery, observerCallback);
    var observerTask = new lf.proc.ObserverTask([selectQuery]);
    return observerTask.exec();
  }, fail);
}
