import React from 'react';
import { NavLink } from 'react-router-dom';
import { ClipboardCheck, LayoutDashboard, Users, UserCog, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const NAV_ITEMS = [
  { path: '/', label: 'เช็คชื่อ', icon: ClipboardCheck },
  { path: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { path: '/members', label: 'รายบุคคล', icon: Users },
  { path: '/manage', label: 'จัดการสมาชิก', icon: UserCog },
  { path: '/settings', label: 'ตั้งค่า', icon: Settings },
];

export const Sidebar = () => {
  const { signOut } = useAuth();
  const { addToast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      addToast('ออกจากระบบแล้ว');
    } catch (e) {
      addToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  return (
    <div className="hidden md:flex flex-col w-64 h-screen bg-surface border-r border-border fixed left-0 top-0">
      <div className="p-6 flex items-center justify-center">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Team Logo" className="max-h-16 object-contain" onError={(e) => e.target.style.display = 'none'} />
        <h1 className="text-2xl font-medium text-primary hidden">Attendance</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 radius-pill transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-primary font-medium' 
                  : 'text-ink-soft hover:bg-gray-50 hover:text-ink'
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
         <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 radius-pill transition-colors text-red-600 hover:bg-red-50 w-full text-left font-medium">
            <LogOut size={20} />
            <span>ออกจากระบบ</span>
         </button>
      </div>
    </div>
  );
};

export const BottomNav = () => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-border z-40 pb-safe">
      <nav className="flex justify-around items-center h-16">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? 'text-primary' : 'text-ink-soft'
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export const Layout = ({ children }) => {
  const { signOut } = useAuth();
  
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <div className="md:ml-64 pb-20 md:pb-0 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        {children}
      </div>
      <BottomNav />
      {/* Add a tiny logout button for mobile since bottom nav is full */}
      <div className="md:hidden fixed top-4 right-4 z-40">
        <button onClick={() => { if(confirm('ต้องการออกจากระบบ?')) signOut() }} className="bg-white text-red-600 p-2 rounded-full shadow-md border border-gray-100">
           <LogOut size={20} />
        </button>
      </div>
    </div>
  );
};
