import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Loading } from '../components/UI';
import { Modal } from '../components/Modal';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupName, setGroupName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const groupsRes = await api.get('getSportGroups');
      setGroups(groupsRes);
    } catch (err) {
      addToast('โหลดข้อมูลล้มเหลว', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveGroup = async () => {
    if (!groupName) return addToast('กรุณากรอกชื่อกลุ่ม', 'error');
    try {
      if (editingGroup) {
        await api.post('updateSportGroup', { id: editingGroup.id, name: groupName });
        addToast('อัปเดตกลุ่มสำเร็จ');
      } else {
        await api.post('addSportGroup', { name: groupName });
        addToast('เพิ่มกลุ่มสำเร็จ');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('ยืนยันการลบกลุ่มนี้?')) return;
    try {
      await api.post('deleteSportGroup', { id });
      addToast('ลบกลุ่มสำเร็จ');
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-ink">ตั้งค่า</h1>
      
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">จัดการกลุ่มกีฬา</h2>
          <Button onClick={() => { setEditingGroup(null); setGroupName(''); setModalOpen(true); }} className="px-4 py-1.5 text-sm">
            + เพิ่มกลุ่ม
          </Button>
        </div>

        {loading ? <Loading /> : (
          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.id} className="flex justify-between items-center p-3 border border-border rounded-xl">
                <span>{g.name}</span>
                <div className="flex gap-2">
                  <Button variant="text" className="px-2 py-1 text-sm" onClick={() => { setEditingGroup(g); setGroupName(g.name); setModalOpen(true); }}>แก้ไข</Button>
                  <Button variant="text" className="px-2 py-1 text-sm text-red-600" onClick={() => handleDeleteGroup(g.id)}>ลบ</Button>
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-ink-soft py-4 text-center">ยังไม่มีกลุ่มกีฬา</p>}
          </div>
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingGroup ? "แก้ไขกลุ่มกีฬา" : "เพิ่มกลุ่มกีฬา"}>
        <div className="space-y-4">
          <Input placeholder="ชื่อกลุ่มกีฬา" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <Button className="w-full" onClick={handleSaveGroup}>บันทึก</Button>
        </div>
      </Modal>
    </div>
  );
}
