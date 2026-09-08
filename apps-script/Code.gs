const SHEETS = {
  MEMBERS: 'members',
  SPORT_GROUPS: 'sport_groups',
  ATTENDANCE_SESSIONS: 'attendance_sessions',
  ATTENDANCE_RECORDS: 'attendance_records',
  SETTINGS: 'settings'
};

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const setup = (sheetName, headers) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    }
  };

  setup(SHEETS.MEMBERS, ['id', 'nickname', 'sport_group_id', 'status', 'note', 'created_at', 'updated_at']);
  setup(SHEETS.SPORT_GROUPS, ['id', 'name', 'created_at']);
  setup(SHEETS.ATTENDANCE_SESSIONS, ['id', 'session_date', 'status', 'opened_at', 'closed_at', 'created_at']);
  setup(SHEETS.ATTENDANCE_RECORDS, ['id', 'session_id', 'member_id', 'attendance_status', 'checked_in_at', 'note', 'created_at', 'updated_at']);
  setup(SHEETS.SETTINGS, ['id', 'practice_days', 'practice_start_time', 'late_time', 'organization_name']);
  
  // Default Settings if empty
  const settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['1', '1,2,3,4,5', '17:00', '17:30', 'ชมรมกรีฑา']);
  }
}

function doPost(e) {
  // Add CORS headers by returning JSONP or handle preflight if needed. GAS mostly handles GET/POST.
  // Actually, GAS Web Apps don't support OPTIONS for CORS preflight cleanly.
  // We will return JSON text output.
  try {
    let action = e.parameter.action;
    let data = {};
    if (e.postData && e.postData.contents) {
      const parsedData = JSON.parse(e.postData.contents);
      if (parsedData.action) action = parsedData.action;
      if (parsedData.data) data = parsedData.data;
    }

    if (!action) {
      return jsonResponse({ success: false, message: "No action specified" });
    }

    let result = {};
    if (action === 'addMember') result = addMember(data);
    else if (action === 'updateMember') result = updateMember(data);
    else if (action === 'deleteMember') result = deleteMember(data);
    else if (action === 'addSportGroup') result = addSportGroup(data);
    else if (action === 'updateSportGroup') result = updateSportGroup(data);
    else if (action === 'deleteSportGroup') result = deleteSportGroup(data);
    else if (action === 'checkIn') result = checkIn(data);
    else if (action === 'cancelCheckIn') result = cancelCheckIn(data);
    else if (action === 'checkAll') result = checkAll(data);
    else if (action === 'updateNote') result = updateNote(data);
    else if (action === 'updateSettings') result = updateSettings(data);
    else {
      return jsonResponse({ success: false, message: "Unknown POST action: " + action });
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (!action) {
      return jsonResponse({ success: true, message: "API is running" });
    }

    let result = {};
    if (action === 'getMembers') result = getMembers();
    else if (action === 'getSportGroups') result = getSportGroups();
    else if (action === 'getAttendance') result = getAttendance(e.parameter.date);
    else if (action === 'getDashboard') result = getDashboard();
    else if (action === 'getSettings') result = getSettings();
    else {
      return jsonResponse({ success: false, message: "Unknown GET action: " + action });
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------- DATABASE HELPER ----------------
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    // store row number for updates
    obj._rowIndex = i + 1; 
    rows.push(obj);
  }
  return rows;
}

function generateId() {
  return Utilities.getUuid();
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

// ---------------- ACTIONS ----------------

function getMembers() {
  return { success: true, data: getSheetData(SHEETS.MEMBERS) };
}

function addMember(data) {
  if (!data.nickname) return { success: false, message: "กรุณาระบุชื่อเล่น" };
  const members = getSheetData(SHEETS.MEMBERS);
  if (members.find(m => m.nickname === data.nickname)) {
    return { success: false, message: "ชื่อเล่นนี้มีในระบบแล้ว" };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MEMBERS);
  const newId = generateId();
  const now = getCurrentTimestamp();
  
  sheet.appendRow([
    newId,
    data.nickname,
    data.sport_group_id || '',
    data.status || 'active',
    data.note || '',
    now,
    now
  ]);
  return { success: true, message: "เพิ่มสมาชิกสำเร็จ", data: { id: newId } };
}

function updateMember(data) {
  if (!data.id) return { success: false, message: "กรุณาระบุ ID สมาชิก" };
  const members = getSheetData(SHEETS.MEMBERS);
  const member = members.find(m => m.id === data.id);
  
  if (!member) return { success: false, message: "ไม่พบสมาชิก" };

  if (data.nickname && data.nickname !== member.nickname) {
    if (members.find(m => m.nickname === data.nickname)) {
      return { success: false, message: "ชื่อเล่นนี้มีในระบบแล้ว" };
    }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MEMBERS);
  const now = getCurrentTimestamp();
  
  if (data.nickname) sheet.getRange(member._rowIndex, 2).setValue(data.nickname);
  if (data.sport_group_id !== undefined) sheet.getRange(member._rowIndex, 3).setValue(data.sport_group_id);
  if (data.status) sheet.getRange(member._rowIndex, 4).setValue(data.status);
  if (data.note !== undefined) sheet.getRange(member._rowIndex, 5).setValue(data.note);
  sheet.getRange(member._rowIndex, 7).setValue(now);

  return { success: true, message: "อัปเดตข้อมูลสำเร็จ" };
}

function deleteMember(data) {
  if (!data.id) return { success: false, message: "กรุณาระบุ ID สมาชิก" };
  const members = getSheetData(SHEETS.MEMBERS);
  const memberIndex = members.findIndex(m => m.id === data.id);
  
  if (memberIndex === -1) return { success: false, message: "ไม่พบสมาชิก" };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MEMBERS);
  
  if (data.hardDelete) {
    sheet.deleteRow(members[memberIndex]._rowIndex);
    // Delete attendance records as well
    const recordsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE_RECORDS);
    let recordsData = recordsSheet.getDataRange().getValues();
    // iterate backwards to delete
    for (let i = recordsData.length - 1; i >= 1; i--) {
       if (recordsData[i][2] === data.id) { // member_id is 3rd column
           recordsSheet.deleteRow(i + 1);
       }
    }
    return { success: true, message: "ลบสมาชิกและประวัติถาวรสำเร็จ" };
  } else {
    // Soft delete / Leave
    sheet.getRange(members[memberIndex]._rowIndex, 4).setValue('left');
    sheet.getRange(members[memberIndex]._rowIndex, 7).setValue(getCurrentTimestamp());
    return { success: true, message: "นำออกจากรายชื่อเช็คชื่อสำเร็จ" };
  }
}

function getSportGroups() {
  return { success: true, data: getSheetData(SHEETS.SPORT_GROUPS) };
}

function addSportGroup(data) {
  if (!data.name) return { success: false, message: "กรุณาระบุชื่อกลุ่ม" };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SPORT_GROUPS);
  const newId = generateId();
  sheet.appendRow([newId, data.name, getCurrentTimestamp()]);
  return { success: true, message: "เพิ่มกลุ่มกีฬาสำเร็จ", data: { id: newId } };
}

