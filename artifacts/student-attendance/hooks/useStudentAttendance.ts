import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '@/constants/api';

export type LiveAttendanceRecord = {
  id: number;
  studentId: string;
  studentName: string;
  eventName: string;
  sessionName: string;
  scannedAt: string;
  status: 'present' | 'late' | 'absent';
};

export type LiveEvent = {
  id: number;
  name: string;
  description: string;
  eventDate: string;
  venue: string;
  status: string;
  sessions: {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    enabled: boolean;
  }[];
};

export type StudentSessionRecord = {
  sessionName: string;
  status: 'Present' | 'Late' | 'Absent' | 'Upcoming';
  scannedAt?: string;
};

export type StudentEventRecord = {
  eventId: number;
  eventName: string;
  eventDate: string;
  venue: string;
  sessions: StudentSessionRecord[];
  presentCount: number;
  totalSessions: number;
};

export function useStudentAttendance(studentId: string | null | undefined) {
  const [events, setEvents] = useState<StudentEventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!studentId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all events and all attendance records for this student in parallel
      const [eventsRes, attendanceRes] = await Promise.all([
        fetch(`${API_URL}/events`),
        fetch(`${API_URL}/attendance?search=${encodeURIComponent(studentId)}`),
      ]);

      if (!eventsRes.ok || !attendanceRes.ok) {
        setError('Failed to load attendance data.');
        setLoading(false);
        return;
      }

      const allEvents: LiveEvent[] = await eventsRes.json();
      const allRecords: LiveAttendanceRecord[] = await attendanceRes.json();

      // Filter records for this specific student
      const myRecords = allRecords.filter(
        (r) => r.studentId.toUpperCase() === studentId.toUpperCase(),
      );

      // Build a map: eventName||sessionName -> record (normalized to lowercase for case-insensitive match)
      const recordMap = new Map<string, LiveAttendanceRecord>();
      for (const rec of myRecords) {
        // Normalize key to lowercase so "Evening OUT" matches "Evening out" from DB
        const key = `${rec.eventName.toLowerCase()}||${rec.sessionName.toLowerCase()}`;
        recordMap.set(key, rec);
      }

      const now = new Date();

      // Build student event records
      const result: StudentEventRecord[] = allEvents.map((event) => {
        const enabledSessions = event.sessions.filter((s) => s.enabled);

        const sessionRecords: StudentSessionRecord[] = enabledSessions.map((s) => {
          // Normalize key to lowercase to match the normalized map keys above
          const key = `${event.name.toLowerCase()}||${s.name.toLowerCase()}`;
          const rec = recordMap.get(key);

          if (rec) {
            return {
              sessionName: s.name,
              status: rec.status === 'present' ? 'Present' : rec.status === 'late' ? 'Late' : 'Absent',
              scannedAt: rec.scannedAt,
            };
          }

          // Determine if session is in the future or missed
          const [endH, endM] = s.endTime.split(':').map(Number);
          const sessionEndMins = endH * 60 + endM;
          const currentMins = now.getHours() * 60 + now.getMinutes();

          // If event date is today or in the future and session hasn't ended yet
          const eventDate = new Date(event.eventDate);
          const isToday = eventDate.toDateString() === now.toDateString();
          const isFuture = eventDate > now;

          if (isFuture || (isToday && currentMins < sessionEndMins)) {
            return { sessionName: s.name, status: 'Upcoming' };
          }

          return { sessionName: s.name, status: 'Absent' };
        });

        const presentCount = sessionRecords.filter(
          (s) => s.status === 'Present' || s.status === 'Late',
        ).length;

        return {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.eventDate,
          venue: event.venue,
          sessions: sessionRecords,
          presentCount,
          totalSessions: enabledSessions.length,
        };
      });

      // Only show events that have sessions
      setEvents(result.filter((e) => e.totalSessions > 0));
    } catch {
      setError('Could not connect to the server. Check your network.');
    }

    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}
