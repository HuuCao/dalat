// One comparison key for names, place labels and sheet headers. Phone
// keyboards may type "Trâm" decomposed (NFD); people add stray spaces and
// capitals. None of that should split one person or place into two.
export function keyOf(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('vi');
}
