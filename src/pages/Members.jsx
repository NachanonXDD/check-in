import React, { useState, useEffect, useMemo } from 'react';
import { Card, Loading, Select, Input, Badge } from '../components/UI';
import { Modal } from '../components/Modal';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatThaiDate, formatThaiTime, getCurrentISODate } from '../utils/date';
import { Search } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export default function Members() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sort, setSort] = useState('name');

  // Date Filters with localStorage memory
  const [dateFilter, setDateFilter] = useState(() => localStorage.getItem('members_dateFilter') || 'all');
  const [startDate, setStartDate] = useState(() => localStorage.getItem('members_startDate') || '');
  const [endDate, setEndDate] = useState(() => localStorage.getItem('members_endDate') || '');

  const [detailModal, setDetailModal] = useState({ isOpen: false, member: null, stats: null });

  useEffect(() => {
    localStorage.setItem('members_dateFilter', dateFilter);
    localStorage.setItem('members_startDate', startDate);
    localStorage.setItem('members_endDate', endDate);
  }, [dateFilter, startDate, endDate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.get('getDashboardData');
        setData(result);
      } catch (err) {
        addToast('โหลดข้อมูลล้มเหลว', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const processedMembers = useMemo(() => {
    if (!data) return [];
    const { members, sessions, records } = data;

    const today = new Date();
    let filterStart = new Date(0);
    let filterEnd = new Date(8640000000000000); // Max date

    if (dateFilter === 'today') {
      filterStart = new Date(getCurrentISODate());
      filterEnd = new Date(getCurrentISODate());
    } else if (dateFilter === 'week') {
      filterStart = startOfWeek(today, { weekStartsOn: 1 });
      filterEnd = endOfWeek(today, { weekStartsOn: 1 });
    } else if (dateFilter === 'month') {
      filterStart = startOfMonth(today);
      filterEnd = endOfMonth(today);
    } else if (dateFilter === 'custom' && startDate) {
      filterStart = new Date(startDate);
      filterEnd = endDate ? new Date(endDate) : new Date(8640000000000000);
    }

    const todayDateStr = getCurrentISODate();

    const filteredSessions = sessions.filter(s => {
      // Ignore future sessions automatically created by viewing future dates in Check-In
      if (s.session_date > todayDateStr) return false;

      const sDate = parseISO(s.session_date);
      const normSDate = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
      const normStart = new Date(filterStart.getFullYear(), filterStart.getMonth(), filterStart.getDate());
      const normEnd = new Date(filterEnd.getFullYear(), filterEnd.getMonth(), filterEnd.getDate());
      return normSDate >= normStart && normSDate <= normEnd;
    });

    const memberStats = members.map(m => {
        const memberCreatedAt = new Date(m.created_at);
        // Valid sessions are those in the date filter AND after the member was created
        const validSessions = filteredSessions.filter(s => new Date(s.session_date) >= new Date(memberCreatedAt.getFullYear(), memberCreatedAt.getMonth(), memberCreatedAt.getDate()));
        
        const validSessionIds = new Set(validSessions.map(s => s.id));
        const presentRecords = records.filter(r => r.member_id === m.id && r.attendance_status === 'present' && validSessionIds.has(r.session_id));
        const leaveRecords = records.filter(r => r.member_id === m.id && r.attendance_status === 'leave' && validSessionIds.has(r.session_id));
        
        const totalPresent = presentRecords.length;
        const totalLeave = leaveRecords.length;
        const totalSessions = Math.max(0, validSessions.length - totalLeave);
        const totalAbsent = Math.max(0, totalSessions - totalPresent);
        const rate = totalSessions === 0 ? 0 : Math.round((totalPresent / totalSessions) * 100);
        
        let currentStreak = 0;
        let lastPresent = null;
        let lastAbsent = null;

        const sortedValidSessions = [...validSessions].sort((a,b) => b.session_date.localeCompare(a.session_date)); // Newest first

        for (let i = 0; i < sortedValidSessions.length; i++) {
            const s = sortedValidSessions[i];
            const r = records.find(rec => rec.session_id === s.id && rec.member_id === m.id);
            if (r && r.attendance_status === 'present') {
                if (!lastPresent) lastPresent = s.session_date;
                if (!lastAbsent) currentStreak++;
            } else if (r && r.attendance_status === 'leave') {
                // Don't break streak for leave
                continue;
            } else {
                if (!lastAbsent) lastAbsent = s.session_date;
            }
        }

        // For Charts
        const pieData = [
           { name: 'มาซ้อม', value: totalPresent, color: '#10b981' }, // green-500
           { name: 'ขาดซ้อม', value: totalAbsent, color: '#ef4444' } // red-500
        ];
        if (totalLeave > 0) pieData.push({ name: 'ลาพัก', value: totalLeave, color: '#f97316' }); // orange-500

        // Bar Chart (Last 10 sessions in filter)
        const last10Sessions = [...sortedValidSessions].slice(0, 10).reverse();
        const barData = last10Sessions.map(s => {
           const r = records.find(rec => rec.session_id === s.id && rec.member_id === m.id);
           let status = 0;
           let label = 'ขาด';
           if (r && r.attendance_status === 'present') {
               status = 1;
               label = 'มา';
           } else if (r && r.attendance_status === 'leave') {
               status = 0.5; // Visual representation of leave
               label = 'ลา';
           }
           return {
               date: formatThaiDate(s.session_date).split(' ')[0],
               status,
               fullDate: s.session_date,
               label
           };
        });

        return {
            ...m,
            totalPresent,
            totalSessions,
            rate,
            currentStreak,
            lastPresent,
            lastAbsent,
            pieData,
            barData,
            sortedValidSessions
        };
    });

    return memberStats
      .filter(m => m.nickname.toLowerCase().includes(search.toLowerCase()))
      .filter(m => groupFilter ? m.sport_group_id === groupFilter : true)
      .filter(m => statusFilter ? m.status === statusFilter : true)
      .sort((a, b) => {
          if (sort === 'name') return a.nickname.localeCompare(b.nickname, 'th');
          if (sort === 'attendance_desc') return b.totalPresent - a.totalPresent;
          if (sort === 'rate_desc') return b.rate - a.rate;
          if (sort === 'absent_desc') return (b.totalSessions - b.totalPresent) - (a.totalSessions - a.totalPresent);
          return 0;
      });

  }, [data, search, groupFilter, statusFilter, sort, dateFilter, startDate, endDate]);

  const openDetail = (member) => {
      setDetailModal({ isOpen: true, member, stats: member });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-sm">
           <p className="font-medium text-gray-800">{formatThaiDate(data.fullDate)}</p>
           <p className={data.status === 1 ? 'text-green-600' : 'text-red-500'}>สถานะ: {data.label}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-ink">รายบุคคล</h1>
      
      <Card>
        {user && (
          <div className="flex flex-wrap gap-4 items-end mb-6 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
            <div>
              <label className="block text-xs text-blue-800 font-medium mb-1">ช่วงเวลาที่ใช้นับสถิติ (เฉพาะแอดมิน)</label>
              <Select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40 py-2 border-blue-200 focus:border-blue-500 focus:ring-blue-500">
                <option value="all">ทั้งหมด (ตั้งแต่เริ่ม)</option>
                <option value="month">เดือนนี้</option>
                <option value="custom">กำหนดวันเริ่มซ้อม</option>
              </Select>
            </div>
            {dateFilter === 'custom' && (
              <>
                <div>
                  <label className="block text-xs text-blue-800 font-medium mb-1">เริ่มซ้อมเมื่อ</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-blue-200 rounded-full px-3 py-1.5 bg-surface focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-blue-800 font-medium mb-1">ถึงวันที่ (ไม่ระบุก็ได้)</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-blue-200 rounded-full px-3 py-1.5 bg-surface focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-3 text-gray-400" size={20} />
            <Input 
              placeholder="ค้นหาชื่อเล่น..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">กลุ่มกีฬา</label>
            <Select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="w-32 py-2">
              <option value="">ทุกกลุ่ม</option>
              {data?.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">สถานะ</label>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-32 py-2">
              <option value="">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="rest">พัก</option>
              <option value="left">ออกจากทีม</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">เรียงตาม</label>
            <Select value={sort} onChange={e => setSort(e.target.value)} className="w-40 py-2">
              <option value="name">ชื่อเล่น ก-ฮ</option>
              <option value="attendance_desc">มาซ้อมมากที่สุด</option>
              <option value="rate_desc">อัตราการมาสูงสุด</option>
              <option value="absent_desc">ขาดซ้อมมากที่สุด</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-ink-soft text-sm">
                <th className="py-3 px-4 font-medium w-16"></th>
                <th className="py-3 px-4 font-medium">ชื่อเล่น</th>
                <th className="py-3 px-4 font-medium">กลุ่มกีฬา</th>
                <th className="py-3 px-4 font-medium">มาซ้อม</th>
                <th className="py-3 px-4 font-medium">อัตราการมา</th>
                <th className="py-3 px-4 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {processedMembers.map(m => (
                <tr key={m.id} onClick={() => openDetail(m)} className="border-b border-border/50 hover:bg-gray-50/50 cursor-pointer">
                  <td className="py-3 px-4"><Avatar src={m.avatar_url} alt={m.nickname} size="sm" /></td>
                  <td className="py-3 px-4 font-medium">{m.nickname}</td>
                  <td className="py-3 px-4 text-sm">{data.groups.find(g => g.id === m.sport_group_id)?.name || '-'}</td>
                  <td className="py-3 px-4 text-sm">{m.totalPresent} / {m.totalSessions}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                       <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.rate >= 80 ? 'bg-green-500' : m.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${m.rate}%`}}></div>
                       </div>
                       <span className="text-xs">{m.rate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge status={m.status}>{m.status === 'active' ? 'ใช้งาน' : m.status === 'rest' ? 'พัก' : 'ออกจากทีม'}</Badge>
                  </td>
                </tr>
              ))}
              {processedMembers.length === 0 && (
                <tr><td colSpan="5" className="text-center py-8 text-ink-soft">ไม่พบสมาชิก หรือไม่มีวันซ้อมในช่วงเวลาที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Member Detail Modal */}
      {detailModal.isOpen && detailModal.stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface radius-card w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-start p-6 border-b border-border sticky top-0 bg-surface z-10">
              <div className="flex items-center gap-4">
                <Avatar src={detailModal.member?.avatar_url} alt={detailModal.member?.nickname} size="lg" />
                <div>
                  <h2 className="text-xl font-medium text-ink">ข้อมูลการซ้อม: {detailModal.member?.nickname}</h2>
                  <p className="text-sm text-ink-soft mt-1">ช่วงเวลาที่ประเมินผล: {dateFilter === 'all' ? 'ตั้งแต่เข้าร่วมทีม' : dateFilter === 'month' ? 'เดือนนี้' : `ตั้งแต่วันที่ ${formatThaiDate(startDate)}`}</p>
                </div>
              </div>
              <button onClick={() => setDetailModal({ isOpen: false, member: null, stats: null })} className="text-ink-soft hover:text-ink text-2xl leading-none bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
            </div>
            
            <div className="p-6 space-y-8">
              
              {/* Highlight Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-blue-50 p-3 rounded-2xl">
                    <p className="text-xs text-blue-800 mb-1">กลุ่มกีฬา</p>
                    <p className="font-medium text-blue-900">{data.groups.find(g => g.id === detailModal.stats.sport_group_id)?.name || '-'}</p>
                 </div>
                 <div className="bg-purple-50 p-3 rounded-2xl">
                    <p className="text-xs text-purple-800 mb-1">อัตราการมา</p>
                    <p className="font-medium text-purple-900 text-lg">{detailModal.stats.rate}%</p>
                 </div>
                 <div className="bg-green-50 p-3 rounded-2xl">
                    <p className="text-xs text-green-800 mb-1">มาซ้อม (วัน)</p>
                    <p className="font-medium text-green-900 text-lg">{detailModal.stats.totalPresent} <span className="text-sm font-normal">/ {detailModal.stats.totalSessions}</span></p>
                 </div>
                 <div className="bg-orange-50 p-3 rounded-2xl">
                    <p className="text-xs text-orange-800 mb-1">ต่อเนื่อง</p>
                    <p className="font-medium text-orange-900 text-lg">{detailModal.stats.currentStreak} <span className="text-sm font-normal">วัน</span></p>
                 </div>
              </div>

              {/* Charts Section */}
              {detailModal.stats.totalSessions > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div className="border border-border rounded-3xl p-4">
                    <h3 className="text-sm font-medium text-ink mb-4 text-center">สัดส่วนการมาซ้อม</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detailModal.stats.pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                            {detailModal.stats.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="border border-border rounded-3xl p-4">
                    <h3 className="text-sm font-medium text-ink mb-4 text-center">ประวัติล่าสุด (10 ครั้ง)</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detailModal.stats.barData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e3e1" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis hide domain={[0, 1]} />
                          <Tooltip content={<CustomTooltip />} cursor={{fill: '#f0f4f8'}} />
                          <Bar dataKey="status" radius={[4, 4, 0, 0]}>
                            {detailModal.stats.barData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.status === 1 ? '#10b981' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* History List */}
              <div>
                  <h4 className="font-medium text-ink mb-3">บันทึกการซ้อมทั้งหมด (ตามช่วงเวลาที่กรอง)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                      {detailModal.stats.sortedValidSessions.map(s => {
                          const r = data.records.find(rec => rec.session_id === s.id && rec.member_id === detailModal.member.id);
                          const isPresent = r && r.attendance_status === 'present';
                          return (
                              <div key={s.id} className="flex justify-between items-center text-sm p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100 transition-colors">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-ink-muted">{formatThaiDate(s.session_date)}</span>
                                    {r?.note && <span className="text-xs text-orange-600 truncate max-w-[120px]">หมายเหตุ: {r.note}</span>}
                                  </div>
                                  <div className="flex items-center">
                                      {isPresent ? (
                                          <Badge status="active">มา - {formatThaiTime(r.checked_in_at)}</Badge>
                                      ) : (
                                          <Badge status="left">ขาด</Badge>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                      {detailModal.stats.sortedValidSessions.length === 0 && (
                        <p className="text-sm text-ink-soft col-span-2 text-center py-4">ไม่มีประวัติการซ้อม</p>
                      )}
                  </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
