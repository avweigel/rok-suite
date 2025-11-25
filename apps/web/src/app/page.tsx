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
            Visual overview of roles and movement for Ark of Osiris. Share this
            page with alliance members so everyone sees the same plan.
          </p>
        </header>

        {/* Map image */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-2">Map Overview</h2>
          <p className="text-zinc-400 mb-4">Ark of Osiris strategy map</p>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
            <img
              src="/rok-suite/ark-strategy.png"
              alt="Ark of Osiris strategy map"
              className="block w-full h-auto"
            />
          </div>
        </section>

        {/* Team summary cards */}
        <section className="grid gap-4 sm:grid-cols-3 mb-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold text-sky-300 mb-1">
              Team 1 – Cavalry
            </h2>
            <p className="text-sm text-zinc-300">
              Full event: 10 players
              <br />
              Training: 3 players
              <br />
              Fast cavalry
              <br />
              Capture out-buildings
              <br />
              Move to second Obelisk
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold text-rose-300 mb-1">
              Team 2 – Mid / Ark
            </h2>
            <p className="text-sm text-zinc-300">
              Full event: 10 players
              <br />
              Training: 4 players
              <br />
              Main mid group
              <br />
              Control center buildings
              <br />
              Fight for Ark
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold text-emerald-300 mb-1">
              Team 3 – Defense
            </h2>
            <p className="text-sm text-zinc-300">
              Full event: 10 players
              <br />
              Training: 3 players
              <br />
              Infantry / tank marches
              <br />
              Garrison captured buildings
              <br />
              Support second Obelisk
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
