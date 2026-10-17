// Local, isolated visual QA: APIs only modify this in-memory fixture.
import React from 'react';
import { createRoot } from 'react-dom/client';
import AttendanceDashboardModal from '../src/components/Attendance/AttendanceDashboardModal';
import { attendanceAPI, usersAPI } from '../src/services/api';
import '../src/index.css';

const session = { id: 'fixture', startTime: '18:00', endTime: '20:00',
  location: 'Sân CSE — Điểm danh mẫu', totalCost: 600000, isVoteLocked: false };
const names = ['Nguyễn Đăng Khánh', 'Trần Hoàng Minh', 'Lê Quốc Huy', 'Phạm Nguyễn Hoàng Anh Tuấn',
  'Võ Thành Đạt', 'Đỗ Đức Hùng', 'Nguyễn Minh Phúc', 'Bùi Văn Long', 'Mai Anh Khoa', 'Phan Hải Nam'];
const joined = names.map((name, i) => ({ id: `vote-${i}`, userId: `user-${i}`, status: 'JOIN',
  isCheckedIn: i === 1 || i === 4, checkedInAt: i === 1 || i === 4 ? new Date().toISOString() : null,
  user: { id: `user-${i}`, displayName: name, tier: ['B', 'A', 'C'][i % 3], isGoalkeeper: i === 2 } }));
const guests = [{ id: 'g1', name: 'Bạn Nguyễn Hoàng Anh Tuấn', tier: 'B', status: 'RESERVE', isCheckedIn: false },
  { id: 'g2', name: 'Minh (khách)', tier: 'C', status: 'PLAYING', isCheckedIn: true, isGoalkeeper: true }];
const delay = () => new Promise(resolve => setTimeout(resolve, 650));
let requests = 0;
const buildDashboard = () => {
  const attended = joined.filter(v => v.isCheckedIn).length;
  const attendedGuests = guests.filter(g => g.isCheckedIn).length;
  return structuredClone({ session, joined, guests, declined: [], maybe: [], absenceLogs: [],
    warnings: { lateCancellations: [], noShows: [] }, summary: {
      attendedMembersCount: attended, unattendedMembersCount: joined.length - attended,
      joinedCount: joined.length, attendedGuestsCount: attendedGuests, totalGuestsCount: guests.length,
      totalAttendedOnPitch: attended + attendedGuests,
    } });
};
attendanceAPI.getDashboard = async () => { await delay(); return buildDashboard(); };
attendanceAPI.checkIn = async (_, userId, checked) => {
  requests++;
  await delay();
  const vote = joined.find(v => v.userId === userId);
  vote.isCheckedIn = checked;
  vote.checkedInAt = checked ? new Date().toISOString() : null;
  return { vote: structuredClone(vote) };
};
attendanceAPI.updateGuest = async (_, id, updates) => {
  await delay(); Object.assign(guests.find(g => g.id === id), updates); return {};
};
attendanceAPI.addGuest = async (_, form) => {
  await delay(); guests.push({ ...form, id: `guest-${guests.length}`, isCheckedIn: false });
  return { message: 'Đã thêm khách mẫu' };
};
attendanceAPI.toggleLockVote = async (_, locked) => { session.isVoteLocked = locked; return { message: 'Đã đổi trạng thái chốt' }; };
attendanceAPI.bulkCheckIn = async (_, checked) => { joined.forEach(v => { v.isCheckedIn = checked; }); return { message: 'Đã cập nhật dữ liệu mẫu' }; };
attendanceAPI.deleteGuest = async (_, id) => { guests.splice(guests.findIndex(g => g.id === id), 1); return {}; };
attendanceAPI.recalculatePayments = async () => ({ message: 'Đây là bản mẫu, không thay đổi thanh toán' });
usersAPI.updateGoalkeeper = async (id, value) => { joined.find(v => v.userId === id).user.isGoalkeeper = value; return {}; };
// Useful for manual checks of rapid taps without exposing real user data.
window.attendanceFixture = { dashboard: buildDashboard, get checkInRequests() { return requests; } };
createRoot(document.getElementById('root')).render(<AttendanceDashboardModal session={session}
  onClose={() => {}} onOpenTeamGenerator={() => alert('Mở chia đội với người đã điểm danh (bản mẫu)')} />);
