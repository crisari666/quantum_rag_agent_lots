/**
 * Ensures a published experience snapshot never leaks private inventory fields.
 */
export function assertManifestIsPublicSafe(
  snapshot: Readonly<Record<string, unknown>>,
): void {
  const serialized = JSON.stringify(snapshot);
  if (
    serialized.includes('"soldBy"') ||
    serialized.includes('"heldByUserId"') ||
    serialized.includes('"verifiedByUserId"')
  ) {
    throw new Error(
      'Experience manifest must not include soldBy, heldByUserId, or verifiedByUserId',
    );
  }
}
