import React, { useState, useEffect, useMemo } from 'react';
import { Card, Loading, Select, Button, Badge } from '../components/UI';
import { Modal } from '../components/Modal';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatThaiDate, getCurrentISODate, formatThaiTime } from '../utils/date';
import { Avatar } from '../components/Avatar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { Download, Users, UserCheck, Activity, Flame, Trophy, Calendar, ChevronRight } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const { user } = useAuth();

  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const [dayDetailModal, setDayDetailModal] = useState({ isOpen: false, session: null, records: [] });

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

  const filteredData = useMemo(() => {
    if (!data) return null;
    const { members, sessions, records, groups } = data;

    const today = new Date();
    let filterStart = new Date(0);
    let filterEnd = new Date(8640000000000000);

    if (dateFilter === 'today') { filterStart = new Date(getCurrentISODate()); filterEnd = new Date(getCurrentISODate()); }
    else if (dateFilter === 'week') { filterStart = startOfWeek(today, { weekStartsOn: 1 }); filterEnd = endOfWeek(today, { weekStartsOn: 1 }); }
    else if (dateFilter === 'month') { filterStart = startOfMonth(today); filterEnd = endOfMonth(today); }
    else if (dateFilter === 'custom' && startDate && endDate) { filterStart = new Date(startDate); filterEnd = new Date(endDate); }

    const todayDateStr = getCurrentISODate();

    const filteredSessions = sessions.filter(s => {
      if (s.session_date > todayDateStr) return false;
      const sDate = parseISO(s.session_date);
      const normSDate = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
      const normStart = new Date(filterStart.getFullYear(), filterStart.getMonth(), filterStart.getDate());
      const normEnd = new Date(filterEnd.getFullYear(), filterEnd.getMonth(), filterEnd.getDate());
      return normSDate >= normStart && normSDate <= normEnd;
    });

    const activeMembers = members.filter(m => m.status === 'active' && (groupFilter ? m.sport_group_id === groupFilter : true));
    const activeMemberIds = new Set(activeMembers.map(m => m.id));

    const sessionIds = new Set(filteredSessions.map(s => s.id));
    const relevantRecords = records.filter(r => sessionIds.has(r.session_id) && activeMemberIds.has(r.member_id));

    const totalActiveMembers = activeMembers.length;
    
    // Today stats
    const todaySession = sessions.find(s => s.session_date === todayDateStr);
    let checkedInToday = 0;
    if (todaySession) {
      checkedInToday = records.filter(r => r.session_id === todaySession.id && r.attendance_status === 'present' && activeMemberIds.has(r.member_id)).length;
    }

    const totalPresent = relevantRecords.filter(r => r.attendance_status === 'present').length;
    const leaveCount = relevantRecords.filter(r => r.attendance_status === 'leave').length;
    const totalPossible = Math.max(0, (totalActiveMembers * filteredSessions.length) - leaveCount);
    const attendanceRate = totalPossible === 0 ? 0 : Math.round((totalPresent / totalPossible) * 100);

    // Leaderboard & Streak
    let memberStats = {};
    activeMembers.forEach(m => memberStats[m.id] = { id: m.id, attendance: 0, streak: 0, currentStreak: 0, name: m.nickname, group_id: m.sport_group_id });
    
    const sortedSessions = [...sessions].sort((a,b) => a.session_date.localeCompare(b.session_date));
    sortedSessions.forEach(s => {
       if (s.session_date > todayDateStr) return;
       const sessionRecords = records.filter(r => r.session_id === s.id);
       const presentIds = new Set(sessionRecords.filter(r => r.attendance_status === 'present').map(r => r.member_id));
       const leaveIds = new Set(sessionRecords.filter(r => r.attendance_status === 'leave').map(r => r.member_id));
       
       activeMembers.forEach(m => {
           if (presentIds.has(m.id)) {
               memberStats[m.id].currentStreak++;
               if (memberStats[m.id].currentStreak > memberStats[m.id].streak) memberStats[m.id].streak = memberStats[m.id].currentStreak;
               if (sessionIds.has(s.id)) memberStats[m.id].attendance++; // Count attendance only in filter
           } else if (!leaveIds.has(m.id)) {
               // Only reset streak if they didn't leave (absent)
               memberStats[m.id].currentStreak = 0;
           }
       });
    });

    const topMembers = Object.values(memberStats).sort((a,b) => b.attendance - a.attendance).slice(0, 5);
    const maxStreakObj = Object.values(memberStats).sort((a,b) => b.streak - a.streak)[0];

    // Chart Data (Area Chart)
    const chartData = filteredSessions.slice(0, 30).reverse().map(s => {
        const sessionRecs = records.filter(r => r.session_id === s.id && activeMemberIds.has(r.member_id));
        const presentCount = sessionRecs.filter(r => r.attendance_status === 'present').length;
        const leaveCountForSession = sessionRecs.filter(r => r.attendance_status === 'leave').length;
        const possibleForSession = totalActiveMembers - leaveCountForSession;
        const rate = possibleForSession <= 0 ? 0 : Math.round((presentCount / possibleForSession) * 100);
        return {
            date: formatThaiDate(s.session_date).split(' ')[0] + ' ' + formatThaiDate(s.session_date).split(' ')[1],
            'เปอร์เซ็นต์การมา': rate,
            'มาซ้อม': presentCount,
            fullDate: s.session_date
        };
    });

    // Group Pie Chart Data
    const groupStats = {};
    groups.forEach(g => groupStats[g.id] = { name: g.name, value: 0 });
    activeMembers.forEach(m => {
       if (groupStats[m.sport_group_id]) {
           groupStats[m.sport_group_id].value += memberStats[m.id].attendance;
       }
    });
    const pieData = Object.values(groupStats).filter(g => g.value > 0);
    const PIE_COLORS = ['#0b57d0', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Table Data
    const tableData = filteredSessions.map(s => {
        const sessionRecs = records.filter(r => r.session_id === s.id && activeMemberIds.has(r.member_id));
        const presentCount = sessionRecs.filter(r => r.attendance_status === 'present').length;
        const leaveCountForSession = sessionRecs.filter(r => r.attendance_status === 'leave').length;
        const possibleForSession = totalActiveMembers - leaveCountForSession;
        const rate = possibleForSession <= 0 ? 0 : Math.round((presentCount / possibleForSession) * 100);
        return { ...s, presentCount, totalPossible: possibleForSession, rate };
    });

    return {
      totalActiveMembers,
      checkedInToday,
      notCheckedInToday: totalActiveMembers - checkedInToday,
      attendanceRate,
      topMembers,
      maxStreakObj,
      chartData,
      pieData,
      PIE_COLORS,
      tableData,
      activeMembers,
      groups
    };
  }, [data, dateFilter, startDate, endDate, groupFilter]);

  const handleExport = (type) => {
    // ... (Keep existing export logic)
    if (!filteredData) return;
    const exportData = [];
    filteredData.tableData.forEach(session => {
        const sessionRecords = data.records.filter(r => r.session_id === session.id);
        filteredData.activeMembers.forEach(member => {
            const record = sessionRecords.find(r => r.member_id === member.id);
            exportData.push({
                'วันที่': formatThaiDate(session.session_date),
                'ชื่อเล่น': member.nickname,
                'กลุ่มกีฬา': filteredData.groups.find(g => g.id === member.sport_group_id)?.name || '-',
                'สถานะการมา': record?.attendance_status === 'present' ? 'มา' : 'ขาด',
                'เวลาเช็คชื่อ': record?.checked_in_at ? formatThaiTime(record.checked_in_at) : '-',
                'หมายเหตุ': record?.note || ''
            });
        });
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    if (type === 'csv') XLSX.writeFile(workbook, "attendance_export.csv");
    else XLSX.writeFile(workbook, "attendance_export.xlsx");
  };

  const openDayDetail = (session) => {
    const sessionRecords = data.records.filter(r => r.session_id === session.id);
    setDayDetailModal({ isOpen: true, session, records: sessionRecords });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-surface/90 backdrop-blur-md p-3 border border-border rounded-xl shadow-xl text-sm">
           <p className="font-medium text-ink mb-2">{formatThaiDate(data.fullDate)}</p>
           <p className="text-primary font-medium">อัตราการมา: {data['เปอร์เซ็นต์การมา']}%</p>
           <p className="text-ink-soft">จำนวน: {data['มาซ้อม']} คน</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium text-ink tracking-tight mb-1">ภาพรวมการซ้อม</h1>
          <p className="text-ink-soft">สรุปข้อมูลสถิติและอัตราการเข้าร่วมของทีม</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExport('csv')} variant="secondary" className="flex items-center gap-2 rounded-xl text-sm shadow-sm"><Download size={16}/> CSV</Button>
          <Button onClick={() => handleExport('excel')} variant="primary" className="flex items-center gap-2 rounded-xl text-sm shadow-sm shadow-blue-200"><Download size={16}/> Excel</Button>
        </div>
      </div>

      {/* Modern Filter Bar */}
      <div className="bg-surface p-2 rounded-2xl border border-border/50 shadow-sm flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 border-r border-border/50 text-ink-soft">
          <Calendar size={18} />
          <span className="text-sm font-medium">ตัวกรอง</span>
        </div>
        
        {user ? (
          <>
            <Select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto py-1.5 text-sm border-none bg-transparent hover:bg-gray-50 focus:ring-0">
              <option value="all">ทั้งหมด (ตั้งแต่เริ่ม)</option>
              <option value="today">วันนี้</option>
              <option value="week">สัปดาห์นี้</option>
              <option value="month">เดือนนี้</option>
              <option value="custom">กำหนดเอง</option>
            </Select>
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm border-none bg-gray-50 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary" />
                <span className="text-ink-soft">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm border-none bg-gray-50 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div className="h-6 w-px bg-border/50 mx-2"></div>
          </>
        ) : (
          <div className="px-2 text-sm text-ink-soft">ตั้งแต่เริ่มซ้อม</div>
        )}

        <Select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="w-auto py-1.5 text-sm border-none bg-transparent hover:bg-gray-50 focus:ring-0">
          <option value="">ทุกกลุ่มกีฬา</option>
          {data?.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </div>

      {filteredData && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="!p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-primary"><Users size={20} /></div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Active</span>
              </div>
              <p className="text-sm text-ink-soft mb-1">สมาชิกทั้งหมด</p>
              <h3 className="text-3xl font-medium text-ink">{filteredData.totalActiveMembers}</h3>
            </Card>

            <Card className="!p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><UserCheck size={20} /></div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">วันนี้</span>
              </div>
              <p className="text-sm text-ink-soft mb-1">มาซ้อมล่าสุด</p>
              <h3 className="text-3xl font-medium text-ink">{filteredData.checkedInToday}</h3>
            </Card>

            <Card className="!p-5 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-purple-600"><Activity size={100} /></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Activity size={20} /></div>
              </div>
              <p className="text-sm text-ink-soft mb-1 relative z-10">อัตราการมาเฉลี่ย</p>
              <div className="flex items-end gap-2 relative z-10">
                <h3 className="text-3xl font-medium text-ink">{filteredData.attendanceRate}%</h3>
              </div>
            </Card>

            <Card className="!p-5 hover:shadow-md transition-shadow border border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><Flame size={20} /></div>
              </div>
              <p className="text-sm text-ink-soft mb-1">สถิติต่อเนื่องสูงสุด</p>
              <h3 className="text-3xl font-medium text-ink">{filteredData.maxStreakObj?.streak || 0} <span className="text-sm font-normal text-ink-soft">วัน</span></h3>
              <div className="flex items-center gap-2 mt-2">
                 {filteredData.maxStreakObj && (
                    <Avatar src={filteredData.activeMembers.find(m => m.id === filteredData.maxStreakObj.id)?.avatar_url} alt={filteredData.maxStreakObj.name} size="sm" />
                 )}
                 <p className="text-xs text-orange-600 truncate">โดย {filteredData.maxStreakObj?.name || '-'}</p>
              </div>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Area Chart */}
            <Card className="lg:col-span-2 !p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-medium text-ink">แนวโน้มการมาซ้อม</h3>
                    <p className="text-xs text-ink-soft mt-1">แสดงอัตราการเข้าร่วม 30 วันหลังสุดในหมวดที่เลือก</p>
                 </div>
              </div>
              <div className="flex-1 min-h-[300px] w-full">
                {filteredData.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0b57d0" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0b57d0" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f4f8" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#5f6368'}} dy={10} minTickGap={20} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#5f6368'}} domain={[0, 100]} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="เปอร์เซ็นต์การมา" stroke="#0b57d0" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" activeDot={{r: 6, fill: '#0b57d0', stroke: '#fff', strokeWidth: 2}} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-ink-soft">ไม่มีข้อมูลสำหรับช่วงเวลานี้</div>
                )}
              </div>
            </Card>

            {/* Right Col: Leaderboard */}
            <Card className="!p-0 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-gray-50/30">
                 <h3 className="text-lg font-medium text-ink flex items-center gap-2"><Trophy size={20} className="text-yellow-500"/> กระดานผู้นำ (Top 5)</h3>
                 <p className="text-xs text-ink-soft mt-1">อิงตามจำนวนครั้งที่มาซ้อม</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {filteredData.topMembers.length > 0 && filteredData.topMembers[0].attendance > 0 ? (
                    filteredData.topMembers.filter(m => m.attendance > 0).map((m, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-border/50">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                          ${idx === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white' : 
                            idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' : 
                            idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white' : 
                            'bg-gray-100 text-gray-500'}`}
                        >
                          {idx + 1}
                        </div>
                        <Avatar src={filteredData.activeMembers.find(member => member.id === m.id)?.avatar_url} alt={m.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink truncate">{m.name}</p>
                          <p className="text-xs text-ink-soft truncate">{filteredData.groups.find(g => g.id === m.group_id)?.name || 'ไม่ระบุกลุ่ม'}</p>
                        </div>
                        <div className="text-right">
                           <p className="font-medium text-primary">{m.attendance}</p>
                           <p className="text-[10px] text-ink-soft uppercase tracking-wider">ครั้ง</p>
                        </div>
                      </div>
                    ))
                 ) : (
                   <div className="text-center text-ink-soft py-8 text-sm">ยังไม่มีผู้มาซ้อม</div>
                 )}
              </div>
            </Card>

          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Group Distribution Pie */}
            <Card className="!p-6 flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium text-ink mb-6 self-start">สัดส่วนการมาซ้อมแยกตามกลุ่ม</h3>
              {filteredData.pieData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={filteredData.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {filteredData.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={filteredData.PIE_COLORS[index % filteredData.PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-ink-soft">ไม่มีข้อมูล</div>
              )}
            </Card>

            {/* Daily History Table */}
            <Card className="lg:col-span-2 !p-0 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-border/50">
                 <h3 className="text-lg font-medium text-ink">บันทึกการซ้อมรายวัน</h3>
              </div>
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 bg-surface z-10 shadow-sm">
                    <tr className="text-ink-soft text-xs uppercase tracking-wider">
                      <th className="py-4 px-6 font-medium">วันที่</th>
                      <th className="py-4 px-6 font-medium text-center">มา / ทั้งหมด</th>
                      <th className="py-4 px-6 font-medium">อัตราการมา</th>
                      <th className="py-4 px-6 font-medium text-right">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.tableData.map(s => (
                      <tr key={s.id} onClick={() => openDayDetail(s)} className="border-b border-border/50 hover:bg-gray-50/80 cursor-pointer transition-colors group">
                        <td className="py-4 px-6 font-medium text-ink">{formatThaiDate(s.session_date)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-medium text-ink">{s.presentCount}</span>
                          <span className="text-ink-soft text-xs ml-1"> / {s.totalPossible}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                             <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${s.rate >= 80 ? 'bg-green-500' : s.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${s.rate}%`}}></div>
                             </div>
                             <span className="text-sm font-medium">{s.rate}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                           <Button variant="text" className="!p-2 text-ink-soft group-hover:text-primary"><ChevronRight size={18}/></Button>
                        </td>
                      </tr>
                    ))}
                    {filteredData.tableData.length === 0 && (
                      <tr><td colSpan="4" className="text-center py-8 text-ink-soft">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
        </>
      )}

      {/* Day Detail Modal */}
      <Modal isOpen={dayDetailModal.isOpen} onClose={() => setDayDetailModal({ isOpen: false, session: null, records: [] })} title={`รายละเอียดวันที่ ${dayDetailModal.session ? formatThaiDate(dayDetailModal.session.session_date) : ''}`}>
        <div className="space-y-4">
           {dayDetailModal.session && (
               (() => {
                   const sessionRecords = dayDetailModal.records;
                   const presentMembers = filteredData.activeMembers.filter(m => sessionRecords.find(r => r.member_id === m.id && r.attendance_status === 'present'));
                   const absentMembers = filteredData.activeMembers.filter(m => !sessionRecords.find(r => r.member_id === m.id && r.attendance_status === 'present'));

                   return (
                       <div className="space-y-6">
                           <div>
                               <h4 className="font-medium text-green-700 mb-3 bg-green-50 p-2 rounded-lg inline-block px-4">มาซ้อม ({presentMembers.length})</h4>
                               <ul className="space-y-2">
                                   {presentMembers.map(m => {
                                       const r = sessionRecords.find(rec => rec.member_id === m.id);
                                       return (
                                           <li key={m.id} className="text-sm flex justify-between border-b border-gray-100 pb-2">
                                               <span className="font-medium">{m.nickname} {r.note && <span className="text-orange-600 ml-2 font-normal">({r.note})</span>}</span>
                                               <span className="text-gray-500">{formatThaiTime(r.checked_in_at)}</span>
                                           </li>
                                       );
                                   })}
                               </ul>
                           </div>
                           <div>
                               <h4 className="font-medium text-red-700 mb-3 bg-red-50 p-2 rounded-lg inline-block px-4">ขาดซ้อม ({absentMembers.length})</h4>
                               <ul className="space-y-2">
                                   {absentMembers.map(m => {
                                       const r = sessionRecords.find(rec => rec.member_id === m.id);
                                       return (
                                           <li key={m.id} className="text-sm flex justify-between border-b border-gray-100 pb-2">
                                               <span className="text-gray-600">{m.nickname}</span>
                                               {r?.note && <span className="text-orange-600">{r.note}</span>}
                                           </li>
                                       );
                                   })}
                               </ul>
                           </div>
                       </div>
                   );
               })()
           )}
        </div>
      </Modal>
    </div>
  );
}
