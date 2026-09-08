import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Select, Loading, Badge } from '../components/UI';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Plus, Edit2, Trash2, Camera } from 'lucide-react';

export default function ManageMembers() {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  
  const [formData, setFormData] = useState({
    nickname: '',
    sport_group_id: '',
    status: 'active',
    note: '',
    avatar_url: ''
  });

  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersData, groupsData] = await Promise.all([
        api.get('getMembers'),
        api.get('getSportGroups')
      ]);
      setMembers(membersData);
      setGroups(groupsData);
    } catch (err) {
      addToast('โหลดข้อมูลล้มเหลว', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (member = null) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        nickname: member.nickname,
        sport_group_id: member.sport_group_id || '',
        status: member.status,
        note: member.note || '',
        avatar_url: member.avatar_url || ''
      });
    } else {
      setEditingMember(null);
      setFormData({ nickname: '', sport_group_id: '', status: 'active', note: '', avatar_url: '' });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        // Cover crop to square
        const size = Math.min(width, height);
        const startX = (width - size) / 2;
        const startY = (height - size) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, size, size, 0, 0, MAX_SIZE, MAX_SIZE);
        
        // Compress to JPEG Base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, avatar_url: compressedBase64 }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nickname) return addToast('กรุณากรอกชื่อเล่น', 'error');

    try {
      if (editingMember) {
        await api.post('updateMember', { id: editingMember.id, ...formData });
        addToast('แก้ไขข้อมูลสำเร็จ');
      } else {
        await api.post('addMember', formData);
        addToast('เพิ่มสมาชิกสำเร็จ');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      addToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${name} ออกจากทีม? (ข้อมูลการซ้อมจะถูกซ่อนไว้ แต่ไม่หายไป)`)) {
      try {
        await api.post('deleteMember', { id, hardDelete: false });
        addToast('เปลี่ยนสถานะเป็นออกจากทีมแล้ว');
        fetchData();
      } catch (err) {
        addToast('ลบข้อมูลล้มเหลว', 'error');
      }
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-medium text-ink">จัดการสมาชิก</h1>
        <Button onClick={() => openModal()} className="flex items-center gap-2">
          <Plus size={18} /> เพิ่มสมาชิก
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-ink-soft text-sm">
                <th className="py-3 px-4 font-medium w-16">โปรไฟล์</th>
                <th className="py-3 px-4 font-medium">ชื่อเล่น</th>
                <th className="py-3 px-4 font-medium">กลุ่มกีฬา</th>
                <th className="py-3 px-4 font-medium">สถานะ</th>
                <th className="py-3 px-4 font-medium">หมายเหตุ</th>
                <th className="py-3 px-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <Avatar src={m.avatar_url} alt={m.nickname} size="md" />
                  </td>
                  <td className="py-3 px-4 font-medium">{m.nickname}</td>
                  <td className="py-3 px-4">{groups.find(g => g.id === m.sport_group_id)?.name || '-'}</td>
                  <td className="py-3 px-4">
                    <Badge status={m.status}>{m.status === 'active' ? 'ใช้งาน' : m.status === 'rest' ? 'พัก' : 'ออกจากทีม'}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-ink-soft">{m.note || '-'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="text" onClick={() => openModal(m)} className="!p-2 text-ink-soft hover:text-primary">
                        <Edit2 size={16} />
                      </Button>
                      <Button variant="text" onClick={() => handleDelete(m.id, m.nickname)} className="!p-2 text-ink-soft hover:text-red-500">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-ink-soft">ยังไม่มีสมาชิกในระบบ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMember ? 'แก้ไขข้อมูลสมาชิก' : 'เพิ่มสมาชิกใหม่'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
               <Avatar src={formData.avatar_url} alt={formData.nickname} size="xl" className="border-4 border-surface shadow-md group-hover:opacity-80 transition-opacity" />
               <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={24} className="text-white" />
               </div>
            </div>
            <p className="text-xs text-ink-soft mt-2 text-center">คลิกเพื่ออัปโหลดรูปภาพ<br/>(ภาพจะถูกลดขนาดอัตโนมัติเพื่อประหยัดพื้นที่)</p>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>

          <div>
            <label className="block text-sm text-ink mb-1">ชื่อเล่น</label>
            <Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="เช่น โอม, นัท" autoFocus required />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">กลุ่มกีฬา</label>
            <Select value={formData.sport_group_id} onChange={e => setFormData({...formData, sport_group_id: e.target.value})}>
              <option value="">ไม่ระบุกลุ่ม</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">สถานะ</label>
            <Select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="active">ใช้งาน (ซ้อมปกติ)</option>
              <option value="rest">พัก (บาดเจ็บ/พักชั่วคราว)</option>
              <option value="left">ออกจากทีม (ซ่อนจากหน้าเช็คชื่อ)</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">หมายเหตุ</label>
            <Input value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="ข้อมูลเพิ่มเติม..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</Button>
            <Button type="submit">บันทึกข้อมูล</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
