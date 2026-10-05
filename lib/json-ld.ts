/**
 * JSON-LD inside <script> must not contain a literal `</script>`.
 * JSON.stringify does not escape `<`, so user-controlled names (public lists)
 * could close the tag. `\u003c` is valid JSON and inert in HTML.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
