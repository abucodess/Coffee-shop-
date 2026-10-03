/**
 * Convert a numeric number to English Words (Indian numbering format with Rupees and Paise)
 * e.g., 409.50 -> "Four Hundred Nine Rupees and Fifty Paise Only"
 */
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertLessThanThousand(n: number): string {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

export function numberToIndianWords(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let result = "";

  if (rupees > 0) {
    let rem = rupees;

    // Crores (1,00,00,000)
    const crores = Math.floor(rem / 10000000);
    rem %= 10000000;
    if (crores > 0) {
      result += convertLessThanThousand(crores) + " Crore ";
    }

    // Lakhs (1,00,000)
    const lakhs = Math.floor(rem / 100000);
    rem %= 100000;
    if (lakhs > 0) {
      result += convertLessThanThousand(lakhs) + " Lakh ";
    }

    // Thousands (1,000)
    const thousands = Math.floor(rem / 1000);
    rem %= 1000;
    if (thousands > 0) {
      result += convertLessThanThousand(thousands) + " Thousand ";
    }

    // Hundreds and tens
    if (rem > 0) {
      result += convertLessThanThousand(rem) + " ";
    }

    result = result.trim() + " Rupees";
  }

  if (paise > 0) {
    const paiseStr = convertLessThanThousand(paise) + " Paise";
    result = result ? `${result} and ${paiseStr}` : paiseStr;
  }

  return result ? `${result} Only` : "Zero Rupees Only";
}
