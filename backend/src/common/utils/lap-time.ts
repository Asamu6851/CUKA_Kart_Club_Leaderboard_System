import { BadRequestException } from "@nestjs/common";

export function normalizeLapTimeText(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function parseLapTimeToMs(rawValue: string) {
  const value = rawValue.trim();

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const minuteSecondMatch = value.match(/^(\d+):(\d{1,2})\.(\d{1,3})$/);
  if (minuteSecondMatch) {
    const minutes = Number(minuteSecondMatch[1]);
    const seconds = Number(minuteSecondMatch[2]);
    const milliseconds = normalizeMilliseconds(minuteSecondMatch[3]);

    return minutes * 60 * 1000 + seconds * 1000 + milliseconds;
  }

  const secondMatch = value.match(/^(\d+)\.(\d{1,3})$/);
  if (secondMatch) {
    const seconds = Number(secondMatch[1]);
    const milliseconds = normalizeMilliseconds(secondMatch[2]);

    return seconds * 1000 + milliseconds;
  }

  throw new BadRequestException(
    "Lap time format is invalid. Use ss.mmm or m:ss.mmm."
  );
}

function normalizeMilliseconds(value: string) {
  if (value.length === 3) {
    return Number(value);
  }

  if (value.length === 2) {
    return Number(`${value}0`);
  }

  return Number(`${value}00`);
}
