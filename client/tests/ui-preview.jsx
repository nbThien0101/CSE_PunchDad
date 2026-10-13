// Development-only preview of real screens. No requests reach the real backend.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../src/context/AuthContext';
import HitDadUIProvider from '../src/components/ui/Provider';
import App from '../src/App';
import '../src/index.css';
import '../src/components/ui/theme.css';

const user = { id: 'preview-admin', role: 'ADMIN', username: 'admin.demo', displayName: 'Nguyễn Minh Anh', membershipStatus: 'APPROVED' };
const member = { id: 'preview-member', displayName: 'Trần Quốc Huy', username: 'quochuy', role: 'MEMBER', tier: 'B', createdAt: '2026-09-01', _count: { votes: 12 } };
const session = { id: 'preview-match', title: 'Giao lưu cuối tuần · CSE FC', status: 'VOTING', playDate: '2026-10-17T00:00:00Z', startTime: '18:00', endTime: '20:00', location: 'Sân bóng Đại học Bách Khoa', minPlayers: 14, maxPlayers: 20, createdBy: user, votes: [{ id: 'v1', status: 'JOIN', user: member, userId: member.id }], timeSlots: [] };
const sessions = [session,
  { ...session, id: 'preview-booked', title: 'Trận đấu giữa tuần', status: 'BOOKED', playDate: '2026-10-21T00:00:00Z' },
  { ...session, id: 'preview-cancelled', title: 'Giao lưu CSE × BK', status: 'CANCELLED', cancellationNote: 'Sân tạm đóng do thời tiết. CLB sẽ thông báo lịch thay thế.', playDate: '2026-10-13T00:00:00Z' },
];
let requests = [{ id: 'preview-applicant', username: 'nguyenhoang', displayName: 'Nguyễn Hoàng', email: 'hoang@example.com', phone: '0901234567', createdAt: '2026-10-13T01:00:00Z' }];
const params = new URLSearchParams(location.search);
if (params.get('screen') !== 'login') localStorage.setItem('accessToken', 'ui-preview-only');
else localStorage.removeItem('accessToken');
window.fetch = async (url, options = {}) => {
  const pathname = new URL(url, location.origin).pathname.replace(/^\/api/, '');
  let data = {};
  if (pathname === '/auth/me' || pathname === '/auth/login') data = { user, accessToken: 'ui-preview-only', refreshToken: 'ui-preview-only' };
  else if (pathname === '/users/membership-requests/count') data = { count: requests.length };
  else if (pathname === '/users/membership-requests') data = { requests };
  else if (pathname.startsWith('/users/membership-requests/')) { requests = []; data = { message: 'Đã duyệt thành viên vào CLB' }; }
  else if (pathname === '/users/members') data = { members: [{ ...user, email: 'admin@example.com', createdAt: '2026-09-01', _count: { votes: 18 } }, member] };
  else if (pathname === '/sessions') data = { sessions };
  else if (pathname.startsWith('/sessions/')) data = { session: sessions.find(item => pathname.endsWith(item.id)) || session };
  else if (pathname.startsWith('/payments/session/')) data = { payments: [], summary: { total: 0, confirmed: 0, pending: 0 } };
  else if (pathname === '/votes') { session.votes.push({ status: JSON.parse(options.body).status, user, userId: user.id }); data = { message: 'Đã ghi nhận bình chọn' }; }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
// Mount at the selected route before BrowserRouter initializes.
history.replaceState(null, '', params.get('screen') === 'login' ? '/login' : '/');
createRoot(document.getElementById('root')).render(<HitDadUIProvider><AuthProvider><App /></AuthProvider></HitDadUIProvider>);