function updateSportGroup(data) {
  if (!data.id || !data.name) return { success: false, message: "ข้อมูลไม่ครบถ้วน" };
  const groups = getSheetData(SHEETS.SPORT_GROUPS);
  const group = groups.find(g => g.id === data.id);
  if (!group) return { success: false, message: "ไม่พบกลุ่มกีฬา" };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SPORT_GROUPS);
  sheet.getRange(group._rowIndex, 2).setValue(data.name);
  return { success: true, message: "อัปเดตกลุ่มกีฬาสำเร็จ" };
}

function deleteSportGroup(data) {
  if (!data.id) return { success: false, message: "กรุณาระบุ ID" };
  const members = getSheetData(SHEETS.MEMBERS);
  if (members.find(m => m.sport_group_id === data.id && m.status !== 'left')) {
    return { success: false, message: "ไม่สามารถลบได้ เนื่องจากมีสมาชิกใช้งานอยู่" };
  }
  
  const groups = getSheetData(SHEETS.SPORT_GROUPS);
  const group = groups.find(g => g.id === data.id);
  if (!group) return { success: false, message: "ไม่พบกลุ่มกีฬา" };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SPORT_GROUPS);
  sheet.deleteRow(group._rowIndex);
  return { success: true, message: "ลบกลุ่มกีฬาสำเร็จ" };
}

function getSettings() {
  const settings = getSheetData(SHEETS.SETTINGS);
  return { success: true, data: settings.length > 0 ? settings[0] : null };
}

function updateSettings(data) {
  const settings = getSheetData(SHEETS.SETTINGS);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  
  if (settings.length > 0) {
    const s = settings[0];
    if (data.practice_days !== undefined) sheet.getRange(s._rowIndex, 2).setValue(data.practice_days);
    if (data.practice_start_time !== undefined) sheet.getRange(s._rowIndex, 3).setValue(data.practice_start_time);
    if (data.late_time !== undefined) sheet.getRange(s._rowIndex, 4).setValue(data.late_time);
    if (data.organization_name !== undefined) sheet.getRange(s._rowIndex, 5).setValue(data.organization_name);
  } else {
    sheet.appendRow(['1', data.practice_days || '', data.practice_start_time || '', data.late_time || '', data.organization_name || '']);
  }
  return { success: true, message: "บันทึกการตั้งค่าสำเร็จ" };
}

// ---------------- ATTENDANCE ----------------

