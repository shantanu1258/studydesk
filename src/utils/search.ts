export const matchesSearch = (
  query: string,
  values: Array<string | number | null | undefined>,
) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return values.some((value) =>
    String(value ?? "")
      .toLocaleLowerCase()
      .includes(normalized),
  );
};
