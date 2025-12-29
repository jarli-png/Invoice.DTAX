# Invoice.dtax.no API Integrasjonsdokumentasjon

**Versjon:** 1.0  
**Base URL:** `https://invoice.dtax.no/api`  
**Sist oppdatert:** 29. desember 2025

---

## Oversikt

Invoice.dtax.no tilbyr et REST API for automatisk fakturering fra eksterne systemer. APIet håndterer:

- Mottak av ordrer og automatisk fakturaopprettelse
- Statusforespørsler og oppdateringer
- Webhook-callbacks for hendelser (faktura sendt, betalt, etc.)
- KID-generering for bankmatch

---

## Autentisering

Alle API-forespørsler krever autentisering via API-nøkkel og HMAC-signatur.

### Headers som kreves

| Header | Beskrivelse | Påkrevd |
|--------|-------------|---------|
| `X-API-Key` | Din unike API-nøkkel | Ja (alle forespørsler) |
| `X-Timestamp` | Unix timestamp (sekunder) | Ja (POST/PUT/DELETE) |
| `X-Signature` | HMAC-SHA256 signatur | Ja (POST/PUT/DELETE) |
| `Content-Type` | `application/json` | Ja (POST/PUT) |

### Generere signatur

```javascript
const crypto = require('crypto');

function generateSignature(body, timestamp, apiSecret) {
  // Format: HMAC-SHA256(timestamp + "." + JSON.stringify(body), secret)
  const payload = `${timestamp}.${JSON.stringify(body)}`;
  return crypto
    .createHmac('sha256', apiSecret)
    .update(payload)
    .digest('hex');
}

// Eksempel
const body = { source: "tax.salestext.no", sourceOrderId: "ORDER-123", ... };
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = generateSignature(body, timestamp, "your-api-secret");

// Send forespørsel med headers:
// X-API-Key: your-api-key
// X-Timestamp: 1703851200
// X-Signature: a1b2c3d4e5f6...
```

### Sikkerhet

- Timestamp må være innenfor ±5 minutter for å forhindre replay-angrep
- API-nøkler kan deaktiveres via admin-grensesnittet
- Alle forespørsler logges for revisjon

---

## Endepunkter

### 1. Motta ordre

Oppretter en faktura basert på ordredata.

```
POST /orders/receive
```

#### Request Body

```json
{
  "source": "tax.salestext.no",
  "sourceOrderId": "ORDER-2025-00123",
  "customer": {
    "name": "Ola Nordmann AS",
    "email": "ola@example.com",
    "phone": "+47 912 34 567",
    "orgNumber": "987654321",
    "address": "Storgata 1",
    "postalCode": "0123",
    "city": "Oslo",
    "country": "NO"
  },
  "lines": [
    {
      "description": "Skatteberegning 2024",
      "quantity": 1,
      "unitPrice": 1000.00,
      "vatRate": 0.25,
      "unit": "stk"
    },
    {
      "description": "Ekstra tjeneste",
      "quantity": 2,
      "unitPrice": 500.00,
      "vatRate": 0.25
    }
  ],
  "dueDays": 14,
  "currency": "NOK",
  "notes": "Ref: Skatteberegning for 2024",
  "callbackUrl": "https://tax.salestext.no/api/invoice-callback",
  "autoSend": false,
  "preferredPaymentMethod": "BANK_TRANSFER",
  "internalReference": "TAX-CALC-12345",
  "metadata": {
    "taxYear": 2024,
    "calculationType": "standard"
  }
}
```

