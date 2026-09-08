import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input, Select, Loading, EmptyState } from '../components/UI';
import { ConfirmDialog, Modal } from '../components/Modal';
import { api } from '../services/api';
import { formatThaiDate, formatThaiTime, getCurrentISODate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { Search, CheckCircle2, Circle, X } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export default function CheckIn() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [records, setRecords] = useState([]);
  const [currentDate, setCurrentDate] = useState(getCurrentISODate());
  
  // Filters
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  // Modals
  const [cancelModal, setCancelModal] = useState({ isOpen: false, member: null });
  const [checkAllModal, setCheckAllModal] = useState(false);
  const [noteModal, setNoteModal] = useState({ isOpen: false, member: null, note: '' });

  const { addToast } = useToast();
  
  // Realtime Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, groupsRes, attendanceRes] = await Promise.all([
        api.get('getMembers'),
        api.get('getSportGroups'),
        api.get('getAttendance', { date: currentDate })
      ]);
      setMembers(membersRes.filter(m => m.status === 'active'));
      setGroups(groupsRes);
      setRecords(attendanceRes.records);
    } catch (err) {
      addToast(err.message || 'ไม่สามารถโหลดข้อมูลได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const handleCheckIn = async (member) => {
    // Optimistic Update
    const now = new Date().toISOString();
    const tempRecord = { member_id: member.id, attendance_status: 'present', checked_in_at: now };
    setRecords(prev => {
      const existing = prev.find(r => r.member_id === member.id);
      if (existing) return prev.map(r => r.member_id === member.id ? { ...r, ...tempRecord } : r);
      return [...prev, tempRecord];
    });
    
    try {
      await api.post('checkIn', { member_id: member.id, date: currentDate });
      addToast(`เช็คชื่อ ${member.nickname} แล้ว เวลา ${formatThaiTime(now)}`);
    } catch (err) {
      addToast('เกิดข้อผิดพลาดในการเช็คชื่อ', 'error');
      fetchData(); // Revert
    }
  };

  const handleCancelCheckIn = async () => {
    const member = cancelModal.member;
    setCancelModal({ isOpen: false, member: null });
    
    // Optimistic
    setRecords(prev => prev.filter(r => r.member_id !== member.id));
    
    try {
      await api.post('cancelCheckIn', { member_id: member.id, date: currentDate });
      addToast(`ยกเลิกเช็คชื่อ ${member.nickname} แล้ว`);
    } catch (err) {
      addToast('เกิดข้อผิดพลาด', 'error');
      fetchData();
    }
  };

  const handleCheckAll = async () => {
    const unCheckedIds = getFilteredMembers(false).map(m => m.id);
    if (unCheckedIds.length === 0) return;

    setCheckAllModal(false);
    
    // Optimistic
    const now = new Date().toISOString();
    const newRecords = unCheckedIds.map(id => ({ member_id: id, attendance_status: 'present', checked_in_at: now }));
    setRecords(prev => {
      let next = [...prev];
      newRecords.forEach(nr => {
        if (!next.find(r => r.member_id === nr.member_id)) {
           next.push(nr);
        }
      });
      return next;
    });

    try {
      await api.post('checkAll', { member_ids: unCheckedIds, date: currentDate });
      addToast(`เช็คชื่อทั้งหมดสำเร็จ`);
    } catch (err) {
      addToast('เกิดข้อผิดพลาด', 'error');
      fetchData();
    }
  };

  const handleSaveNote = async () => {
    const { member, note } = noteModal;
    setNoteModal({ isOpen: false, member: null, note: '' });
    
    setRecords(prev => {
      const existing = prev.find(r => r.member_id === member.id);
      if (existing) return prev.map(r => r.member_id === member.id ? { ...r, note } : r);
      return [...prev, { member_id: member.id, note }];
    });

    try {
      await api.post('updateNote', { member_id: member.id, date: currentDate, note });
      addToast(`บันทึกหมายเหตุ ${member.nickname} สำเร็จ`);
    } catch (err) {
      addToast('เกิดข้อผิดพลาด', 'error');
      fetchData();
    }
  };

  const getRecord = (memberId) => records.find(r => r.member_id === memberId);
  const isCheckedIn = (memberId) => getRecord(memberId)?.attendance_status === 'present';

  const getFilteredMembers = (checked) => {
    return members
      .filter(m => isCheckedIn(m.id) === checked)
      .filter(m => m.nickname.toLowerCase().includes(search.toLowerCase()))
      .filter(m => groupFilter ? m.sport_group_id === groupFilter : true)
      .sort((a, b) => {
        if (checked) {
          // Sort by checked in time desc
          const timeA = getRecord(a.id)?.checked_in_at || '';
          const timeB = getRecord(b.id)?.checked_in_at || '';
          return timeB.localeCompare(timeA);
        }
        return a.nickname.localeCompare(b.nickname, 'th');
      });
  };

  const unCheckedList = getFilteredMembers(false);
  const checkedList = getFilteredMembers(true);
  
  const totalCount = members.length;
  const checkedCount = members.filter(m => isCheckedIn(m.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink">เช็คชื่อการซ้อม</h1>
          <div className="text-ink-soft mt-1">
            <span className="font-medium text-primary mr-3">{formatThaiDate(time)}</span>
            <span>{formatThaiTime(time)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Input 
            type="date" 
            value={currentDate} 
            onChange={(e) => setCurrentDate(e.target.value)} 
            className="w-auto"
          />
        </div>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3 text-gray-400" size={20} />
            <Input 
              placeholder="ค้นหาชื่อเล่น..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11"
            />
          </div>
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="md:w-48">
            <option value="">ทุกกลุ่มกีฬา</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-medium text-ink-soft">
            เช็คชื่อแล้ว <span className="text-primary text-lg">{checkedCount}</span> / {totalCount} คน
          </div>
          <Button onClick={() => setCheckAllModal(true)} disabled={unCheckedList.length === 0 || loading}>
            เช็คชื่อทั้งหมด
          </Button>
        </div>

        {loading ? <Loading /> : (
          <div className="space-y-8">
            {/* Unchecked */}
            <div>
              <h3 className="text-lg font-medium mb-3 text-ink">ยังไม่เช็คชื่อ ({unCheckedList.length})</h3>
              {unCheckedList.length === 0 ? <p className="text-ink-soft text-sm">ไม่มีสมาชิกในส่วนนี้</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unCheckedList.map(m => {
                    const group = groups.find(g => g.id === m.sport_group_id)?.name || '-';
                    const note = getRecord(m.id)?.note;
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 border border-border rounded-2xl bg-gray-50/50">
                        <div className="flex-1 cursor-pointer flex items-center gap-3" onClick={() => setNoteModal({ isOpen: true, member: m, note: note || '' })}>
                          <Avatar src={m.avatar_url} alt={m.nickname} size="sm" />
                          <div>
                            <div className="font-medium text-ink">{m.nickname} <span className="text-xs text-ink-soft font-normal ml-1">({group})</span></div>
                            {note && <div className="text-xs text-orange-600 mt-0.5 truncate">หมายเหตุ: {note}</div>}
                          </div>
                        </div>
                        <Button variant="secondary" className="px-4 py-1.5 text-sm shrink-0" onClick={() => handleCheckIn(m)}>เช็คชื่อ</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checked */}
            <div>
              <h3 className="text-lg font-medium mb-3 text-ink">เช็คชื่อแล้ว ({checkedList.length})</h3>
              {checkedList.length === 0 ? <p className="text-ink-soft text-sm">ยังไม่มีคนเช็คชื่อ</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {checkedList.map(m => {
                    const group = groups.find(g => g.id === m.sport_group_id)?.name || '-';
                    const record = getRecord(m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-2xl">
                        <div className="flex-1 cursor-pointer flex items-center gap-3" onClick={() => setNoteModal({ isOpen: true, member: m, note: record?.note || '' })}>
                          <Avatar src={m.avatar_url} alt={m.nickname} size="sm" />
                          <div>
                            <div className="font-medium text-ink">{m.nickname} <span className="text-xs text-ink-soft font-normal ml-1">({group})</span></div>
                            <div className="flex items-center gap-2 mt-0.5">
                               <span className="text-xs text-green-700">{formatThaiTime(record?.checked_in_at)}</span>
                               {record?.note && <span className="text-xs text-orange-600 truncate">หมายเหตุ: {record.note}</span>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setCancelModal({ isOpen: true, member: m })} className="text-ink-soft hover:text-red-500 p-2">
                           &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog 
        isOpen={cancelModal.isOpen} 
        onClose={() => setCancelModal({ isOpen: false, member: null })}
        onConfirm={handleCancelCheckIn}
        title="ยกเลิกเช็คชื่อ"
        message={`ต้องการยกเลิกการเช็คชื่อของ ${cancelModal.member?.nickname} หรือไม่?`}
        isDanger={true}
      />

      <ConfirmDialog 
        isOpen={checkAllModal} 
        onClose={() => setCheckAllModal(false)}
        onConfirm={handleCheckAll}
        title="เช็คชื่อทั้งหมด"
        message="ต้องการเช็คชื่อสมาชิกที่ยังไม่ได้เช็คชื่อทั้งหมดหรือไม่?"
      />

      <Modal isOpen={noteModal.isOpen} onClose={() => setNoteModal({ isOpen: false, member: null, note: '' })} title={`หมายเหตุ: ${noteModal.member?.nickname}`}>
        <div className="space-y-4">
          <Input 
            placeholder="เช่น มาสาย, ซ้อมแยก, บาดเจ็บ" 
            value={noteModal.note}
            onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
            autoFocus
          />
          <Button className="w-full" onClick={handleSaveNote}>บันทึกหมายเหตุ</Button>
        </div>
      </Modal>
    </div>
  );
}
