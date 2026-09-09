export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-32 place-content-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <strong className="text-slate-800">{title}</strong>
      <span className="text-sm text-slate-600">{text}</span>
    </div>
  );
}
