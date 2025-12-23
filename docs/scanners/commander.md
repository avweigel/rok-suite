# Commander Scanner

Scan commander screenshots to extract level, skills, and stats.

## Features

- **OCR Detection** - Uses Tesseract.js for text recognition
- **AI Detection** - Optional Roboflow integration for enhanced accuracy
- **Skill Extraction** - Detects all 4 skills plus expertise
- **Stat Parsing** - Power, troop capacity, level, and stars

## How to Use

1. Open the Scanners page and select **Commander Scanner**
2. Upload a screenshot of your commander info screen
3. The scanner will detect:
   - Commander name
   - Level (1-60)
   - Stars (1-6)
   - Skill levels (5/5/5/5/1 format)
   - Power rating
   - Troop capacity
4. Review the detected values and adjust if needed
5. Click **Accept** to save to your inventory

## Best Practices

- Screenshot the commander details screen (not the portrait)
- Ensure all skill levels are visible
- Use high resolution for better OCR accuracy
- Dark mode screenshots work better for contrast

## Supported Commanders

The scanner works with all commanders in Rise of Kingdoms, including:
- Legendary commanders
- Epic commanders
- Elite commanders
- Advanced commanders

## Troubleshooting

**OCR not detecting correctly?**
- Ensure the screenshot is clear and not compressed
- Try cropping to just the commander info area
- Use the manual edit option to correct values

**Skills showing wrong values?**
- Double-check the skill order matches in-game
- Use the dropdown selectors to manually set levels
