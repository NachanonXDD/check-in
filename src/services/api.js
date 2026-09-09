import { supabase } from './supabase';

export const api = {
  get: async (action, params = {}) => {
    if (action === 'getMembers') {
      const { data, error } = await supabase.from('members').select('*');
      if (error) throw error;
      return data;
    }
    
    if (action === 'getSportGroups') {
      const { data, error } = await supabase.from('sport_groups').select('*');
      if (error) throw error;
      return data;
    }

    if (action === 'getAttendance') {
      const dateStr = params.date;
      
      // Get or create session
      let { data: sessionData, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('session_date', dateStr)
        .single();
        
      if (sessionError && sessionError.code !== 'PGRST116') {
        throw sessionError; // PGRST116 is not found
      }

      let session = sessionData;
      if (!session) {
        const { data: newSession, error: insertError } = await supabase
          .from('attendance_sessions')
          .insert([{ session_date: dateStr, status: 'open' }])
          .select()
          .single();
        if (insertError) throw insertError;
        session = newSession;
      }

      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('session_id', session.id);
        
      if (recordsError) throw recordsError;

      return { session, records };
    }
    
    if (action === 'getDashboardData') {
      const [
        { data: members },
        { data: sessions },
        { data: records },
        { data: groups }
      ] = await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }),
        supabase.from('attendance_records').select('*'),
        supabase.from('sport_groups').select('*')
      ]);
      return { members, sessions, records, groups };
    }

    throw new Error('Unknown GET action');
  },

  post: async (action, params = {}) => {
    if (action === 'addMember') {
      const { data, error } = await supabase.from('members').insert([{
        nickname: params.nickname,
        sport_group_id: params.sport_group_id || null,
        status: params.status || 'active',
        note: params.note || '',
        avatar_url: params.avatar_url || null
      }]);
      if (error) throw error;
      return data;
    }

    if (action === 'updateMember') {
      const { data, error } = await supabase.from('members').update({
        nickname: params.nickname,
        sport_group_id: params.sport_group_id || null,
        status: params.status,
        note: params.note,
        avatar_url: params.avatar_url || null
      }).eq('id', params.id);
      if (error) throw error;
      return data;
    }

    if (action === 'deleteMember') {
      if (params.hardDelete) {
        const { error } = await supabase.from('members').delete().eq('id', params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').update({ status: 'left' }).eq('id', params.id);
        if (error) throw error;
      }
      return true;
    }

    if (action === 'addSportGroup') {
      const { data, error } = await supabase.from('sport_groups').insert([{ name: params.name }]);
      if (error) throw error;
      return data;
    }

    if (action === 'updateSportGroup') {
      const { data, error } = await supabase.from('sport_groups').update({ name: params.name }).eq('id', params.id);
      if (error) throw error;
      return data;
    }

    if (action === 'deleteSportGroup') {
      const { error } = await supabase.from('sport_groups').delete().eq('id', params.id);
      if (error) throw error;
      return true;
    }

    if (action === 'checkIn') {
      const { data: session } = await supabase.from('attendance_sessions').select('id').eq('session_date', params.date).single();
      const status = params.status || 'present';
      
      const { data: existing } = await supabase.from('attendance_records')
        .select('*').eq('session_id', session.id).eq('member_id', params.member_id).maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('attendance_records').update({
          attendance_status: status,
          checked_in_at: new Date().toISOString()
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance_records').insert([{
          session_id: session.id,
          member_id: params.member_id,
          attendance_status: status,
          checked_in_at: new Date().toISOString()
        }]);
        if (error) throw error;
      }
      return true;
    }

    if (action === 'cancelCheckIn') {
      const { data: session } = await supabase.from('attendance_sessions').select('id').eq('session_date', params.date).single();
      
      const { error } = await supabase.from('attendance_records').update({
        attendance_status: null,
        checked_in_at: null
      }).eq('session_id', session.id).eq('member_id', params.member_id);
      
      if (error) throw error;
      return true;
    }

    if (action === 'checkAll' || action === 'checkInBulk') {
      const { data: session } = await supabase.from('attendance_sessions').select('id').eq('session_date', params.date).single();
      const now = new Date().toISOString();
      const status = params.status || 'present';
      
      // Upsert records
      const upsertData = params.member_ids.map(id => ({
        session_id: session.id,
        member_id: id,
        attendance_status: status,
        checked_in_at: now
      }));
      
      const { error } = await supabase.from('attendance_records').upsert(upsertData, { onConflict: 'session_id,member_id' });
      if (error) throw error;
      return true;
    }

    if (action === 'updateNote') {
      const { data: session } = await supabase.from('attendance_sessions').select('id').eq('session_date', params.date).single();
      
      const { data: existing } = await supabase.from('attendance_records')
        .select('*').eq('session_id', session.id).eq('member_id', params.member_id).maybeSingle();

      const updateData = { note: params.note };
      if (params.status) {
         updateData.attendance_status = params.status;
         updateData.checked_in_at = new Date().toISOString();
      }

      if (existing) {
        const { error } = await supabase.from('attendance_records').update(updateData).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance_records').insert([{
          session_id: session.id,
          member_id: params.member_id,
          ...updateData
        }]);
        if (error) throw error;
      }
      return true;
    }

    throw new Error('Unknown POST action: ' + action);
  }
};
