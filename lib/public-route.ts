/** Whether a public post, topic, author, or list is on file. Missing → 404. */

export function postIsOnFile<T>(article: T): article is NonNullable<T> {
  return article != null;
}

export function topicIsOnFile(label: string | null | undefined): label is string {
  return typeof label === "string" && label.trim().length > 0;
}

export function authorIsOnFile(name: string | null | undefined): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

export function listIsOnFile<T extends { public?: boolean }>(
  list: T | null | undefined
): list is T {
  return Boolean(list && list.public);
}
