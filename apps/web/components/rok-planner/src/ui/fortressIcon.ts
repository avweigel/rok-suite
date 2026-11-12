// The alliance fortress on the map: a grey stone tower (two crenellated tiers and a spire), drawn for the planner after the game's look
// (Davide's screenshot, 2026-11-12). Our own drawing, no game art. The coloured plate under it and the name tag are drawn by draw.ts.
export const FORTRESS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<clipPath id="r"><rect x="32" y="0" width="32" height="64"/></clipPath>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6e9"/><stop offset="1" stop-color="#b3b7bc"/></linearGradient>
<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dcdf"/><stop offset="1" stop-color="#a9adb3"/></linearGradient>
</defs>
<g stroke="#454950" stroke-width="1.4" stroke-linejoin="round">
<path d="M32 3L41.5 23H22.5Z" fill="url(#s)"/>
<path d="M20 41V20H24.5V24H29.5V20H34.5V24H39.5V20H44V41Z" fill="url(#w)"/>
<path d="M12 57V34H16.5V38H19.5V34H24V38H27V34H30.5V38H33.5V34H37V38H40V34H44.5V38H47.5V34H52V57Z" fill="url(#w)"/>
</g>
<g clip-path="url(#r)" fill="#1d2127" opacity=".24">
<path d="M32 3L41.5 23H22.5Z"/>
<path d="M20 41V20H24.5V24H29.5V20H34.5V24H39.5V20H44V41Z"/>
<path d="M12 57V34H16.5V38H19.5V34H24V38H27V34H30.5V38H33.5V34H37V38H40V34H44.5V38H47.5V34H52V57Z"/>
</g>
<path d="M20 41H44M12 38.6H52" stroke="#454950" stroke-width="1" opacity=".55"/>
<g fill="#353940">
<rect x="30.6" y="28" width="2.8" height="7" rx="1.4"/>
<rect x="19.6" y="44" width="2.8" height="7" rx="1.4"/>
<rect x="41.6" y="44" width="2.8" height="7" rx="1.4"/>
</g>
<path d="M28 57V51.5a4 4 0 0 1 8 0V57Z" fill="#4a4139" stroke="#2f2a25" stroke-width="1"/>
</svg>`;
