import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Input, Textarea, Select, Card, Alert } from '../src/components/ui';
import HitDadUIProvider from '../src/components/ui/Provider';
import Modal from '../src/components/Modal/Modal';
import { useConfirmation } from '../src/components/Modal/ConfirmDialog';
import '../src/index.css';
import '../src/components/ui/theme.css';

function Controls() {
  const { confirm, confirmationDialog } = useConfirmation();
  const [result, setResult] = useState('Chưa gửi form');
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(0);
  const inputRef = useRef(null);
  return <main className="container" style={{ paddingTop: 24 }}>
    <h1>HitDad · Kiểm tra component</h1>
    <Card className="card" style={{ padding: 24, marginTop: 20 }}>
      <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setResult(`${data.get('name')} · ${data.get('date')} · ${data.get('choice')} · ${data.get('note')}`); }}>
        <label htmlFor="test-name">Tên thành viên</label>
        <Input id="test-name" name="name" ref={inputRef} required className="form-input" />
        <label htmlFor="test-date">Ngày đá</label>
        <Input id="test-date" name="date" type="date" required className="form-input" />
        <label htmlFor="test-select">Lựa chọn</label>
        <Select id="test-select" name="choice" className="form-input"><option value="JOIN">Tham gia</option><option value="DECLINE">Báo vắng</option></Select>
        <label htmlFor="test-note">Ghi chú</label>
        <Textarea id="test-note" name="note" required className="form-input" />
        <label><Input type="checkbox" name="confirmed" /> Xác nhận</label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <Button type="submit" className="btn btn-primary">Gửi form</Button>
          <Button type="button" className="btn btn-outline" onClick={() => inputRef.current.focus()}>Focus ô tên</Button>
          <Button type="button" disabled className="btn btn-outline" onClick={() => setEvents(value => value + 1)}>Đã khóa</Button>
        </div>
      </form>
      <Alert className="alert alert-info" style={{ marginTop: 16 }} role="status">{result}</Alert>
      <p>Số sự kiện từ nút khóa: {events}</p>
      <Button className="btn btn-primary" onClick={() => setOpen(true)}>Mở modal</Button>
    </Card>
    <Modal isOpen={open} onClose={() => setOpen(false)}>
      <Card className="card" style={{ padding: 24, maxWidth: 480, width: '100%' }}>
        <h2>Điểm danh HitDad</h2>
        <label htmlFor="modal-note">Ghi chú điểm danh</label>
        <Input id="modal-note" className="form-input" />
        <Button type="button" className="btn btn-outline" onClick={async () => { if (await confirm('Xác nhận dữ liệu mẫu?')) setResult('Đã xác nhận mẫu'); }}>Mở xác nhận lồng</Button>
        <Button className="btn btn-primary" onClick={() => setOpen(false)} style={{ marginTop: 16 }}>Đóng modal</Button>
      </Card>
      {confirmationDialog}
    </Modal>
  </main>;
}
createRoot(document.getElementById('root')).render(<HitDadUIProvider><Controls /></HitDadUIProvider>);
