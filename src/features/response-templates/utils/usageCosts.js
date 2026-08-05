export function formatMinutes(value) {
  const total = Math.round(Number(value) || 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function calculateEstimatedCost(durationMinutes, hourlyRate) {
  const minutes = Number(durationMinutes);
  const rate = Number(hourlyRate);
  if (!Number.isFinite(minutes) || !Number.isFinite(rate) || minutes < 0 || rate < 0) return 0;
  return (minutes / 60) * rate;
}
