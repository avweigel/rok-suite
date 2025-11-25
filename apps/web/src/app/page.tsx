import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
      <main className="w-full max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
            Ark of Osiris Strategy
          </h1>
          <p className="text-zinc-400 max-w-xl">
            Quick visual overview of team roles and movement for Ark of Osiris.
            Share this page with alliance members so everyone sees the same plan.
          </p>
        </header>

        {/* Map image */}
        <section className="mb-10">
          <div className="relative w-full overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
            <img
              src="/ark-strategy.png"
              alt="Ark of Osiris strategy map"
              className="w-full h-auto object-contain"
            />
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            If this image is blank or broken, make sure{" "}
            <code className="px-1 py-0.5 rounded bg-zinc-900 text-xs">
              apps/web/public/ark-strategy.png
            </code>{" "}
            exists and the filename matches exactly.
          </p>
        </section>

        {/* Team summary cards */}
        <section className="grid gap-4 sm:grid-cols-3 mb-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold text-sky-300 mb-1">
              Team 1 – Cav / Outposts
            </h2>
            <p className="text-sm text-zinc-400 mb-2">
              Fast cavalry focused on early pressure.
            </p>
            <ul className="text-sm text-zinc-300 space-y-1 list-disc list-inside">
              <li>Teleport near first obelisk.</li>
              <li>Hit out buildings in assigned order.</li>
              <li>Rotate to second obelisk once secure.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold text-rose-300 mb-1">
              Team 2 – Mid / Ark
            </h2>
            <p className="text-sm text-zinc-400 mb-2">
              Main mid group for Ark fights and center control.
            </p>
            <ul className="text-sm text-zinc-300 space-y-1 list-disc list-inside">
              <li>Move straight into mid lane.</li>
              <li>Hold center structures.</li>
              <li>Focus on Ark capture and escort.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold text-emerald-300 mb-1">
              Team 3 – Defense / Garrison
            </h2>
            <p className="text-sm text-zinc-400 mb-2">
              Infantry and tank marches for holding stuff we take.
            </p>
            <ul className="text-sm text-zinc-300 space-y-1 list-disc list-inside">
              <li>Follow Team 1 to first obelisk.</li>
              <li>Stay to garrison key buildings.</li>
              <li>Reinforce second obelisk as needed.</li>
            </ul>
          </div>
        </section>

        {/* Footer note */}
        <footer className="text-xs text-zinc-500">
          Training mode: 10 vs 10.
          Full event: 30 vs 30.
          Use this page as a reference during voice calls and alliance pings.
        </footer>
      </main>
    </div>
  );
}