#### Felt-beskrivelser

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `source` | string | Ja | Identifikator for kildesystemet |
| `sourceOrderId` | string | Ja | Unik ordre-ID fra kildesystemet |
| `customer` | object | Ja | Kundeinformasjon |
| `customer.name` | string | Ja | Kundens navn |
| `customer.email` | string | Ja | E-postadresse |
| `customer.phone` | string | Nei | Telefonnummer |
| `customer.orgNumber` | string | Nei | Organisasjonsnummer |
| `customer.address` | string | Nei | Gateadresse |
| `customer.postalCode` | string | Nei | Postnummer |
| `customer.city` | string | Nei | Poststed |
| `customer.country` | string | Nei | Landkode (default: NO) |
| `lines` | array | Ja | Ordrelinjer (minst én) |
| `lines[].description` | string | Ja | Beskrivelse |
| `lines[].quantity` | number | Ja | Antall |
| `lines[].unitPrice` | number | Ja | Pris per enhet (eks. mva) |
| `lines[].vatRate` | number | Nei | MVA-sats 0-1 (default: 0.25) |
| `lines[].unit` | string | Nei | Enhet (stk, timer, etc.) |
| `organizationId` | string | Nei | Spesifikk org (default brukes) |
| `issueDate` | string | Nei | Fakturadato (ISO 8601) |
| `dueDays` | number | Nei | Dager til forfall (default: 14) |
| `currency` | string | Nei | Valuta (NOK, SEK, EUR, etc.) |
| `notes` | string | Nei | Notat på fakturaen |
| `callbackUrl` | string | Nei | URL for webhook-callbacks |
| `autoSend` | boolean | Nei | Send automatisk (default: false) |
| `attachments` | array | Nei | Vedlegg (fileName, fileUrl) |
| `preferredPaymentMethod` | string | Nei | BANK_TRANSFER, VIPPS, CARD |
| `internalReference` | string | Nei | Intern referanse |
| `metadata` | object | Nei | Ekstra data (lagres, returneres i callbacks) |

#### Response (201 Created)

```json
{
  "success": true,
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "status": "DRAFT",
  "totalAmount": 2500.00,
  "vatAmount": 500.00,
  "dueDate": "2025-01-12T00:00:00.000Z",
  "kid": "0000108472934561",
  "message": "Faktura opprettet som kladd"
}
```

#### Feilkoder

| HTTP | Kode | Beskrivelse |
|------|------|-------------|
| 400 | BAD_REQUEST | Ugyldig data |
| 401 | UNAUTHORIZED | Ugyldig API-nøkkel eller signatur |
| 409 | CONFLICT | sourceOrderId finnes allerede |
| 500 | INTERNAL_ERROR | Serverfeil |

---

### 2. Sjekk ordrestatus

Henter status for en ordre.

```
GET /orders/status/{sourceOrderId}
```

#### Response (200 OK)

```json
{
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "status": "SENT",
  "totalAmount": 2500.00,
  "vatAmount": 500.00,
  "paidAmount": 0.00,
  "remainingAmount": 2500.00,
  "dueDate": "2025-01-12T00:00:00.000Z",
  "kid": "0000108472934561",
  "createdAt": "2024-12-29T10:00:00.000Z",
  "sentAt": "2024-12-29T10:05:00.000Z",
  "paidAt": null,
  "payments": []
}
```

#### Status-verdier

| Status | Beskrivelse |
|--------|-------------|
| `DRAFT` | Faktura opprettet, ikke sendt |
| `SENT` | Faktura sendt til kunde |
| `DELIVERED` | E-post levert |
| `VIEWED` | Kunde har åpnet fakturaen |
| `PARTIALLY_PAID` | Delvis betalt |
| `PAID` | Fullstendig betalt |
| `OVERDUE` | Forfalt |
| `CANCELLED` | Kansellert |
| `CREDITED` | Kreditert |

---

### 3. Liste ordrer

Henter liste over ordrer med filtrering.

```
GET /orders/list?source=tax.salestext.no&status=SENT&limit=50
```

#### Query-parametere

| Parameter | Type | Beskrivelse |
|-----------|------|-------------|
| `source` | string | Filtrer på kilde |
| `status` | string | Filtrer på status |
| `from` | string | Fra-dato (ISO 8601) |
| `to` | string | Til-dato (ISO 8601) |
| `limit` | number | Maks antall (default: 50, maks: 100) |

