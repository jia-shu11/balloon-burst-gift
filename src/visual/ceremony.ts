export interface BurstOrderItem {
  id: string;
  x: number;
  y: number;
}

export interface BurstTriggerPoint {
  x: number;
  y: number;
}

export function updateCeremonyCharge(current: number, deltaSec: number, held: boolean) {
  const direction = held ? 1 : -0.5;
  return Math.min(1, Math.max(0, Number((current + deltaSec * direction).toFixed(3))));
}

export function createBurstOrder(items: BurstOrderItem[], trigger: BurstTriggerPoint) {
  return [...items].sort((a, b) => {
    const distanceA = Math.hypot(a.x - trigger.x, a.y - trigger.y);
    const distanceB = Math.hypot(b.x - trigger.x, b.y - trigger.y);
    return distanceA - distanceB;
  });
}
