const test = require('node:test');
const assert = require('node:assert/strict');

test('notices controller exports required handlers', () => {
  const noticeController = require('../src/controllers/notice.controller');
  assert.equal(typeof noticeController.getSummary, 'function');
  assert.equal(typeof noticeController.getNotices, 'function');
  assert.equal(typeof noticeController.createNotice, 'function');
  assert.equal(typeof noticeController.markRead, 'function');
  assert.equal(typeof noticeController.archiveNotice, 'function');
});
