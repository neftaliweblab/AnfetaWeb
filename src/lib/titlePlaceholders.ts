/** Hide template slots in presentation only; callers retain the original title for search/editing. */
export function stripTitlePlaceholders(value: string): string {
  return String(value || '').replace(/(^|[\s|\p{Extended_Pictographic}\uFE0F])#[^\s|]+/gu, '$1 ').replace(/\s{2,}/g, ' ').trim();
}
