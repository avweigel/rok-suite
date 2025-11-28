// Image fingerprinting for commander identification
// Uses average hash (aHash) for perceptual image comparison

export interface CommanderFingerprint {
  id: string;
  name: string;
  hash: string; // 64-bit hash as hex string
  dominantColors: [number, number, number][]; // Top 3 RGB colors
}

// Pre-computed fingerprints for commanders
// These are based on the commander portrait area (center-right of screenshot)
export const commanderFingerprints: CommanderFingerprint[] = [
  // These will be populated with actual hashes from reference images
  // For now, using dominant color profiles as backup
  
  // Thutmose III - Gold/tan Egyptian theme with blue sky
  {
    id: 'thutmose-iii',
    name: 'Thutmose III',
    hash: '', // To be computed
    dominantColors: [[218, 180, 120], [139, 195, 230], [180, 150, 100]], // gold, sky blue, tan
  },
  
  // Charles Martel - Blue armor with gold accents
  {
    id: 'charles-martel',
    name: 'Charles Martel',
    hash: '',
    dominantColors: [[60, 90, 160], [218, 180, 100], [100, 130, 180]], // blue, gold, lighter blue
  },
  
  // Baibars - Teal/white with desert background
  {
    id: 'baibars',
    name: 'Baibars',
    hash: '',
    dominantColors: [[80, 160, 160], [220, 200, 180], [180, 140, 100]], // teal, cream, sand
  },
  
  // Scipio Africanus - Red cape, Roman armor
  {
    id: 'scipio-africanus',
    name: 'Scipio Africanus',
    hash: '',
    dominantColors: [[180, 60, 60], [160, 140, 120], [200, 180, 150]], // red, armor gray, marble
  },
  
  // Mehmed II - Red/gold Ottoman theme
  {
    id: 'mehmed-ii',
    name: 'Mehmed II',
    hash: '',
    dominantColors: [[180, 50, 50], [218, 180, 100], [80, 120, 160]], // red, gold, blue arches
  },
  
  // Osman I - Red/maroon with gold
  {
    id: 'osman-i',
    name: 'Osman I',
    hash: '',
    dominantColors: [[140, 40, 50], [218, 180, 100], [100, 80, 70]], // maroon, gold, dark
  },
  
  // Aethelflaed - Red hair, green/brown medieval
  {
    id: 'aethelflaed',
    name: 'Aethelflaed',
    hash: '',
    dominantColors: [[180, 80, 60], [100, 140, 80], [140, 120, 100]], // red hair, green, brown
  },
  
  // Sun Tzu - Red robe, Asian temple background
  {
    id: 'sun-tzu',
    name: 'Sun Tzu',
    hash: '',
    dominantColors: [[160, 60, 50], [218, 180, 100], [120, 160, 80]], // red robe, gold, green
  },
  
  // Björn Ironside - Viking with fur, snowy
  {
    id: 'bjorn-ironside',
    name: 'Björn Ironside',
    hash: '',
    dominantColors: [[180, 140, 100], [200, 200, 210], [140, 100, 80]], // tan/fur, snow, leather
  },
  
  // Minamoto no Yoshitsune - Red samurai armor
  {
    id: 'minamoto-no-yoshitsune',
    name: 'Minamoto no Yoshitsune',
    hash: '',
    dominantColors: [[180, 50, 50], [218, 180, 100], [180, 150, 180]], // red, gold, pink blossoms
  },
  
  // Kusunoki Masashige - Red/white samurai
  {
    id: 'kusunoki-masashige',
    name: 'Kusunoki Masashige',
    hash: '',
    dominantColors: [[180, 50, 50], [220, 220, 220], [180, 150, 180]], // red, white, pink
  },
  
  // Lohar - Barbarian, green forest
  {
    id: 'lohar',
    name: 'Lohar',
    hash: '',
    dominantColors: [[140, 100, 80], [100, 160, 80], [180, 160, 140]], // brown/leather, green, skin
  },
  
  // Boudica - Red hair, Celtic green
  {
    id: 'boudica',
    name: 'Boudica',
    hash: '',
    dominantColors: [[200, 80, 60], [100, 140, 100], [180, 160, 140]], // red hair, green, skin
  },
  
  // Wak Chanil Ajaw - Teal headdress, Mayan
  {
    id: 'wak-chanil-ajaw',
    name: 'Wak Chanil Ajaw',
    hash: '',
    dominantColors: [[80, 180, 160], [200, 120, 80], [100, 160, 120]], // teal, orange/red, green
  },
];

// Calculate color distance (Euclidean)
function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
}

