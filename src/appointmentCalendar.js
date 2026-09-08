const escapeText = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
const utc = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
// RFC 5545 folds lines by UTF-8 bytes, without splitting a code point.
function fold(line) {
  let output = '', length = 0;
  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length;
    if (length + bytes > 75) { output += '\r\n '; length = 1; }
    output += character; length += bytes;
  }
  return output;
}
export function appointmentCalendar(appointment, petName, now = new Date()) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pawline//Adoption appointments//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${appointment.id}@pawlineadopt.com`, `SEQUENCE:${appointment.revision}`, `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(appointment.startsAt)}`, `DTEND:${utc(appointment.endsAt)}`,
    `SUMMARY:${escapeText(`${appointment.kind === 'video' ? 'Video hello' : 'Final visit'} with ${petName}`)}`,
    'DESCRIPTION:Open Pawline Messages for current details. Download this event again after rescheduling.',
    'URL:https://www.pawlineadopt.com/#messages', 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
export function downloadAppointment(appointment, petName) {
  const url = URL.createObjectURL(new Blob([appointmentCalendar(appointment, petName)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pawline-appointment.ics'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
