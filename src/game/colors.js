// Distinct, vivid palette for 10 doors/keys.
export const DOOR_COLORS = [
  { hex: 0xff4d4d, name: 'أحمر' },
  { hex: 0xff8a3d, name: 'برتقالي' },
  { hex: 0xffd23f, name: 'أصفر' },
  { hex: 0x7ed957, name: 'أخضر فاتح' },
  { hex: 0x2ec27e, name: 'أخضر' },
  { hex: 0x3da9fc, name: 'أزرق' },
  { hex: 0x5a4cff, name: 'كحلي' },
  { hex: 0xb24bf3, name: 'بنفسجي' },
  { hex: 0xff5fb2, name: 'وردي' },
  { hex: 0xc8a165, name: 'بني' }
];

export function colorHexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
