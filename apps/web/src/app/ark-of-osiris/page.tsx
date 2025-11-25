'use client';

import Image from 'next/image';

const TEAM_SIZE_FULL = 10;
const TEAM_SIZE_TRAINING = { team1: 3, team2: 4, team3: 3 };

export default function ArkOfOsirisPage() {
  return (
    <main style={{ padding: "2rem", background: "#111", color: "#eee", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        Ark of Osiris Strategy
      </h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          Map Overview
        </h2>
        <img
          src="/ark-strategy.png"
          alt="Ark of Osiris strategy map"
          className='w-full h-auto object-contain'
        />
      </section>


      <section style={{
        display: "grid", gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
      }}>
        <div style={{ background: "#222", padding: "1rem", borderRadius: "12px" }}>
          <h3 style={{ color: "#63b3ed" }}>Team 1 – Cavalry</h3>
          <p>Full event: {TEAM_SIZE_FULL} players<br />Training: {TEAM_SIZE_TRAINING.team1} players</p>
          <ul>
            <li>Fast cavalry</li>
            <li>Capture out-buildings</li>
            <li>Move to second Obelisk</li>
          </ul>
        </div>

        <div style={{ background: "#222", padding: "1rem", borderRadius: "12px" }}>
          <h3 style={{ color: "#f56565" }}>Team 2 – Mid / Ark</h3>
          <p>Full event: {TEAM_SIZE_FULL} players<br />Training: {TEAM_SIZE_TRAINING.team2} players</p>
          <ul>
            <li>Main mid group</li>
            <li>Control center buildings</li>
            <li>Fight for Ark</li>
          </ul>
        </div>

        <div style={{ background: "#222", padding: "1rem", borderRadius: "12px" }}>
          <h3 style={{ color: "#48bb78" }}>Team 3 – Defense</h3>
          <p>Full event: {TEAM_SIZE_FULL} players<br />Training: {TEAM_SIZE_TRAINING.team3} players</p>
          <ul>
            <li>Infantry / tank marches</li>
            <li>Garrison captured buildings</li>
            <li>Support second Obelisk</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
