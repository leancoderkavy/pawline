import { createHash } from 'node:crypto';
import { directError } from './_direct.js';

export function dailyConfigured(env = process.env) {
  return env.PAWLINE_DAILY_ENABLED === 'true' && Boolean(env.DAILY_API_KEY) && /^https:\/\/[a-z0-9-]+\.daily\.co$/.test(env.DAILY_DOMAIN || '');
}
export const participantId = userId => createHash('sha256').update(`pawline-video:${userId}`).digest('hex').slice(0, 36);

export function dailyProvider(env = process.env, fetchImpl = fetch) {
  async function api(path, method = 'GET', body) {
    const response = await fetchImpl(`https://api.daily.co/v1${path}`, {
      method, headers: { Authorization: `Bearer ${env.DAILY_API_KEY}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Object.assign(directError('Video service is temporarily unavailable. Please continue in messages.', 503), { providerStatus: response.status });
    return response.json();
  }
  return {
    async room(appointment) {
      const name = appointment.room_name;
      const properties = {
        nbf: Math.floor(new Date(appointment.starts_at).getTime() / 1000) - 600,
        exp: Math.floor(new Date(appointment.ends_at).getTime() / 1000),
        eject_at_room_exp: true, max_participants: 2, enforce_unique_user_ids: true,
        enable_prejoin_ui: true, enable_knocking: false, enable_chat: false,
        enable_live_captions_ui: false, enable_transcription_storage: false,
        start_video_off: true, start_audio_off: true,
      };
      let room;
      try { room = await api(`/rooms/${name}`); }
      catch (error) { if (error.providerStatus !== 404) throw error; }
      if (!room) {
        try { room = await api('/rooms', 'POST', { name, privacy: 'private', properties }); }
        catch (error) { if (error.providerStatus !== 400 && error.providerStatus !== 409) throw error; room = await api(`/rooms/${name}`); }
      }
      if (room.privacy !== 'private' || room.url !== `${env.DAILY_DOMAIN}/${name}` || room.config?.enable_recording
        || room.config?.auto_transcription_settings || room.config?.exp !== properties.exp
        || room.config?.eject_at_room_exp !== true || room.config?.max_participants !== 2 || room.config?.enforce_unique_user_ids !== true) {
        throw directError('The private video room could not be verified.', 503);
      }
      return room.url;
    },
    async token(appointment, user) {
      const result = await api('/meeting-tokens', 'POST', { properties: {
        room_name: appointment.room_name, user_id: participantId(user.id), user_name: user.displayName,
        nbf: Math.floor(Date.now() / 1000) - 5, exp: Math.min(Math.floor(Date.now() / 1000) + 120, Math.floor(new Date(appointment.ends_at).getTime() / 1000)),
        // Do not set token eject properties: they override the room's hard end.
        is_owner: false,
        enable_prejoin_ui: true, start_video_off: true, start_audio_off: true,
        enable_recording_ui: false, enable_live_captions_ui: false, auto_start_transcription: false,
        start_cloud_recording: false, permissions: { canAdmin: false, canSend: ['audio', 'video', 'screenVideo', 'screenAudio'] },
      } });
      if (typeof result.token !== 'string') throw directError('Video access could not be issued.', 503);
      return result.token;
    },
    async close(name) {
      // Expiring the room ejects current participants and invalidates future joins.
      try { await api(`/rooms/${name}`, 'POST', { properties: { exp: Math.floor(Date.now() / 1000), eject_at_room_exp: true } }); }
      catch (error) { if (error.providerStatus !== 404) throw error; }
    },
  };
}
