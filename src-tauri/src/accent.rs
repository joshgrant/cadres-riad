//! Reads the system accent (tint) colour.

#[cfg(target_os = "macos")]
pub fn system_accent_color() -> Option<String> {
  use objc2_app_kit::{NSColor, NSColorSpace};
  let colour = NSColor::controlAccentColor().colorUsingColorSpace(&NSColorSpace::sRGBColorSpace())?;
  Some(hex(colour.redComponent(), colour.greenComponent(), colour.blueComponent()))
}

#[cfg(target_os = "windows")]
pub fn system_accent_color() -> Option<String> {
  use windows::UI::ViewManagement::{UIColorType, UISettings};
  let colour = UISettings::new().ok()?.GetColorValue(UIColorType::Accent).ok()?;
  Some(format!("#{:02x}{:02x}{:02x}", colour.R, colour.G, colour.B))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn system_accent_color() -> Option<String> {
  None
}

#[cfg(target_os = "macos")]
fn hex(r: f64, g: f64, b: f64) -> String {
  let channel = |value: f64| (value.clamp(0.0, 1.0) * 255.0).round() as u8;
  format!("#{:02x}{:02x}{:02x}", channel(r), channel(g), channel(b))
}
