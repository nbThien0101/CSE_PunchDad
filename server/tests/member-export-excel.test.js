const assert = require('node:assert/strict');
const { test } = require('node:test');
const { exportMembersExcel } = require('../src/controllers/user.controller');
const ExcelJS = require('exceljs');

test('member excel export rejects non-admin users with 403', async () => {
  let statusCode = 200;
  let errorPayload = null;

  const req = {
    user: { id: 'user-1', role: 'MEMBER', displayName: 'Regular Member' },
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      errorPayload = data;
      return this;
    },
  };

  await exportMembersExcel(req, res, (err) => {
    if (err) throw err;
  });

  assert.equal(statusCode, 403);
  assert.match(errorPayload.error, /Chỉ ban cán sự/);
});

test('member excel export generates valid xlsx buffer with headers for ADMIN', async () => {
  let headers = {};
  let responseData = null;

  const req = {
    user: { id: 'admin-1', role: 'ADMIN', displayName: 'Admin User' },
  };

  const res = {
    setHeader(key, value) {
      headers[key.toLowerCase()] = value;
    },
    send(buffer) {
      responseData = buffer;
    },
  };

  // Run the controller method
  await exportMembersExcel(req, res, (err) => {
    if (err) throw err;
  });

  assert.ok(responseData, 'Expected Excel buffer response');
  assert.equal(headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(headers['content-disposition'].includes('attachment; filename="Danh_sach_thanh_vien_CSE_'));
  assert.ok(headers['content-disposition'].includes('.xlsx'));

  // Load into ExcelJS to verify validity of the workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(responseData);

  const wsMembers = workbook.getWorksheet('Danh sách thành viên');
  assert.ok(wsMembers, 'Worksheet "Danh sách thành viên" should exist');
  assert.equal(wsMembers.getCell('A1').value, 'CLB BÓNG ĐÁ CSE HITDAD - DANH SÁCH THÀNH VIÊN');

  const wsPending = workbook.getWorksheet('Yêu cầu chờ duyệt');
  assert.ok(wsPending, 'Worksheet "Yêu cầu chờ duyệt" should exist');
});