#### Response

```json
{
  "orders": [
    {
      "sourceOrderId": "ORDER-2025-00123",
      "invoiceId": "cm5xyz123...",
      "invoiceNumber": "2025-0001",
      "source": "tax.salestext.no",
      "status": "SENT",
      "totalAmount": 2500.00,
      "dueDate": "2025-01-12T00:00:00.000Z",
      "createdAt": "2024-12-29T10:00:00.000Z",
      "customerName": "Ola Nordmann AS",
      "customerEmail": "ola@example.com"
    }
  ],
  "count": 1
}
```

---

### 4. Hent fakturadetaljer

Henter komplett fakturainformasjon.

```
GET /orders/invoice/{sourceOrderId}
```

#### Response

```json
{
  "invoice": {
    "id": "cm5xyz123...",
    "invoiceNumber": "2025-0001",
    "status": "SENT",
    "issueDate": "2024-12-29T00:00:00.000Z",
    "dueDate": "2025-01-12T00:00:00.000Z",
    "subtotal": 2000.00,
    "vatAmount": 500.00,
    "totalAmount": 2500.00,
    "currency": "NOK",
    "kid": "0000108472934561",
    "notes": "Ref: Skatteberegning for 2024",
    "pdfUrl": "https://..."
  },
  "customer": {
    "id": "cm5abc...",
    "name": "Ola Nordmann AS",
    "email": "ola@example.com",
    "orgNumber": "987654321",
    "address": "Storgata 1",
    "postalCode": "0123",
    "city": "Oslo"
  },
  "organization": {
    "name": "DTAX LIER",
    "orgNumber": "933612097",
    "bankAccount": "9801.16.72043"
  },
  "lines": [
    {
      "description": "Skatteberegning 2024",
      "quantity": 1,
      "unitPrice": 1000.00,
      "vatRate": 0.25,
      "amount": 1250.00
    }
  ],
  "payments": [],
  "emailHistory": [
    {
      "recipient": "ola@example.com",
      "status": "DELIVERED",
      "sentAt": "2024-12-29T10:05:00.000Z"
    }
  ]
}
```

---

### 5. Send faktura

Sender en faktura som er opprettet som kladd.

```
POST /orders/send/{sourceOrderId}
```

#### Response

```json
{
  "success": true,
  "invoiceNumber": "2025-0001",
  "sentTo": "ola@example.com",
  "message": "Faktura sendt"
}
```

---

### 6. Kanseller ordre

Kansellerer/krediterer en ordre.

```
POST /orders/cancel/{sourceOrderId}
```

#### Request Body

```json
{
  "reason": "Kunden ønsket å avbestille"
}
```

#### Response

```json
{
  "success": true,
  "message": "Faktura kreditert",
  "invoiceNumber": "2025-0001",
  "creditNoteNumber": "K2025-0001",
  "creditNoteId": "cm5abc..."
}
```

---

## Webhook Callbacks

Når en hendelse oppstår, sendes en POST-forespørsel til din registrerte `callbackUrl`.

### Headers fra invoice.dtax.no

| Header | Beskrivelse |
|--------|-------------|
| `X-Webhook-Event` | Event-type (f.eks. `invoice.paid`) |
| `X-Webhook-Timestamp` | Unix timestamp |
| `X-Webhook-Signature` | HMAC-SHA256 signatur for validering |
| `X-Webhook-Id` | Unik event-ID for deduplicering |

### Validere signatur

