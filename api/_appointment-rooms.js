// Creation can take up to three bounded Daily requests. A closer must not race
// an in-flight create and leave behind a room recreated after it was closed.
export const ROOM_CREATION_GRACE_MS = 60000;

export async function revokeAppointmentRoom(db, room) {
  const [updated] = await db`UPDATE adoption_appointments SET
    state = CASE WHEN state = 'confirmed' THEN 'cancelled' ELSE state END,
    revision = revision + CASE WHEN state = 'confirmed' THEN 1 ELSE 0 END
    WHERE id = ${room.id} AND room_name = ${room.room_name} AND NOT room_closed RETURNING *`;
  return updated;
}

export async function closeAppointmentRoom(db, provider, room, { creationFinished = false } = {}) {
  if (!room?.room_name || room.room_closed) return false;
  if (!room.room_ready && !creationFinished && Date.now() - new Date(room.updated_at).getTime() < ROOM_CREATION_GRACE_MS) return false;
  await provider.close(room.room_name);
  await db`UPDATE adoption_appointments SET room_closed = true WHERE id = ${room.id} AND room_name = ${room.room_name}`;
  return true;
}