// Extract dominant colors from image data
export function extractDominantColors(
  imageData: ImageData, 
  width: number, 
  height: number,
  sampleRegion?: { startX: number; endX: number; startY: number; endY: number }
): [number, number, number][] {
  const region = sampleRegion || {
    startX: Math.floor(width * 0.35),
    endX: Math.floor(width * 0.75),
    startY: Math.floor(height * 0.20),
    endY: Math.floor(height * 0.75),
  };
  
  // Simple color quantization using buckets
  const buckets: Map<string, { color: [number, number, number]; count: number }> = new Map();
  
  for (let y = region.startY; y < region.endY; y += 3) {
    for (let x = region.startX; x < region.endX; x += 3) {
      const i = (y * width + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      // Quantize to reduce colors (divide by 32, giving 8 levels per channel)
      const qr = Math.floor(r / 32) * 32;
      const qg = Math.floor(g / 32) * 32;
      const qb = Math.floor(b / 32) * 32;
      
      const key = `${qr},${qg},${qb}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
        // Average the actual colors
        existing.color[0] = (existing.color[0] * (existing.count - 1) + r) / existing.count;
        existing.color[1] = (existing.color[1] * (existing.count - 1) + g) / existing.count;
        existing.color[2] = (existing.color[2] * (existing.count - 1) + b) / existing.count;
      } else {
        buckets.set(key, { color: [r, g, b], count: 1 });
      }
    }
  }
  
  // Sort by count and get top 5
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return sorted.map(b => [
    Math.round(b.color[0]),
    Math.round(b.color[1]),
    Math.round(b.color[2])
  ] as [number, number, number]);
}

// Match image colors against fingerprint database
export function matchByDominantColors(
  extractedColors: [number, number, number][]
): { commander: string; confidence: number } | null {
  if (extractedColors.length === 0) return null;
  
  let bestMatch: { commander: string; confidence: number } | null = null;
  let bestScore = Infinity;
  
  for (const fingerprint of commanderFingerprints) {
    let totalDistance = 0;
    let matchCount = 0;
    
    // Compare each extracted color with fingerprint colors
    for (const extracted of extractedColors.slice(0, 3)) {
      let minDist = Infinity;
      for (const reference of fingerprint.dominantColors) {
        const dist = colorDistance(extracted, reference);
        if (dist < minDist) minDist = dist;
      }
      totalDistance += minDist;
      matchCount++;
    }
    
    const avgDistance = totalDistance / matchCount;
    
    // Lower distance = better match
    if (avgDistance < bestScore) {
      bestScore = avgDistance;
      bestMatch = {
        commander: fingerprint.name,
        // Convert distance to confidence (0-1)
        // Distance of 0 = 1.0 confidence, distance of 200+ = ~0 confidence
        confidence: Math.max(0, 1 - (avgDistance / 200))
      };
    }
  }
  
  // Only return if confidence is reasonable
  if (bestMatch && bestMatch.confidence > 0.3) {
    console.log(`[Color Match] Best match: ${bestMatch.commander} (confidence: ${(bestMatch.confidence * 100).toFixed(1)}%, distance: ${bestScore.toFixed(1)})`);
    return bestMatch;
  }
  
  return null;
}

// Calculate average hash (aHash) for an image
// This creates a perceptual fingerprint that's resistant to scaling/minor changes
export function calculateAverageHash(imageData: ImageData, width: number, height: number): string {
  // Sample the portrait region
  const startX = Math.floor(width * 0.4);
  const endX = Math.floor(width * 0.7);
  const startY = Math.floor(height * 0.25);
  const endY = Math.floor(height * 0.7);
  
  const regionWidth = endX - startX;
  const regionHeight = endY - startY;
  
  // Resize to 8x8 by sampling
  const samples: number[] = [];
  const cellWidth = regionWidth / 8;
  const cellHeight = regionHeight / 8;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = Math.floor(startX + col * cellWidth + cellWidth / 2);
      const y = Math.floor(startY + row * cellHeight + cellHeight / 2);
      const i = (y * width + x) * 4;
      
      // Convert to grayscale
      const gray = imageData.data[i] * 0.299 + 
                   imageData.data[i + 1] * 0.587 + 
                   imageData.data[i + 2] * 0.114;
      samples.push(gray);
    }
  }
  
  // Calculate average
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  
  // Create hash: 1 if pixel > average, 0 otherwise
  let hash = '';
  for (const sample of samples) {
    hash += sample > avg ? '1' : '0';
  }
  
  // Convert binary to hex
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
  }
  
  return hex;
}

// Calculate hamming distance between two hashes
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const bits1 = parseInt(hash1[i], 16);
    const bits2 = parseInt(hash2[i], 16);
    // Count differing bits
    let xor = bits1 ^ bits2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}
