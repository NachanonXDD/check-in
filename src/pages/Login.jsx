import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card } from '../components/UI';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { addToast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return addToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
    
    setLoading(true);
    try {
      await signIn(email, password);
      addToast('เข้าสู่ระบบสำเร็จ');
    } catch (err) {
      addToast('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Team Logo" className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-md rounded-2xl" onError={(e) => {
            e.target.onerror = null; 
            e.target.outerHTML = '<div class="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-bold shadow-lg shadow-blue-200">A</div>';
          }} />
          <h1 className="text-2xl font-medium text-ink">ระบบเช็คชื่อทีมกีฬา</h1>
          <p className="text-ink-soft mt-2">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        <Card className="!p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">อีเมล (Email)</label>
              <Input 
                type="email" 
                placeholder="coach@myteam.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">รหัสผ่าน (Password)</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        </Card>
        <p className="text-center text-xs text-ink-soft mt-6">
          มีเพียงผู้จัดการทีมหรือโค้ชเท่านั้นที่สามารถเข้าถึงระบบนี้ได้
        </p>
      </div>
    </div>
  );
}
