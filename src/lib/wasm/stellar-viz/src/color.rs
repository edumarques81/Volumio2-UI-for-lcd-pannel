//! Colour palette generation and interpolation for visualisation.
//! Generates harmonious palettes from a seed colour (hex string),
//! inspired by MD3 dynamic colour.

/// Parse a hex colour string (with or without '#') into (r, g, b) [0-255].
fn parse_hex(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r, g, b))
}

/// Convert RGB [0-255] to HSL [h: 0-360, s: 0-1, l: 0-1].
fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f64, f64, f64) {
    let r = r as f64 / 255.0;
    let g = g as f64 / 255.0;
    let b = b as f64 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;

    if (max - min).abs() < 1e-10 {
        return (0.0, 0.0, l);
    }

    let d = max - min;
    let s = if l > 0.5 {
        d / (2.0 - max - min)
    } else {
        d / (max + min)
    };

    let h = if (max - r).abs() < 1e-10 {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) * 60.0
    } else if (max - g).abs() < 1e-10 {
        ((b - r) / d + 2.0) * 60.0
    } else {
        ((r - g) / d + 4.0) * 60.0
    };

    (h, s, l)
}

/// Convert HSL [h: 0-360, s: 0-1, l: 0-1] to RGB hex string "#rrggbb".
fn hsl_to_hex(h: f64, s: f64, l: f64) -> String {
    let h = ((h % 360.0) + 360.0) % 360.0;
    let s = s.clamp(0.0, 1.0);
    let l = l.clamp(0.0, 1.0);

    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = l - c / 2.0;

    let (r1, g1, b1) = match h as u32 {
        0..=59 => (c, x, 0.0),
        60..=119 => (x, c, 0.0),
        120..=179 => (0.0, c, x),
        180..=239 => (0.0, x, c),
        240..=299 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };

    let r = ((r1 + m) * 255.0).round() as u8;
    let g = ((g1 + m) * 255.0).round() as u8;
    let b = ((b1 + m) * 255.0).round() as u8;

    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

/// Generate a colour palette from a seed hex colour.
///
/// Creates `num_colours` harmonious colours by rotating hue and varying
/// lightness around the seed colour.
///
/// # Arguments
/// * `seed_hex` - Seed colour as hex string (e.g., "#ff6600" or "ff6600")
/// * `num_colours` - Number of palette colours to generate (minimum 1)
///
/// # Returns
/// Vec of hex colour strings. Returns a single grey if seed is invalid.
pub fn generate_palette_from_seed(seed_hex: &str, num_colours: usize) -> Vec<String> {
    let num_colours = num_colours.max(1);

    let (h, s, l) = match parse_hex(seed_hex) {
        Some((r, g, b)) => rgb_to_hsl(r, g, b),
        None => (0.0, 0.0, 0.5), // Fallback grey
    };

    let mut palette = Vec::with_capacity(num_colours);

    for i in 0..num_colours {
        let t = i as f64 / num_colours as f64;

        // Rotate hue across the spectrum
        let new_h = h + t * 360.0;

        // Vary lightness: darker at start, lighter at end
        let new_l = (l * 0.6 + t * 0.5).clamp(0.15, 0.85);

        // Keep saturation high but vary slightly
        let new_s = (s * 0.8 + 0.2 + t * 0.1).clamp(0.3, 1.0);

        palette.push(hsl_to_hex(new_h, new_s, new_l));
    }

    palette
}

/// Interpolate a colour from the palette based on a normalised value [0, 1].
///
/// # Arguments
/// * `value` - Normalised value in [0.0, 1.0]
/// * `palette` - Array of hex colour strings
///
/// # Returns
/// Interpolated hex colour string. Falls back to "#808080" for empty palette.
pub fn interpolate_bar_colour(value: f32, palette: &[String]) -> String {
    if palette.is_empty() {
        return "#808080".to_string();
    }

    let value = value.clamp(0.0, 1.0);

    if palette.len() == 1 {
        return palette[0].clone();
    }

    let pos = value * (palette.len() - 1) as f32;
    let idx = (pos.floor() as usize).min(palette.len() - 2);
    let t = pos - idx as f32;

    let c1 = parse_hex(&palette[idx]).unwrap_or((128, 128, 128));
    let c2 = parse_hex(&palette[idx + 1]).unwrap_or((128, 128, 128));

    let r = (c1.0 as f32 + (c2.0 as f32 - c1.0 as f32) * t).round() as u8;
    let g = (c1.1 as f32 + (c2.1 as f32 - c1.1 as f32) * t).round() as u8;
    let b = (c1.2 as f32 + (c2.2 as f32 - c1.2 as f32) * t).round() as u8;

    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hex_with_hash() {
        assert_eq!(parse_hex("#ff0000"), Some((255, 0, 0)));
    }

    #[test]
    fn test_parse_hex_without_hash() {
        assert_eq!(parse_hex("00ff00"), Some((0, 255, 0)));
    }

    #[test]
    fn test_parse_hex_invalid() {
        assert_eq!(parse_hex("xyz"), None);
        assert_eq!(parse_hex(""), None);
    }

    #[test]
    fn test_generate_palette_normal() {
        let palette = generate_palette_from_seed("#ff6600", 5);
        assert_eq!(palette.len(), 5);
        for c in &palette {
            assert!(c.starts_with('#'));
            assert_eq!(c.len(), 7);
        }
    }

    #[test]
    fn test_generate_palette_single() {
        let palette = generate_palette_from_seed("#0000ff", 1);
        assert_eq!(palette.len(), 1);
    }

    #[test]
    fn test_generate_palette_zero_gives_one() {
        let palette = generate_palette_from_seed("#ff0000", 0);
        assert_eq!(palette.len(), 1);
    }

    #[test]
    fn test_generate_palette_invalid_seed() {
        let palette = generate_palette_from_seed("not-a-colour", 3);
        assert_eq!(palette.len(), 3);
        // Should still return valid hex strings (grey-based)
        for c in &palette {
            assert!(c.starts_with('#'));
        }
    }

    #[test]
    fn test_interpolate_middle() {
        let palette = vec!["#000000".to_string(), "#ffffff".to_string()];
        let mid = interpolate_bar_colour(0.5, &palette);
        // Should be approximately #808080
        assert!(mid.starts_with('#'));
        let (r, g, _b) = parse_hex(&mid).unwrap();
        assert!((r as i32 - 128).abs() < 2);
        assert!((g as i32 - 128).abs() < 2);
    }

    #[test]
    fn test_interpolate_edges() {
        let palette = vec!["#ff0000".to_string(), "#0000ff".to_string()];
        let start = interpolate_bar_colour(0.0, &palette);
        let end = interpolate_bar_colour(1.0, &palette);
        assert_eq!(start, "#ff0000");
        assert_eq!(end, "#0000ff");
    }

    #[test]
    fn test_interpolate_empty_palette() {
        let result = interpolate_bar_colour(0.5, &[]);
        assert_eq!(result, "#808080");
    }

    #[test]
    fn test_interpolate_single_palette() {
        let palette = vec!["#abcdef".to_string()];
        let result = interpolate_bar_colour(0.7, &palette);
        assert_eq!(result, "#abcdef");
    }

    #[test]
    fn test_interpolate_clamps_value() {
        let palette = vec!["#000000".to_string(), "#ffffff".to_string()];
        let below = interpolate_bar_colour(-1.0, &palette);
        let above = interpolate_bar_colour(2.0, &palette);
        assert_eq!(below, "#000000");
        assert_eq!(above, "#ffffff");
    }
}
