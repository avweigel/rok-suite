export default function ArkOfOsirisPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
      <main className="w-full max-w-5xl px-4 py-12 sm:px-8 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
            Ark of Osiris – Detailed Plan
          </h1>
          <p className="text-zinc-400 max-w-xl">
            Same map, with more space for notes and assignments. Use this page
            when walking through the plan in voice.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Map Overview</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
            <img
              src="/apps/web/public/ark-strategy.png"
              alt="Ark of Osiris strategy map"
              className="block w-full h-auto"
            />
          </div>
        </section>

        <section className="space-y-4 text-sm text-zinc-300">
          <p>
            <span className="font-semibold text-sky-300">Team 1 – Cavalry:</span>{" "}
            hit out-buildings first, then rotate to the second Obelisk once
            structures are secure.
          </p>
          <p>
            <span className="font-semibold text-rose-300">Team 2 – Mid / Ark:</span>{" "}
            move straight to mid, secure center buildings, and focus on Ark
            capture and escort.
          </p>
          <p>
            <span className="font-semibold text-emerald-300">Team 3 – Defense:</span>{" "}
            follow Team 1 to garrison captured buildings, then flex between
            Obelisks and key structures as needed.
          </p>
        </section>
      </main>
    </div>
  );
}
