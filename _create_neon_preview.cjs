const sharp = require('sharp');
const fs = require('fs');

(async () => {
  try {
    // Create a neon gradient background (cyan to magenta)
    const width = 1024;
    const height = 1024;
    
    // Create SVG gradient background
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="neon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#00FFFF;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF00FF;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#neon)"/>
      </svg>
    `;
    
    // Create background
    const background = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    // Load and resize logo
    const logoPath = 'C:\\Users\\kainm\\Downloads\\2946a2b7-e1e5-46e6-97ed-26505b0fd0be.png';
    const logoSize = Math.floor(width * 0.7);
    
    const logo = await sharp(logoPath)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Composite logo on background
    const result = await sharp(background)
      .composite([
        {
          input: logo,
          top: Math.floor((height - logoSize) / 2),
          left: Math.floor((width - logoSize) / 2)
        }
      ])
      .png()
      .toFile('C:\\Users\\kainm\\Downloads\\neon_logo_preview.png');
    
    console.log('✓ Neon preview created at: C:\\Users\\kainm\\Downloads\\neon_logo_preview.png');
    console.log(`  Size: ${result.width}x${result.height}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
