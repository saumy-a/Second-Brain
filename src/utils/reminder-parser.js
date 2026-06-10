/**
 * Parse reminder intent and time from a message.
 *
 * Supported patterns:
 *   - "remind me at 6pm"  /  "remind me at 18:00"
 *   - "remind me in 30 minutes"  /  "remind me in 2 hours"
 *   - "remind me tomorrow at 3pm"
 *   - "remind me tomorrow"  (defaults to 9 AM next day)
 *
 * Returns { hasReminder, remindAt, cleanContent }
 */
function parseReminder(text) {
  const result = { hasReminder: false, remindAt: null, cleanContent: text };
  if (!text) return result;

  const lower = text.toLowerCase();

  // Must contain "remind me" or "remind"
  if (!lower.includes('remind me') && !lower.includes('remind')) {
    return result;
  }

  const now = new Date();
  let remindAt = null;
  let matchedPattern = null;

  // ── Pattern 1: "remind me in X minutes/hours" ──────────────
  const inPattern = /remind\s*me\s+in\s+(\d+)\s*(min(?:ute)?s?|hr?s?|hours?)/i;
  const inMatch = text.match(inPattern);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    remindAt = new Date(now);
    if (unit.startsWith('min')) {
      remindAt.setMinutes(remindAt.getMinutes() + amount);
    } else {
      remindAt.setHours(remindAt.getHours() + amount);
    }
    matchedPattern = inMatch[0];
  }

  // ── Pattern 2: "remind me tomorrow at 3pm" ────────────────
  if (!remindAt) {
    const tomorrowAtPattern = /remind\s*me\s+tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const tomorrowAtMatch = text.match(tomorrowAtPattern);
    if (tomorrowAtMatch) {
      let hours = parseInt(tomorrowAtMatch[1], 10);
      const minutes = tomorrowAtMatch[2] ? parseInt(tomorrowAtMatch[2], 10) : 0;
      const ampm = tomorrowAtMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      remindAt = new Date(now);
      remindAt.setDate(remindAt.getDate() + 1);
      remindAt.setHours(hours, minutes, 0, 0);
      matchedPattern = tomorrowAtMatch[0];
    }
  }

  // ── Pattern 3: "remind me tomorrow" (no time → 9 AM) ──────
  if (!remindAt) {
    const tomorrowPattern = /remind\s*me\s+tomorrow/i;
    const tomorrowMatch = text.match(tomorrowPattern);
    if (tomorrowMatch) {
      remindAt = new Date(now);
      remindAt.setDate(remindAt.getDate() + 1);
      remindAt.setHours(9, 0, 0, 0);
      matchedPattern = tomorrowMatch[0];
    }
  }

  // ── Pattern 4: "remind me at 6pm" / "remind me at 18:00" ──
  if (!remindAt) {
    const atPattern = /remind\s*me\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const atMatch = text.match(atPattern);
    if (atMatch) {
      let hours = parseInt(atMatch[1], 10);
      const minutes = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
      const ampm = atMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      remindAt = new Date(now);
      remindAt.setHours(hours, minutes, 0, 0);
      // If the time has already passed today, push to tomorrow
      if (remindAt <= now) {
        remindAt.setDate(remindAt.getDate() + 1);
      }
      matchedPattern = atMatch[0];
    }
  }

  if (!remindAt) return result;

  // Clean the reminder pattern out of the content
  let cleanContent = text;
  if (matchedPattern) {
    cleanContent = text.replace(matchedPattern, '').trim();
    // Clean up leftover punctuation/separators
    cleanContent = cleanContent.replace(/^[,.\-–—:;\s]+|[,.\-–—:;\s]+$/g, '').trim();
  }

  return {
    hasReminder: true,
    remindAt,
    cleanContent: cleanContent || text
  };
}

module.exports = { parseReminder };
