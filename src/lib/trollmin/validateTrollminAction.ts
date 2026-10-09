export async function validateTrollminAction(
  actionType: string,
  _targetUserId: string | null,
  details: Record<string, any>
): Promise<{ valid: boolean; violations: string[] }> {
  const violations: string[] = [];

  if (actionType === 'ban' && details?.duration_hours > 24) {
    violations.push('Cannot ban for more than 24 hours');
  }

  if (actionType === 'law_create' && !details?.title) {
    violations.push('Law must have a title');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