```javascript
function validateWebhookSignature(body, timestamp, signature, secret) {
  const payload = `${timestamp}.${JSON.stringify(body)}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === expected;
}
```

### Event-typer

#### `invoice.created`

Faktura opprettet.

```json
{
  "eventId": "evt_abc123",
  "event": "invoice.created",
  "timestamp": "2024-12-29T10:00:00.000Z",
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "data": {
    "status": "DRAFT",
    "totalAmount": 2500.00,
    "vatAmount": 500.00,
    "dueDate": "2025-01-12T00:00:00.000Z",
    "currency": "NOK",
    "kid": "0000108472934561",
    "customerName": "Ola Nordmann AS",
    "customerEmail": "ola@example.com"
  }
}
```

#### `invoice.sent`

Faktura sendt til kunde.

```json
{
  "eventId": "evt_def456",
  "event": "invoice.sent",
  "timestamp": "2024-12-29T10:05:00.000Z",
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "data": {
    "status": "SENT",
    "sentAt": "2024-12-29T10:05:00.000Z",
    "sentTo": "ola@example.com",
    "method": "email"
  }
}
```

#### `invoice.paid`

Faktura fullstendig betalt.

```json
{
  "eventId": "evt_ghi789",
  "event": "invoice.paid",
  "timestamp": "2024-12-30T14:30:00.000Z",
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "data": {
    "status": "PAID",
    "paidAt": "2024-12-30T14:30:00.000Z",
    "paidAmount": 2500.00,
    "paymentMethod": "BANK_TRANSFER",
    "transactionId": "DNB-123456"
  }
}
```

#### `payment.partial`

Delvis betaling mottatt.

```json
{
  "eventId": "evt_jkl012",
  "event": "payment.partial",
  "timestamp": "2024-12-30T12:00:00.000Z",
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "data": {
    "status": "PARTIALLY_PAID",
    "paidAmount": 1000.00,
    "remainingAmount": 1500.00,
    "totalAmount": 2500.00,
    "paymentMethod": "VIPPS",
    "paidAt": "2024-12-30T12:00:00.000Z"
  }
}
```

#### `invoice.overdue`

Faktura forfalt.

```json
{
  "eventId": "evt_mno345",
  "event": "invoice.overdue",
  "timestamp": "2025-01-13T00:00:00.000Z",
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "data": {
    "status": "OVERDUE",
    "dueDate": "2025-01-12T00:00:00.000Z",
    "daysOverdue": 1,
    "totalAmount": 2500.00,
    "remainingAmount": 2500.00
  }
}
```

#### `creditnote.created`

Kreditnota opprettet.

```json
{
  "eventId": "evt_pqr678",
  "event": "creditnote.created",
  "timestamp": "2025-01-05T09:00:00.000Z",
  "sourceOrderId": "ORDER-2025-00123",
  "invoiceId": "cm5xyz123...",
  "invoiceNumber": "2025-0001",
  "data": {
    "creditNoteNumber": "K2025-0001",
    "creditNoteId": "cm5abc...",
    "originalInvoiceNumber": "2025-0001",
    "creditAmount": 2500.00,
    "reason": "Kunden avbestilte"
  }
}
```

### Forventet respons

Ditt callback-endepunkt bør returnere HTTP 200-299 for å bekrefte mottak:

```json
{
  "received": true
}
```

### Retry-policy

Hvis callback feiler:
- Forsøk 1: Umiddelbart
- Forsøk 2: Etter 2 sekunder
- Forsøk 3: Etter 4 sekunder

Etter 3 mislykkede forsøk markeres webhook som FAILED og kan retryes manuelt.

---

## Implementeringsguide for tax.salestext.no

### 1. Sett opp API-nøkler

Bruk følgende credentials:

```
API Key: tax_a352897dc2a328cb28d80ff307a130de
API Secret: a517d8c43ddaa69942010f7b446363033df62dbd189e0142f721776596b5fdf5
```

### 2. Implementer ordre-sending

```javascript
const axios = require('axios');
const crypto = require('crypto');

const API_KEY = 'tax_a352897dc2a328cb28d80ff307a130de';
const API_SECRET = 'a517d8c43ddaa69942010f7b446363033df62dbd189e0142f721776596b5fdf5';
const BASE_URL = 'https://invoice.dtax.no/api';

