// MAETRY: registration asks for a single free-form name. ZITADEL requires both a given
// and a family name, so the name is split for those fields, and kept as typed in the
// display name and nickname (which the Maetry API uses to address the user).

/** First word as the given name, the rest as the family name; one word fills both. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { firstName: trimmed, lastName: trimmed };
  }
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

/** The name as typed, reassembled from `splitName`'s output (or a provider's names). */
export function joinName(firstName?: string, lastName?: string): string {
  const first = firstName?.trim() ?? "";
  const last = lastName?.trim() ?? "";
  if (!first || !last || first === last) {
    return first || last;
  }
  return `${first} ${last}`;
}
