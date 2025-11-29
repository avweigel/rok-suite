// Commander Reference Library for OCR matching
// Includes titles, specialty tags, and image URLs for visual matching

export interface CommanderReference {
  id: string;
  name: string;
  title: string; // The title that appears above the name (more readable by OCR)
  rarity: 'legendary' | 'epic' | 'elite' | 'advanced';
  specialties: [string, string, string]; // Exactly 3 specialties
  imageUrl: string; // Wiki portrait URL
  dominantColors?: string[]; // For color-based matching
  altNames?: string[]; // Alternative spellings/OCR misreads
}

export const commanderReferences: CommanderReference[] = [
  // ============ LEGENDARY COMMANDERS ============
  {
    id: 'alexander-the-great',
    name: 'Alexander the Great',
    title: 'Son of Amun',
    rarity: 'legendary',
    specialties: ['Infantry', 'Versatility', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/a/a5/Alexander_the_Great.png',
    altNames: ['alexander', 'alex'],
  },
  {
    id: 'artemisia-i',
    name: 'Artemisia I',
    title: 'Queen of Caria',
    rarity: 'legendary',
    specialties: ['Archer', 'Conquering', 'Defense'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/8/8b/Artemisia_I.png',
    altNames: ['artemisia'],
  },
  {
    id: 'attila',
    name: 'Attila',
    title: 'Scourge of God',
    rarity: 'legendary',
    specialties: ['Cavalry', 'Conquering', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/a/a0/Attila.png',
    altNames: ['attila'],
  },
  {
    id: 'cao-cao',
    name: 'Cao Cao',
    title: 'King of Wei',
    rarity: 'legendary',
    specialties: ['Cavalry', 'Conquering', 'Mobility'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/c/c1/Cao_Cao.png',
    altNames: ['caocao', 'cao'],
  },
  {
    id: 'charlemagne',
    name: 'Charlemagne',
    title: 'Father of Europe',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/8/8c/Charlemagne.png',
    altNames: ['charles the great'],
  },
  {
    id: 'charles-martel',
    name: 'Charles Martel',
    title: 'The Immortal Hammer',
    rarity: 'legendary',
    specialties: ['Infantry', 'Garrison', 'Defense'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/1/14/Charles_Martel.png',
    altNames: ['martel', 'hammer'],
  },
  {
    id: 'cleopatra-vii',
    name: 'Cleopatra VII',
    title: "Egypt's Last Pharaoh",
    rarity: 'legendary',
    specialties: ['Leadership', 'Gathering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/c/c9/Cleopatra_VII.png',
    altNames: ['cleopatra', 'cleo'],
  },
  {
    id: 'constantine-i',
    name: 'Constantine I',
    title: 'The Great',
    rarity: 'legendary',
    specialties: ['Infantry', 'Conquering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/5/5d/Constantine_I.png',
    altNames: ['constantine'],
  },
  {
    id: 'cyrus-the-great',
    name: 'Cyrus the Great',
    title: 'King of Kings',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/c/c2/Cyrus_the_Great.png',
    altNames: ['cyrus'],
  },
  {
    id: 'edward-of-woodstock',
    name: 'Edward of Woodstock',
    title: 'The Black Prince',
    rarity: 'legendary',
    specialties: ['Archer', 'Versatility', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/e/e4/Edward_of_Woodstock.png',
    altNames: ['edward', 'black prince'],
  },
  {
    id: 'el-cid',
    name: 'El Cid',
    title: 'The Lord',
    rarity: 'legendary',
    specialties: ['Archer', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/e/e8/El_Cid.png',
    altNames: ['elcid', 'cid'],
  },
  {
    id: 'frederick-i',
    name: 'Frederick I',
    title: 'Barbarossa',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/f/f6/Frederick_I.png',
    altNames: ['frederick', 'barbarossa'],
  },
  {
    id: 'genghis-khan',
    name: 'Genghis Khan',
    title: 'Spirit of the Steppe',
    rarity: 'legendary',
    specialties: ['Cavalry', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/g/g2/Genghis_Khan.png',
    altNames: ['genghis', 'khan'],
  },
  {
    id: 'guan-yu',
    name: 'Guan Yu',
    title: 'Saint of War',
    rarity: 'legendary',
    specialties: ['Infantry', 'Conquering', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/g/g5/Guan_Yu.png',
    altNames: ['guanyu', 'guan'],
  },
  {
    id: 'hannibal-barca',
    name: 'Hannibal Barca',
    title: 'Father of Strategy',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/h/h2/Hannibal_Barca.png',
    altNames: ['hannibal', 'barca'],
  },
  {
    id: 'ishida-mitsunari',
    name: 'Ishida Mitsunari',
    title: 'Righteous Martyr',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/i/i5/Ishida_Mitsunari.png',
    altNames: ['ishida', 'mitsunari'],
  },
  {
    id: 'julius-caesar',
    name: 'Julius Caesar',
    title: 'The Uncrowned King',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/j/j2/Julius_Caesar.png',
    altNames: ['julius', 'caesar'],
  },
  {
    id: 'leonidas-i',
    name: 'Leonidas I',
    title: 'Guardian of Thermopylae',
    rarity: 'legendary',
    specialties: ['Infantry', 'Conquering', 'Defense'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/l/l5/Leonidas_I.png',
    altNames: ['leonidas'],
  },
  {
    id: 'mehmed-ii',
    name: 'Mehmed II',
    title: 'Conqueror of Istanbul',
    rarity: 'legendary',
    specialties: ['Leadership', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/m/m2/Mehmed_II.png',
    altNames: ['mehmed', 'mehmet', 'fatih'],
  },
  {
    id: 'minamoto-no-yoshitsune',
    name: 'Minamoto no Yoshitsune',
    title: "Kamakura's Warlord",
    rarity: 'legendary',
    specialties: ['Cavalry', 'Peacekeeping', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/m/m5/Minamoto_no_Yoshitsune.png',
    altNames: ['minamoto', 'yoshitsune'],
  },
  {
    id: 'mulan',
    name: 'Mulan',
    title: 'Legendary Warrior',
    rarity: 'legendary',
    specialties: ['Integration', 'Peacekeeping', 'Versatility'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/m/m8/Mulan.png',
    altNames: ['hua mulan'],
  },
  {
    id: 'ragnar-lodbrok',
    name: 'Ragnar Lodbrok',
    title: 'Sea King',
    rarity: 'legendary',
    specialties: ['Infantry', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/r/r2/Ragnar_Lodbrok.png',
    altNames: ['ragnar'],
  },
  {
    id: 'ramesses-ii',
    name: 'Ramesses II',
    title: 'The Eternal Pharaoh',
    rarity: 'legendary',
    specialties: ['Archer', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/r/r5/Ramesses_II.png',
    altNames: ['ramesses', 'ramses'],
  },
  {
    id: 'richard-i',
    name: 'Richard I',
    title: 'The Lionheart',
    rarity: 'legendary',
    specialties: ['Infantry', 'Garrison', 'Defense'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/r/r8/Richard_I.png',
    altNames: ['richard', 'lionheart'],
  },
  {
    id: 'saladin',
    name: 'Saladin',
    title: 'Ruler of the East',
    rarity: 'legendary',
    specialties: ['Cavalry', 'Conquering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/s/s2/Saladin.png',
    altNames: ['salah ad-din'],
  },
  {
    id: 'seondeok',
    name: 'Seondeok',
    title: 'Star of Korea',
    rarity: 'legendary',
    specialties: ['Leadership', 'Gathering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/s/s5/Seondeok.png',
    altNames: ['queen seondeok'],
  },
  {
    id: 'takeda-shingen',
    name: 'Takeda Shingen',
    title: 'Tiger of Kai',
    rarity: 'legendary',
    specialties: ['Cavalry', 'Conquering', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/t/t2/Takeda_Shingen.png',
    altNames: ['takeda', 'shingen'],
  },
  {
    id: 'tomyris',
    name: 'Tomyris',
    title: 'Massagetae Queen',
    rarity: 'legendary',
    specialties: ['Archer', 'Conquering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/t/t5/Tomyris.png',
    altNames: [],
  },
  {
    id: 'wu-zetian',
    name: 'Wu Zetian',
    title: 'Empress Regent',
    rarity: 'legendary',
    specialties: ['Leadership', 'Garrison', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/w/w2/Wu_Zetian.png',
    altNames: ['wu'],
  },
  {
    id: 'yi-seong-gye',
    name: 'Yi Seong-Gye',
    title: 'King of Joseon',
    rarity: 'legendary',
    specialties: ['Archer', 'Garrison', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/y/y2/Yi_Seong-Gye.png',
    altNames: ['ysg', 'yi', 'seong-gye'],
  },
  {
    id: 'aethelflaed',
    name: 'Æthelflæd',
    title: 'Lady of the Mercians',
    rarity: 'legendary',
    specialties: ['Leadership', 'Peacekeeping', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/a/a8/Aethelflaed.png',
    altNames: ['aethelflaed', 'aethel'],
  },
  {
    id: 'bjorn-ironside',
    name: 'Björn Ironside',
    title: 'King of Kattegat',
    rarity: 'legendary',
    specialties: ['Infantry', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/b/b5/Bjorn_Ironside.png',
    altNames: ['bjorn', 'ironside'],
  },
  {
    id: 'thutmose-iii',
    name: 'Thutmose III',
    title: 'Beloved of Thoth',
    rarity: 'legendary',
    specialties: ['Archer', 'Versatility', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/t/t8/Thutmose_III.png',
    altNames: ['thutmose', 'thut'],
  },

  // ============ EPIC COMMANDERS ============
  {
    id: 'baibars',
    name: 'Baibars',
    title: 'Father of Conquest',
    rarity: 'epic',
    specialties: ['Cavalry', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/b/b2/Baibars.png',
    altNames: ['baibars', 'baiber'],
  },
  {
    id: 'belisarius',
    name: 'Belisarius',
    title: 'Last of the Romans',
    rarity: 'epic',
    specialties: ['Cavalry', 'Peacekeeping', 'Mobility'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/b/b5/Belisarius.png',
    altNames: [],
  },
  {
    id: 'boudica',
    name: 'Boudica',
    title: 'Celtic Rose',
    rarity: 'epic',
    specialties: ['Integration', 'Peacekeeping', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/b/b8/Boudica.png',
    altNames: ['boudicca'],
  },
  {
    id: 'eulji-mundeok',
    name: 'Eulji Mundeok',
    title: 'Hero of Salsu',
    rarity: 'epic',
    specialties: ['Infantry', 'Attack', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/e/e2/Eulji_Mundeok.png',
    altNames: ['eulji'],
  },
  {
    id: 'hermann',
    name: 'Hermann',
    title: 'Germanic War Chief',
    rarity: 'epic',
    specialties: ['Archer', 'Garrison', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/h/h5/Hermann.png',
    altNames: ['arminius'],
  },
  {
    id: 'joan-of-arc',
    name: 'Joan of Arc',
    title: 'The Maiden of Orléans',
    rarity: 'epic',
    specialties: ['Integration', 'Gathering', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/j/j5/Joan_of_Arc.png',
    altNames: ['joan', 'jeanne'],
  },
  {
    id: 'keira',
    name: 'Keira',
    title: 'The Red Chameleon',
    rarity: 'epic',
    specialties: ['Archer', 'Peacekeeping', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/k/k2/Keira.png',
    altNames: [],
  },
  {
    id: 'kusunoki-masashige',
    name: 'Kusunoki Masashige',
    title: 'Bushido Spirit',
    rarity: 'epic',
    specialties: ['Archer', 'Garrison', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/k/k5/Kusunoki_Masashige.png',
    altNames: ['kusunoki', 'masashige'],
  },
  {
    id: 'lohar',
    name: 'Lohar',
    title: 'Roaring Barbarian',
    rarity: 'epic',
    specialties: ['Integration', 'Peacekeeping', 'Support'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/l/l2/Lohar.png',
    altNames: [],
  },
  {
    id: 'osman-i',
    name: 'Osman I',
    title: 'Imperial Pioneer',
    rarity: 'epic',
    specialties: ['Leadership', 'Conquering', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/o/o2/Osman_I.png',
    altNames: ['osman'],
  },
  {
    id: 'pelagius',
    name: 'Pelagius',
    title: 'Founder of Asturias',
    rarity: 'epic',
    specialties: ['Cavalry', 'Garrison', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/p/p2/Pelagius.png',
    altNames: [],
  },
  {
    id: 'scipio-africanus',
    name: 'Scipio Africanus',
    title: 'Blades of Warfare',
    rarity: 'epic',
    specialties: ['Leadership', 'Conquering', 'Attack'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/s/s8/Scipio_Africanus.png',
    altNames: ['scipio'],
  },
  {
    id: 'sun-tzu',
    name: 'Sun Tzu',
    title: 'Tactical Genius',
    rarity: 'epic',
    specialties: ['Infantry', 'Garrison', 'Skill'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/s/s2/Sun_Tzu.png',
    altNames: ['suntzu'],
  },
  {
    id: 'wak-chanil-ajaw',
    name: 'Wak Chanil Ajaw',
    title: 'Lady Six Sky',
    rarity: 'epic',
    specialties: ['Integration', 'Gathering', 'Defense'],
    imageUrl: 'https://static.wikia.nocookie.net/riseofkingdoms/images/w/w5/Wak_Chanil_Ajaw.png',
    altNames: ['wak', 'lady six sky', 'six sky'],
  },
];

// Map titles to commander IDs for quick lookup
export const titleToCommander: Record<string, string> = {};
commanderReferences.forEach(c => {
  const titleKey = c.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  titleToCommander[titleKey] = c.id;
});

// Map specialty combinations to possible commanders
export const specialtyToCommanders: Record<string, string[]> = {};
commanderReferences.forEach(c => {
  const key = c.specialties.sort().join('|').toLowerCase();
  if (!specialtyToCommanders[key]) {
    specialtyToCommanders[key] = [];
  }
  specialtyToCommanders[key].push(c.id);
});

// Function to find commander by title
export function findByTitle(text: string): CommanderReference | null {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  
  // First pass: exact full title match
  for (const commander of commanderReferences) {
    const titleNorm = commander.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    
    if (normalized.includes(titleNorm)) {
      return commander;
    }
  }
  
  // Second pass: require ALL significant words (not just 2)
  for (const commander of commanderReferences) {
    const titleNorm = commander.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const titleWords = titleNorm.split(/\s+/).filter(w => w.length >= 3);
    
    // For short titles (1-2 words), require all words
    // For longer titles (3+ words), require at least 80%
    if (titleWords.length <= 2) {
      const allMatch = titleWords.every(word => normalized.includes(word));
      if (allMatch) {
        return commander;
      }
    } else {
      const matchedWords = titleWords.filter(word => normalized.includes(word));
      if (matchedWords.length >= Math.ceil(titleWords.length * 0.8)) {
        return commander;
      }
    }
  }
  
  return null;
}

// Function to find commander by specialty tags
export function findBySpecialties(text: string): CommanderReference[] {
  const normalized = text.toLowerCase();
  
  const detectedSpecialties: string[] = [];
  const allSpecialties = [
    'infantry', 'cavalry', 'archer', 'leadership', 'integration',
    'attack', 'defense', 'mobility', 'support', 'garrison',
    'gathering', 'peacekeeping', 'conquering', 'skill', 'versatility'
  ];
  
  for (const specialty of allSpecialties) {
    if (normalized.includes(specialty)) {
      detectedSpecialties.push(specialty);
    }
  }
  
  if (detectedSpecialties.length < 2) {
    return [];
  }
  
  // Find commanders matching detected specialties
  return commanderReferences.filter(commander => {
    const commanderSpecialties = commander.specialties.map(s => s.toLowerCase());
    const matchCount = detectedSpecialties.filter(s => commanderSpecialties.includes(s)).length;
    return matchCount >= 2;
  });
}

// Function to find commander by alt names
export function findByAltName(text: string): CommanderReference | null {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  
  for (const commander of commanderReferences) {
    if (commander.altNames) {
      for (const altName of commander.altNames) {
        if (altName.length >= 4 && normalized.includes(altName)) {
          return commander;
        }
      }
    }
  }
  
  return null;
}
