import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesAttendanceSearch } from '../src/utils/attendance.js';

test('search matches Vietnamese names with or without accents and case', () => {
  assert.ok(matchesAttendanceSearch('Nguyễn Đặng Bảo Thiên', '  NGUYEN dang  '));
  assert.ok(matchesAttendanceSearch('Nguyễn Đặng Bảo Thiên', 'bảo thiên'));
  assert.ok(matchesAttendanceSearch('Nguyễn Đặng Bảo Thiên'.normalize('NFD'), 'nguyen'));
  assert.ok(matchesAttendanceSearch(undefined, '  '));
  assert.equal(matchesAttendanceSearch(null, 'thien'), false);
  assert.equal(matchesAttendanceSearch('Nguyễn Bảo Thiên', 'minh'), false);
});
