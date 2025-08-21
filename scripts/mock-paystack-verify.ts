// Lightweight mock Paystack verify endpoint using Bun
// Run with: bun run scripts/mock-paystack-verify.ts
// Endpoint: POST /verify { reference: string }
// Responds: { authorization: { last4, brand, exp_month, exp_year }, customer: { name } }

const PORT = Number(process.env.MOCK_VERIFY_PORT || 8787);

function hashToDigits(input: string, len = 4) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  const digits = (h % 10000).toString().padStart(len, "0");
  return digits;
}

function pickBrand(input: string) {
  const brands = ["visa", "mastercard", "verve"];
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input.charCodeAt(i);
  return brands[sum % brands.length];
}

function pickExpiry(input: string) {
  const month = ((input.length % 12) + 1).toString().padStart(2, "0");
  const year = (2029 + (input.length % 5)).toString(); // 2029..2033
  return { exp_month: Number(month), exp_year: Number(year) };
}

function luhnValid(cardNumber: string) {
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

const server = Bun.serve({
  port: PORT,
  fetch: async (req) => {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (req.method === "POST" && url.pathname === "/verify") {
      try {
        const body = await req.json().catch(() => ({}));
        const reference = String(body?.reference || "").trim();
        if (!reference) {
          return new Response(JSON.stringify({ error: "reference is required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        // Simulate lookup and return deterministic mock data based on reference
        const last4 = hashToDigits(reference);
        const brand = pickBrand(reference);
        const { exp_month, exp_year } = pickExpiry(reference);

        const res = {
          authorization: { last4, brand, exp_month, exp_year },
          customer: { name: "Card Holder" },
          reference,
          verified: true,
        };
        return new Response(JSON.stringify(res), {
          headers: { "content-type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "invalid json" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (req.method === "POST" && url.pathname === "/cards") {
      try {
        const body = await req.json().catch(() => ({}));
        const number: string = String(body?.number || "").replace(/\s+/g, "");
        const exp_month = Number(body?.exp_month || 0);
        const exp_year = Number(body?.exp_year || 0);
        const cvc = String(body?.cvc || "");
        const name = String(body?.name || "Card Holder");

        const errors: Record<string, string> = {};
        if (!number) errors.number = "Card number is required";
        if (number && !/^4\d{12,18}$/.test(number)) {
          errors.number = "Only Visa test numbers (start with 4) are accepted in mock";
        }
        if (number && !luhnValid(number)) {
          errors.number = "Invalid card number (Luhn check failed)";
        }
        if (!exp_month || exp_month < 1 || exp_month > 12) errors.exp_month = "Invalid exp month";
        if (!exp_year || exp_year < 2024 || exp_year > 2040) errors.exp_year = "Invalid exp year";
        if (!cvc || !/^\d{3,4}$/.test(cvc)) errors.cvc = "Invalid CVC";
        if (Object.keys(errors).length) {
          return new Response(JSON.stringify({ error: "validation_error", details: errors }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const last4 = number.slice(-4);
        const masked = `•••• •••• •••• ${last4}`;
        const brand = "visa";

        const res = {
          authorization: {
            last4,
            brand,
            exp_month,
            exp_year,
            signature: `mock_${hashToDigits(number + exp_month + exp_year + cvc, 6)}`,
          },
          customer: { name },
          card: { masked, brand, name, exp_month, exp_year },
          created: new Date().toISOString(),
        };
        return new Response(JSON.stringify(res), {
          headers: { "content-type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "invalid json" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[mock-verify] listening on http://localhost:${PORT}`);

