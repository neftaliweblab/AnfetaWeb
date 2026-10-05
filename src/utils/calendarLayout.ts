import { NotionCalendarActivity } from "@/types/anfeta";

export interface PositionedActivity {
  activity: NotionCalendarActivity;
  overlapIndex: number;
  overlapTotal: number;
}

/**
 * Algoritmo greedy de coloración de intervalos para calcular el índice y total
 * de solapamiento de actividades dentro de una misma columna del calendario.
 */
export function computeActivityOverlaps(
  activities: NotionCalendarActivity[]
): PositionedActivity[] {
  if (!activities || activities.length === 0) return [];

  const parsed = activities.map((act) => {
    let s = 8 * 60;
    let e = 9 * 60;

    const sMatch = (act.start || "").match(/T(\d{2}):(\d{2})/);
    if (sMatch) {
      s = parseInt(sMatch[1], 10) * 60 + parseInt(sMatch[2], 10);
    } else if (act.start) {
      const d = new Date(act.start);
      if (!isNaN(d.getTime())) s = d.getHours() * 60 + d.getMinutes();
    }

    const eMatch = (act.end || "").match(/T(\d{2}):(\d{2})/);
    if (eMatch) {
      e = parseInt(eMatch[1], 10) * 60 + parseInt(eMatch[2], 10);
    } else if (act.end) {
      const d = new Date(act.end);
      if (!isNaN(d.getTime())) e = d.getHours() * 60 + d.getMinutes();
    } else {
      e = s + 60;
    }

    if (e <= s) e = s + 60;

    return {
      act,
      start: s,
      end: e,
      slot: 0,
    };
  });

  parsed.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const clusters: (typeof parsed)[] = [];
  let currentCluster: typeof parsed = [];
  let clusterEnd = 0;

  for (const item of parsed) {
    if (currentCluster.length === 0 || item.start < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedActivity[] = [];

  for (const cluster of clusters) {
    const slots: number[] = [];
    for (const item of cluster) {
      let assignedSlot = -1;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] <= item.start) {
          assignedSlot = i;
          slots[i] = item.end;
          break;
        }
      }
      if (assignedSlot === -1) {
        assignedSlot = slots.length;
        slots.push(item.end);
      }
      item.slot = assignedSlot;
    }

    const maxSlots = Math.max(1, slots.length);
    for (const item of cluster) {
      result.push({
        activity: item.act,
        overlapIndex: item.slot,
        overlapTotal: maxSlots,
      });
    }
  }

  return result;
}
