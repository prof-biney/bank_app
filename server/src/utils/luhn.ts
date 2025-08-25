export function luhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function detectBrand(number: string): string {
  const n = number.replace(/\D/g, "");
  if (/^4\d{12,18}$/.test(n)) return "visa";
  if (/^5[1-5]\d{14}$/.test(n)) return "mastercard";
  if (/^3[47]\d{13}$/.test(n)) return "amex";
  if (/^6(?:011|5\d{2})\d{12}$/.test(n)) return "discover";
  return "card";
}

