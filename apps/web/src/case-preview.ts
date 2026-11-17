export function casePreview(text: string): string {
  const points = Array.from(text);
  return points.length > 90 ? `${points.slice(0, 90).join('')}…` : text;
}