async function sendOrderToInvoice(orderData) {
  const body = {
    source: 'tax.salestext.no',
    sourceOrderId: orderData.id,
    customer: {
      name: orderData.userName,
      email: orderData.userEmail,
      // ... andre felter
    },
    lines: [
      {
        description: `Skatteberegning ${orderData.taxYear}`,
        quantity: 1,
        unitPrice: orderData.commissionAmount,
        vatRate: 0.25,
      },
    ],
    dueDays: 14,
    callbackUrl: 'https://tax.salestext.no/api/invoice-callback',
    autoSend: true,
    metadata: {
      taxYear: orderData.taxYear,
      calculationType: orderData.type,
    },
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', API_SECRET)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest('hex');

  const response = await axios.post(`${BASE_URL}/orders/receive`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
  });

  return response.data;
}
```

### 3. Implementer callback-endpoint

```javascript
// POST /api/invoice-callback
app.post('/api/invoice-callback', async (req, res) => {
  const event = req.headers['x-webhook-event'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const signature = req.headers['x-webhook-signature'];
  const eventId = req.headers['x-webhook-id'];

  // Valider signatur (valgfritt men anbefalt)
  // const isValid = validateSignature(req.body, timestamp, signature, API_SECRET);

  const { sourceOrderId, invoiceNumber, data } = req.body;

  switch (event) {
    case 'invoice.created':
      console.log(`Faktura ${invoiceNumber} opprettet for ordre ${sourceOrderId}`);
      await updateOrderStatus(sourceOrderId, 'INVOICE_CREATED', data);
      break;

    case 'invoice.sent':
      console.log(`Faktura ${invoiceNumber} sendt til ${data.sentTo}`);
      await updateOrderStatus(sourceOrderId, 'INVOICE_SENT', data);
      break;

    case 'invoice.paid':
      console.log(`Faktura ${invoiceNumber} betalt ${data.paidAmount} NOK`);
      await updateOrderStatus(sourceOrderId, 'PAID', data);
      await deliverTaxDocuments(sourceOrderId); // Lever skattedokumenter
      break;

    case 'payment.partial':
      console.log(`Delvis betaling: ${data.paidAmount} av ${data.totalAmount}`);
      await updateOrderStatus(sourceOrderId, 'PARTIAL_PAYMENT', data);
      break;

    case 'invoice.overdue':
      console.log(`Faktura ${invoiceNumber} forfalt, ${data.daysOverdue} dager`);
      await sendReminderEmail(sourceOrderId);
      break;
  }

  res.json({ received: true });
});
```

### 4. Sjekk status ved behov

```javascript
async function checkInvoiceStatus(sourceOrderId) {
  const response = await axios.get(
    `${BASE_URL}/orders/status/${sourceOrderId}`,
    {
      headers: { 'X-API-Key': API_KEY },
    }
  );

  return response.data;
  // {
  //   status: 'PAID',
  //   paidAmount: 2500.00,
  //   paidAt: '2024-12-30T14:30:00.000Z',
  //   ...
  // }
}
```

---

## Beste praksis

1. **Idempotens:** Bruk unike `sourceOrderId` og håndter 409 Conflict gracefully
2. **Retry-logikk:** Implementer eksponentiell backoff ved feil
3. **Webhook-deduplicering:** Lagre `eventId` for å unngå duplikater
4. **Signaturvalidering:** Alltid valider webhook-signaturer i produksjon
5. **Logging:** Logg alle API-kall og webhooks for feilsøking

---

## Support

- **API-spørsmål:** Send e-post til support@dtax.no
- **Webhook-status:** Se admin-panel på invoice.dtax.no/admin/webhooks
- **Testmiljø:** Kontakt oss for sandbox-tilgang

---

*Dokumentasjon versjon 1.0 - 29. desember 2025*