function getOrCreateSession(dateStr) {
  const sessions = getSheetData(SHEETS.ATTENDANCE_SESSIONS);
  let session = sessions.find(s => s.session_date === dateStr);
  const now = getCurrentTimestamp();
  
  if (!session) {
    const newId = generateId();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE_SESSIONS);
    sheet.appendRow([newId, dateStr, 'open', now, '', now]);
    session = { id: newId, session_date: dateStr, status: 'open', opened_at: now, closed_at: '', created_at: now };
  }
  return session;
}

function getAttendance(dateStr) {
  if (!dateStr) return { success: false, message: "กรุณาระบุวันที่" };
  
  const session = getOrCreateSession(dateStr);
  const allRecords = getSheetData(SHEETS.ATTENDANCE_RECORDS);
  const recordsForDate = allRecords.filter(r => r.session_id === session.id);
  
  return { 
    success: true, 
    data: {
      session: session,
      records: recordsForDate
    } 
  };
}

function checkIn(data) {
  if (!data.member_id || !data.date) return { success: false, message: "ข้อมูลไม่ครบถ้วน" };
  
  const session = getOrCreateSession(data.date);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE_RECORDS);
  const allRecords = getSheetData(SHEETS.ATTENDANCE_RECORDS);
  
  let record = allRecords.find(r => r.session_id === session.id && r.member_id === data.member_id);
  const now = getCurrentTimestamp();
  
  if (record) {
    // Update existing
    sheet.getRange(record._rowIndex, 4).setValue('present'); // attendance_status
    sheet.getRange(record._rowIndex, 5).setValue(now); // checked_in_at
    sheet.getRange(record._rowIndex, 8).setValue(now); // updated_at
  } else {
    // Create new
    sheet.appendRow([generateId(), session.id, data.member_id, 'present', now, '', now, now]);
  }
  
  return { success: true, message: "เช็คชื่อสำเร็จ", data: { checked_in_at: now } };
}

function cancelCheckIn(data) {
  if (!data.member_id || !data.date) return { success: false, message: "ข้อมูลไม่ครบถ้วน" };
  
  const session = getOrCreateSession(data.date);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE_RECORDS);
  const allRecords = getSheetData(SHEETS.ATTENDANCE_RECORDS);
  
  let record = allRecords.find(r => r.session_id === session.id && r.member_id === data.member_id);
  
  if (record) {
    // If we just clear status or set to absent. Let's delete the record completely or set to empty.
    // Setting to empty string means not checked in yet.
    sheet.getRange(record._rowIndex, 4).setValue(''); 
    sheet.getRange(record._rowIndex, 5).setValue(''); 
    sheet.getRange(record._rowIndex, 8).setValue(getCurrentTimestamp());
  }
  
  return { success: true, message: "ยกเลิกการเช็คชื่อสำเร็จ" };
}

function checkAll(data) {
  if (!data.date || !data.member_ids || !Array.isArray(data.member_ids)) return { success: false, message: "ข้อมูลไม่ครบถ้วน" };
  
  const session = getOrCreateSession(data.date);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE_RECORDS);
  const allRecords = getSheetData(SHEETS.ATTENDANCE_RECORDS);
  const now = getCurrentTimestamp();
  
  data.member_ids.forEach(memberId => {
    let record = allRecords.find(r => r.session_id === session.id && r.member_id === memberId);
    if (record) {
      if (record.attendance_status !== 'present') {
         sheet.getRange(record._rowIndex, 4).setValue('present');
         sheet.getRange(record._rowIndex, 5).setValue(now);
         sheet.getRange(record._rowIndex, 8).setValue(now);
      }
    } else {
      sheet.appendRow([generateId(), session.id, memberId, 'present', now, '', now, now]);
    }
  });
  
  return { success: true, message: "เช็คชื่อทั้งหมดสำเร็จ" };
}

function updateNote(data) {
  if (!data.member_id || !data.date) return { success: false, message: "ข้อมูลไม่ครบถ้วน" };
  
  const session = getOrCreateSession(data.date);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE_RECORDS);
  const allRecords = getSheetData(SHEETS.ATTENDANCE_RECORDS);
  
  let record = allRecords.find(r => r.session_id === session.id && r.member_id === data.member_id);
  const now = getCurrentTimestamp();
  
  if (record) {
    sheet.getRange(record._rowIndex, 6).setValue(data.note || ''); 
    sheet.getRange(record._rowIndex, 8).setValue(now);
  } else {
    sheet.appendRow([generateId(), session.id, data.member_id, '', '', data.note || '', now, now]);
  }
  
  return { success: true, message: "บันทึกหมายเหตุสำเร็จ" };
}

function getDashboard() {
  const members = getSheetData(SHEETS.MEMBERS);
  const sessions = getSheetData(SHEETS.ATTENDANCE_SESSIONS);
  const records = getSheetData(SHEETS.ATTENDANCE_RECORDS);
  
  return {
    success: true,
    data: {
      members: members,
      sessions: sessions,
      records: records
    }
  };
}
