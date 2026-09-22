export function EmptyState({ title }: { title: string; text?: string }) {
  return (
    <div className="grid min-h-24 place-content-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <strong className="text-slate-800">{title}</strong>
    </div>
  );
}
