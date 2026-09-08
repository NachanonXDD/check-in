# ระบบเช็คชื่อการมาซ้อมของทีมกีฬา

ระบบเช็คชื่อทีมกีฬา พัฒนาด้วย React (Vite) + Tailwind CSS และเชื่อมต่อฐานข้อมูล Google Sheets ผ่าน Google Apps Script (API)

## การตั้งค่า Google Sheets และ API

1. สร้าง Google Sheet ใหม่
2. ไปที่เมนู **Extensions (ส่วนขยาย) > Apps Script**
3. ลบโค้ดเดิมออกทั้งหมด และคัดลอกโค้ดจากไฟล์ `apps-script/Code.gs` ไปวาง
4. กดปุ่ม **Run (เรียกใช้)** และเลือกฟังก์ชัน `setupSheet` เพื่อสร้างตารางข้อมูลและโครงสร้างอัตโนมัติ (ระบบจะขอสิทธิ์เข้าถึง ให้กดยินยอม)
5. กดปุ่ม **Deploy (การทำให้ใช้งานได้) > New deployment (การทำให้ใช้งานได้รายการใหม่)**
6. ตั้งค่าดังนี้:
   - Select type: **Web app**
   - Execute as: **Me** (ตัวคุณเอง)
   - Who has access: **Anyone** (ทุกคน)
7. กด **Deploy** และคัดลอก **Web app URL** ที่ได้มาเก็บไว้

## การตั้งค่า Frontend

1. ติดตั้ง Node.js (https://nodejs.org/)
2. โคลนโปรเจกต์นี้และเปิด Terminal ในโฟลเดอร์โปรเจกต์
3. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
4. สร้างไฟล์ `.env` ที่ root ของโปรเจกต์ และใส่ URL ที่ได้จากขั้นตอนก่อนหน้า:
   ```env
   VITE_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
5. รันโปรเจกต์เพื่อทดสอบในเครื่อง:
   ```bash
   npm run dev
   ```

## การนำขึ้น GitHub Pages (Deploy)

โปรเจกต์นี้รองรับการ Deploy ผ่าน GitHub Actions อัตโนมัติ

1. อัปโหลดโค้ดขึ้น GitHub Repository ของคุณ
2. ไปที่ **Settings > Secrets and variables > Actions** ของ Repository
3. กด **New repository secret**
   - Name: `VITE_API_URL`
   - Secret: *ใส่ Web App URL ของคุณ*
4. ไปที่ **Settings > Pages** ของ Repository
   - Source: เลือก **GitHub Actions**
5. เมื่อตั้งค่าเสร็จสิ้น ทุกครั้งที่มีการ Push โค้ดไปยัง Branch `main` ระบบจะทำการ Build และ Deploy ไปยัง GitHub Pages ให้โดยอัตโนมัติ

## วิธีแก้ปัญหา API/CORS

- หากฝั่ง Frontend ขึ้น Error `CORS Policy` สาเหตุหลักมักมาจากการที่ Google Apps Script ห้ามใช้ Method OPTIONS สำหรับ Preflight Request การแก้ไขคือฝั่ง Frontend เราใช้ Header `Content-Type: text/plain` เพื่อข้าม Preflight (ตามที่เขียนใน `src/services/api.js`)
- ตรวจสอบให้แน่ใจว่าตอน Deploy Apps Script ได้ตั้งค่า **Who has access** เป็น **Anyone** (ไม่ใช่ Anyone with Google Account)

## วิธี Backup Google Sheets

- ข้อมูลทั้งหมดจะถูกเก็บใน Google Sheets ของคุณ คุณสามารถดาวน์โหลดเป็น Excel ได้โดยตรงผ่านเมนู **File > Download > Microsoft Excel (.xlsx)** ใน Google Sheets ของคุณ
