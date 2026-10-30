// Isolated UI fixtures. Every response and mutation stays in this frame.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../src/context/AuthContext';
import HitDadUIProvider from '../src/components/ui/Provider';
import App from '../src/App';
import seed from './ui-fixture-data.json';
import '../src/index.css';
import '../src/components/ui/theme.css';
const params = new URLSearchParams(location.search);
const screen = params.get('screen') || 'dashboard';
const routes = { dashboard:'/',login:'/login',register:'/register',forgot:'/forgot-password',members:'/members',session:'/sessions/preview-match',payments:'/sessions/preview-booked',create:'/sessions/new',profile:'/profile',feedback:'/feedback',notices:'/notices',tournaments:'/tournaments',tournament:'/tournaments/preview-cup',registration:'/tournaments/preview-draft?tab=registration' };
const guest = ['login','register','forgot'].includes(screen);
const variant = params.get('state') || 'content';
// Guest frames cannot log their neighbors out or overwrite a real browser session.
const storage = new Map(guest ? [] : [['accessToken','ui-preview-only']]);
Object.defineProperty(window,'localStorage',{value:{ getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key),clear:()=>storage.clear() }});
const members = structuredClone(seed.members);
const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#194b7c"/><text x="60" y="75" font-size="42" text-anchor="middle" fill="white">CSE</text></svg>');
const user={...members[params.get('role')==='member'?1:0],phone:'0900000000',bankInfo:'Ngân hàng mẫu · 000000000',avatar:svg};
const votes=members.slice(0,14).map((u,i)=>({id:`vote-${i}`,userId:u.id,user:u,status:'JOIN',votedAt:'2026-10-20T10:00:00Z',isCheckedIn:i<6,timeSlotVotes:[]}));
const session={id:'preview-match',title:'Giao lưu cuối tuần · Câu lạc bộ CSE HitDad',status:'VOTING',playDate:'2026-11-07T00:00:00Z',startTime:'18:00',endTime:'20:00',location:'Sân bóng Đại học Bách Khoa',minPlayers:14,maxPlayers:20,createdBy:user,votes,selectedTimeSlotId:'slot-1',timeSlots:[{id:'slot-1',startTime:'18:00',endTime:'20:00',votes:votes.slice(0,7).map(v=>({vote:v}))},{id:'slot-2',startTime:'19:00',endTime:'21:00',votes:[]}],guests:[{id:'guest-1',name:'Khách mời Nguyễn Hoàng Minh Khánh',tier:'B+',status:'PLAYING',isCheckedIn:true,isPaid:false}]};
const booked={...session,id:'preview-booked',status:'BOOKED',totalCost:'600000',splitCount:15,payer:user,isVoteLocked:true};
const sessions=[session,booked,{...session,id:'cancelled',title:'Giao lưu CSE × BK',status:'CANCELLED',cancellationNote:'Sân tạm đóng do thời tiết. CLB sẽ thông báo lịch thay thế.'}];
let requests=[{id:'preview-applicant',username:'nguyenhoang',displayName:'Nguyễn Hoàng Anh Tuấn',email:'thanhvienmoi@example.com',phone:'0900000001',createdAt:'2026-10-30T01:00:00Z'}];
const cups=[{id:'preview-cup',title:'Giải futsal CSE HitDad · Cúp giao lưu mùa thu',state:structuredClone(seed.state)},{id:'preview-draft',title:'Đăng ký giải futsal sắp tới',state:structuredClone(seed.draft)}].map(t=>({...t,revision:0,organizerIds:[members[1].id],updatedAt:'2026-10-30T03:00:00Z',canManage:user.role==='ADMIN',canRegister:t.state.phase==='DRAFT',standings:[],playerStats:[],myRegistration:t.state.registrations.find(r=>r.userId===user.id)}));
for(const cup of cups)cup.standings=['A','B'].map(group=>({group,rows:cup.state.teams.filter(t=>t.group===group).map(t=>({teamId:t.id,name:t.name,group,played:0,won:0,lost:0,drawn:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0}))}));
const notices=[{id:'notice-1',title:'Mời thành viên đăng ký vị trí cho giải futsal',body:'Mỗi thành viên có thể chọn nhiều vị trí trên sơ đồ. BTC sẽ dùng nguyện vọng để chia đội và chốt vị trí chính thức. Chưa điền form sẽ không được tham gia giải.',author:user,createdAt:'2026-10-30T03:00:00Z',tournament:{id:'preview-draft'},isRead:false}];
let feedbacks=[{id:'feedback-1',category:'UX',rating:4,status:'NEW',message:'Đề xuất giúp các nút thao tác dễ bấm hơn trên màn hình điện thoại và luôn hiển thị rõ thông tin trận đấu.',user:members[8],pagePath:'/sessions/preview-match',createdAt:'2026-10-30T02:00:00Z',adminNote:''}];
const payment={id:'payment-1',amount:'40000',status:'PENDING',user,userId:user.id};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(url,options={})=>{
 const address=new URL(url,location.origin),path=address.pathname.replace(/^\/api/,'');
 const method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
 if(path==='/auth/me'||path==='/auth/login')return json({user,accessToken:'ui-preview-only',refreshToken:'ui-preview-only'});
 if(path==='/auth/send-otp'||path==='/auth/forgot-password/send-otp')return json({message:'Đã gửi mã giả lập',email:'m***@example.com'});
 if(path==='/auth/forgot-password/verify-otp')return json({resetToken:'ui-preview-only'});
 if(variant==='error'&&!path.startsWith('/auth/'))return json({error:'Mất kết nối dữ liệu mẫu. Vui lòng thử lại.'},503);
 if(variant==='empty'&&method==='GET'){
  if(path==='/sessions')return json({sessions:[]});
  if(path==='/tournaments')return json({tournaments:[]});
  if(path==='/notices')return json({notices:[],nextCursor:null});
  if(path==='/notices/summary')return json({unreadCount:0,latestUnread:null});
  if(path==='/feedback')return json({feedbacks:[],stats:{}});
 }
 if(path==='/users/membership-requests/count')return json({count:requests.length});
 if(path==='/users/membership-requests')return json({requests});
 if(path.startsWith('/users/membership-requests/')){requests=[];return json({message:'Đã duyệt thành viên mẫu'});}
 if(path==='/users/members')return json({members});
 if(path.endsWith('/qr-code'))return json({qrCodeImage:method==='DELETE'?null:svg});
 if(path==='/users/profile'){Object.assign(user,body);return json({user,message:'Đã lưu thông tin mẫu'});}
 if(path==='/users/avatar'){user.avatar=null;return json({message:'Đã xóa ảnh mẫu'});}
 if(/^\/users\/[^/]+\/tier$/.test(path)){const m=members.find(m=>path.includes(m.id));if(m)m.tier=body.tier;return json({user:m});}
 if(/^\/users\/[^/]+$/.test(path))return json({message:'Đã xử lý thành viên mẫu'});
 if(path==='/notices/summary')return json({unreadCount:notices.filter(n=>!n.isRead).length,latestUnread:notices.find(n=>!n.isRead)||null});
 if(path==='/notices')return json({notices,nextCursor:null});
 if(path.endsWith('/read')){notices[0].isRead=true;return json({success:true});}
 if(path==='/feedback')return json(method==='POST'?{message:'Đã gửi phản hồi mẫu'}:{feedbacks,stats:{total:1,NEW:1,REVIEWING:0,RESOLVED:0}});
 if(path.startsWith('/feedback/')){feedbacks[0]={...feedbacks[0],...body};return json({feedback:feedbacks[0]});}
 if(path==='/tournaments')return json({tournaments:cups.map(t=>({...t,phase:t.state.phase,settings:t.state.settings}))});
 if(path.startsWith('/tournaments/')){
  const cup=cups.find(t=>path.split('/')[2]===t.id)||cups[0];
  if(path.endsWith('/stream')){let timer;return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({tournament:cup})}\n\n`));timer=setInterval(()=>controller.enqueue(new TextEncoder().encode(': heartbeat\n\n')),10000);},cancel(){clearInterval(timer);}}),{headers:{'Content-Type':'text/event-stream'}});}
  return json({tournament:cup});
 }
 if(path==='/sessions')return json({sessions});
 if(path.endsWith('/attendance'))return json({session:booked,joined:votes,guests:session.guests,declined:[],maybe:[],absenceLogs:[],warnings:{lateCancellations:[],noShows:[]},summary:{attendedMembersCount:6,unattendedMembersCount:8,joinedCount:14,attendedGuestsCount:1,totalGuestsCount:1,totalAttendedOnPitch:7}});
 if(path.startsWith('/sessions/'))return json({session:path.includes('preview-booked')?booked:session});
 if(path.startsWith('/payments/session/'))return json({payments:[payment],summary:{total:600000,confirmed:0,paid:0,pending:600000,totalMembers:15,confirmedCount:0}});
 if(path.endsWith('/payos-link'))return json({accountNumber:'000000000',accountName:'CLB MẪU',bin:'970422',amount:40000,qrCode:svg,status:'PENDING',description:'BẢN MẪU'});
 if(path.endsWith('/payos-status'))return json({status:'PENDING',isPaid:false});
 if(path.startsWith('/payments/'))return json({message:'Đã cập nhật thanh toán mẫu'});
 if(path.startsWith('/votes'))return json({votes,message:'Đã cập nhật bình chọn mẫu'});
 console.warn('Unhandled UI fixture request:',path);return json({error:'Chưa có dữ liệu mẫu cho thao tác này'},404);
};
history.replaceState(null,'',routes[screen]||'/');
createRoot(document.getElementById('root')).render(<HitDadUIProvider><AuthProvider><App /></AuthProvider></HitDadUIProvider>);
