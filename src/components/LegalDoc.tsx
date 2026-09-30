import { LEGAL, type LegalSection } from "@/lib/legal";

export function LegalDoc({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="display text-[34px] leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">
        {LEGAL.service} · {updated}
      </p>
      <div className="panel mt-6 space-y-7 p-6 text-[15px] leading-relaxed md:p-8">
        {sections.map((s) => (
          <section key={s.title} className="space-y-2.5">
            <h2 className="display text-lg">{s.title}</h2>
            {s.body.map((b, i) =>
              Array.isArray(b) ? (
                <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-honey-deep">
                  {b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{b}</p>
              ),
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
