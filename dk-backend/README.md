# DK Backend Setup and Fix Notes

This file documents the process used to fix the Prisma startup error and get the backend running.

## Bank Authorization And Sign Key Test

The bank gateway auth/sign-key flow can be tested without Postman:

```bash
cd dk-backend
npm run bank:sign-key
```

The script reads bank credentials from `.env`, then:

1. Calls `BANK_AUTH_TOKEN_URL` with `application/x-www-form-urlencoded`.
2. Uses the returned `access_token` as `Authorization: Bearer <access_token>`.
3. Calls `BANK_SIGN_KEY_URL` with JSON body containing `request_id` and `source_app`.
4. Prints redacted token/key previews.
5. Saves redacted response summaries under `tmp/bank-api/`.

Important notes:

- Use `URLSearchParams` or `curl --data-urlencode` for auth because `client_secret` may contain characters such as `&`, `<`, `>`, `|`, and `$`.
- The sign-key API may return the key as raw PEM text instead of JSON. The helper script accepts both response formats.
- `tmp/` is ignored by Git because bank API outputs can contain sensitive material.

## REST API Testing From Terminal

Use these commands when you want to test the bank REST APIs directly without Postman. They load values from `.env`, so do not paste credentials into the terminal command.

### 1. Load environment variables

```bash
cd dk-backend
set -a
source .env
set +a
```

### 2. Fetch authorization token

```bash
curl -i -X POST "$BANK_AUTH_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "$BANK_GATEWAY_API_KEY_HEADER: $BANK_GATEWAY_API_KEY" \
  --data-urlencode "username=$BANK_AUTH_USERNAME" \
  --data-urlencode "password=$BANK_AUTH_PASSWORD" \
  --data-urlencode "client_id=$BANK_AUTH_CLIENT_ID" \
  --data-urlencode "client_secret=$BANK_AUTH_CLIENT_SECRET" \
  --data-urlencode "grant_type=$BANK_AUTH_GRANT_TYPE" \
  --data-urlencode "scopes=$BANK_AUTH_SCOPES" \
  --data-urlencode "source_app=$BANK_AUTH_SOURCE_APP" \
  --data-urlencode "request_id=DKT-$(date +%s)"
```

The response should include:

```json
{
  "response_code": "0000",
  "response_data": {
    "access_token": "..."
  }
}
```

### 3. Save token into a shell variable

Run this command to fetch the token and store it as `ACCESS_TOKEN`:

```bash
ACCESS_TOKEN=$(
  curl -s -X POST "$BANK_AUTH_TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "$BANK_GATEWAY_API_KEY_HEADER: $BANK_GATEWAY_API_KEY" \
    --data-urlencode "username=$BANK_AUTH_USERNAME" \
    --data-urlencode "password=$BANK_AUTH_PASSWORD" \
    --data-urlencode "client_id=$BANK_AUTH_CLIENT_ID" \
    --data-urlencode "client_secret=$BANK_AUTH_CLIENT_SECRET" \
    --data-urlencode "grant_type=$BANK_AUTH_GRANT_TYPE" \
    --data-urlencode "scopes=$BANK_AUTH_SCOPES" \
    --data-urlencode "source_app=$BANK_AUTH_SOURCE_APP" \
    --data-urlencode "request_id=DKT-$(date +%s)" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log(j.response_data?.access_token || j.access_token || j.token || "")})'
)

echo "Token preview: ${ACCESS_TOKEN:0:12}..."
```

### 4. Fetch sign key

```bash
curl -i -X POST "$BANK_SIGN_KEY_URL" \
  -H "Content-Type: application/json" \
  -H "$BANK_GATEWAY_API_KEY_HEADER: $BANK_GATEWAY_API_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "request_id": "DKT-SIGN-001",
    "source_app": "'"$BANK_AUTH_SOURCE_APP"'"
  }'
```

The sign-key endpoint may return raw PEM text instead of JSON:

```text
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

If the sign-key response returns HTTP `200` with PEM text, the auth token and sign-key steps are working.

## DK Signature For Bank Requests

After the sign key is fetched, every secure bank request must include the DK signature headers from the bank document.

Implemented in:

```text
src/services/bankApi.service.js
```

For account inquiry and payout requests, the service now:

1. Fetches or reuses the bank `access_token`.
2. Fetches or reuses the RSA private key from `POST /v1/sign/key`.
3. Serializes the request body as canonical JSON with sorted keys and no extra spaces.
4. Base64-encodes that canonical body into the JWT payload `data` field.
5. Generates UTC timestamp and nonce.
6. Signs the JWT payload with RS256 using the RSA private key.
7. Sends these headers with the bank request:

```text
Authorization: Bearer <access_token>
DK-Signature: DKSignature <rs256_jwt>
DK-Timestamp: <utc_timestamp>
DK-Nonce: <unique_nonce>
source_app: SRC_APP_0201
```

This matches the bank requirement that the server can verify the JWT signature, body data, timestamp window, and nonce uniqueness.

## Beneficiary Account Inquiry Test

The next bank flow for FIAT payout is:

```text
POST /v1/beneficiary/account_inquiry
```

Test it from terminal:

```bash
cd dk-backend
npm run bank:inquiry
```

Optional arguments:

```bash
npm run bank:inquiry -- 5.00 100100148337
```

The script performs:

1. Fetch authorization token.
2. Fetch RSA sign key.
3. Build the beneficiary inquiry request body:

```json
{
  "request_id": "DKT-...",
  "amount": "5.00",
  "currency": "BTN",
  "bene_bank_code": "1060",
  "bene_account_number": "100100148337",
  "source_account_name": "Rinizn",
  "soure_account_number": "100100148337"
}
```

4. Generate `DK-Signature`, `DK-Timestamp`, and `DK-Nonce`.
5. Send the signed request.
6. Save the response to:

```text
tmp/bank-api/account-inquiry-response.json
```

## Intra-bank Fund Transfer Test

The next FIAT payout flow is:

```text
POST /v1/initiate/transaction
```

The transfer helper uses the last successful beneficiary inquiry response from:

```text
tmp/bank-api/account-inquiry-response.json
```

Preview the transfer request without sending it:

```bash
cd dk-backend
npm run bank:transfer
```

This writes a redacted preview to:

```text
tmp/bank-api/fund-transfer-request-preview.json
```

After reviewing the preview, send the UAT transfer explicitly:

```bash
npm run bank:transfer -- --confirm 10.00
```

The script performs:

1. Reads `inquiry_id`, beneficiary account, and beneficiary name from the last inquiry response.
2. Fetches authorization token.
3. Fetches RSA sign key.
4. Builds the transfer request body:

```json
{
  "request_id": "DKT-...",
  "inquiry_id": "IN...",
  "transaction_datetime": "2026-05-04T00:00:00Z",
  "source_app": "SRC_AVS_0201",
  "transaction_amount": 10,
  "currency": "BTN",
  "payment_type": "INTRA",
  "source_account_name": "Rinzin Jamtsho",
  "source_account_number": "100100148337",
  "bene_cust_name": "Beneficiary Name",
  "bene_account_number": "Beneficiary Account",
  "bene_bank_code": "1060",
  "narration": "DKT settlement transfer ..."
}
```

5. Generates `DK-Signature`, `DK-Timestamp`, and `DK-Nonce`.
6. Sends the signed transfer request only when `--confirm` is present.
7. Saves the response to:

```text
tmp/bank-api/fund-transfer-response.json
```

## Transaction Status Test

After a transfer is queued, check its status with:

```text
POST /v1/transaction/status
```

Run:

```bash
cd dk-backend
npm run bank:status
```

By default, the script reads:

- `transaction_id` from `tmp/bank-api/fund-transfer-response.json`
- beneficiary account from `BANK_TEST_BENEFICIARY_ACCOUNT`

You can also pass both values manually:

```bash
npm run bank:status -- test_txn_update23567 100100365856
```

The request body is:

```json
{
  "request_id": "DKT-...",
  "transaction_id": "test_txn_update23567",
  "bene_account_number": "100100365856"
}
```

The script signs the request with `DK-Signature`, `DK-Timestamp`, and `DK-Nonce`, then saves the response to:

```text
tmp/bank-api/transaction-status-response.json
```

## CBS UAT Account Inquiry Setup

CBS account inquiry is separate from the DK payment gateway beneficiary inquiry.

Use CBS inquiry when the app needs to check account details directly, such as:

- verifying that an account exists
- fetching account holder details
- showing account details before the user confirms a transfer

Use DK beneficiary inquiry when preparing an actual DK-DK transfer because it returns the `inquiry_id` needed by `POST /v1/initiate/transaction`.

### CBS Postman Environment Variables

Create these Postman environment variables. Store real values in Postman or `.env`, not in README:

```text
CBS_BASE_URL=https://internal-gateway.sit.digitalkidu.bt:8082/uat/cbs/connect
CBS_API_KEY=<gateway_api_key>
CBS_USERNAME=<cbs_username>
CBS_PASSWORD=<cbs_password>
CBS_CLIENT_ID=<cbs_client_id>
CBS_CLIENT_SECRET=<cbs_client_secret>
CBS_SOURCE_APP=SRC_APP_0801
```

### CBS Common Headers

Use these headers for CBS requests unless the CBS document says otherwise:

```text
Content-Type: application/json
X-gravitee-api-key: {{CBS_API_KEY}}
source_app: {{CBS_SOURCE_APP}}
```

The CBS account inquiry endpoint also requires bank security headers:

```text
Authorization: Bearer <access_token>
DK-Timestamp: <timestamp in ISO 8601 format>
DK-Nonce: <unique alphanumeric nonce>
DK-Signature: DKSignature <signature>
```

The `DK-Signature`, `DK-Timestamp`, and `DK-Nonce` must be generated from the exact request body, the same way we sign DK payment gateway requests.

### CBS Account Inquiry

Account inquiry retrieves account details and status information based on the provided account number. The generated inquiry ID remains valid for 15 minutes. Full account information is accessible only to authorized sources.

```text
Method: POST
URL: {{CBS_BASE_URL}}/v1/acc/inquiry
Content-Type: application/json
X-gravitee-api-key: {{CBS_API_KEY}}
Authorization: Bearer <access_token>
DK-Timestamp: <utc_timestamp>
DK-Nonce: <unique_nonce>
DK-Signature: DKSignature <signature>
```

Request body:

```json
{
  "account_no": "100100365856",
  "request_id": "77777777777",
  "source_app": "SRC_APP_0801",
  "product_type": "LCY_ACC"
}
```

Test from terminal:

```bash
cd dk-backend
npm run cbs:inquiry -- 100100365856
```

Use the project-approved CBS UAT test accounts from `.env` for repeatable tests:

```bash
set -a
source .env
set +a
npm run cbs:inquiry -- "$CBS_TEST_ACCOUNT_1"
npm run cbs:inquiry -- "$CBS_TEST_ACCOUNT_2"
```

Optional product type:

```bash
npm run cbs:inquiry -- 100100365856 LCY_ACC
```

Required `.env` values:

```text
CBS_BASE_URL=
CBS_API_KEY=
CBS_USERNAME=
CBS_PASSWORD=
CBS_CLIENT_ID=
CBS_CLIENT_SECRET=
CBS_SOURCE_APP=SRC_APP_0801
CBS_TEST_ACCOUNT_NO=
CBS_TEST_ACCOUNT_1=
CBS_TEST_ACCOUNT_2=
```

The script performs:

1. Fetches CBS authorization token from `CBS_BASE_URL/v1/auth/token`.
   - CBS uses `scope=keys:read` for key access.
   - Do not use `scopes=keys:read`; that returns a token without the `keys:read` permission.
2. Fetches CBS sign key from `CBS_BASE_URL/v1/sign/key`.
3. Builds the signed account inquiry body.
   - CBS DK signature JWT includes `data`, `timestamp`, `nonce`, `iat`, and `exp`.
4. Sends `POST CBS_BASE_URL/v1/acc/inquiry`.
5. Saves the response to:

```text
tmp/bank-api/cbs-account-inquiry-response.json
```

### Backend CBS Endpoint

The backend exposes the same CBS inquiry flow for the app:

```text
POST http://localhost:5000/cbs/account-inquiry
```

Request body:

```json
{
  "account_no": "100100365856",
  "product_type": "LCY_ACC"
}
```

The endpoint accepts either snake case or camel case:

```json
{
  "accountNo": "100100365856",
  "productType": "LCY_ACC"
}
```

The frontend can load the two project-approved CBS UAT test accounts from:

```text
GET http://localhost:5000/cbs/test-accounts
```

Current response shape:

```json
{
  "productType": "LCY_ACC",
  "accounts": ["100100312011", "100100366202"]
}
```

The Bank tab uses this to show `Test Account 1` and `Test Account 2` quick-fill buttons before running `Check CBS`.

The CBS inquiry response includes the account details the frontend displays before burn/payout:

```text
response_data.account_info.account_no
response_data.account_info.account_name
response_data.account_status.acc_status_details
response_data.balance_info.btn_available_balance
response_data.daily_max_transfer_limit.intra_transfer.max_single_amt
response_data.meta_info.inquiry_id
```

Use this before FIAT payout because a test account can have changed balance from earlier burns/transfers.

The backend handles:

1. CBS authorization token.
2. CBS RSA sign key.
3. DK signature headers.
4. `POST CBS_BASE_URL/v1/acc/inquiry`.

### Terminal Test For Backend CBS Endpoint

Use this test to verify the real backend route that the frontend/app will call. This is different from `npm run cbs:inquiry`:

- `npm run cbs:inquiry` tests the CBS API directly from a helper script.
- `POST /cbs/account-inquiry` tests our Express backend endpoint and confirms routing, controller, service, and CBS integration all work together.

Start the backend from the correct folder:

```bash
cd dk-backend
npm start
```

Keep that terminal open. In another terminal, call the endpoint:

```bash
curl -X POST http://localhost:5000/cbs/account-inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "account_no": "100100312011",
    "product_type": "LCY_ACC"
  }'
```

Test the second project UAT account:

```bash
curl -X POST http://localhost:5000/cbs/account-inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "account_no": "100100366202",
    "product_type": "LCY_ACC"
  }'
```

Expected result:

```json
{
  "response_code": "0000",
  "response_data": {}
}
```

If you get:

```json
{
  "error": "Route not found",
  "path": "/cbs/account-inquiry"
}
```

then port `5000` is likely running an old server process or the server was started from the wrong folder. Stop the old server and restart from `dk-backend`:

```bash
lsof -i :5000
kill <PID>
cd dk-backend
npm start
```

You can also check the landing page:

```bash
curl http://localhost:5000/
```

The backend list should include `CBS Account Inquiry`.

## Settlement Bank Tracking

FIAT settlements now store bank identifiers returned by the DK payment gateway flow:

```text
cbsProductType
bankInquiryId
bankTransactionId
bankReference
bankApiStatus
bankApiMessage
bankStatusCheckedAt
```

### What We Did

We added bank tracking to settlement records so the backend can remember which bank inquiry and bank transfer belong to each FIAT settlement.

There are two settlement types:

```text
TOKEN settlement
```

- Used when the receiver is registered in the app.
- DKT/token is sent to the receiver wallet.
- No bank transfer happens.
- No bank status can be refreshed.

```text
FIAT settlement
```

- Used when the receiver is not registered in the app.
- Sender's DKT is expected to be burned by the app flow.
- Backend sends equivalent FIAT through the bank API.
- Bank inquiry ID and transaction ID are saved.
- Bank transfer status can be refreshed later.

The `settlement_id` is our PostgreSQL settlement record ID:

```text
Settlement.id
```

It is generated when you call:

```text
POST http://localhost:5000/settlements
```

Example response:

```json
{
  "id": "SETTLEMENT_ID",
  "settlementType": "FIAT",
  "bankInquiryId": "IN...",
  "bankTransactionId": "EP..."
}
```

That `id` is the value used in:

```bash
curl -X POST http://localhost:5000/settlements/<settlement_id>/status
```

This endpoint uses the saved `bankTransactionId` and `receiverAccount`, calls:

```text
POST /v1/transaction/status
```

and updates the settlement's bank status fields.

### Why Old TOKEN Settlement Did Not Work

If you call status refresh on a TOKEN settlement, the backend returns:

```json
{
  "error": "Only FIAT settlements have bank transfer status"
}
```

That is correct. A TOKEN settlement has no `bankTransactionId` because it never called the bank transfer API.

### Create A FIAT Settlement For Testing

Use a bank-approved UAT/test receiver account only.

Recommended backend endpoint for an unregistered receiver:

```bash
curl -X POST http://localhost:5000/settlements/fiat/unregistered \
  -H "Content-Type: application/json" \
  -d '{
    "bankId": "1898cf93-c396-4c93-99d4-de7eb7524c8d",
    "senderWallet": "BK1NqMpcHRqQ8YGBiG2MAFo2pt4D7zM1ojwhogBo6UpK",
    "amount": 1,
    "receiverAccount": "100100312011",
    "productType": "LCY_ACC",
    "burnTxSignature": "optional-solana-burn-signature"
  }'
```

This endpoint performs the backend flow for an unregistered receiver:

```text
POST /settlements/fiat/unregistered
-> CBS account inquiry
-> verify account status is OK
-> use CBS account name as receiverName
-> DK beneficiary account inquiry
-> DK fund transfer
-> save FIAT settlement
-> save CBS product type used for account inquiry
-> save bankInquiryId and bankTransactionId
-> decrement bank fiat reserve
```

If the endpoint returns:

```json
{
  "error": "Route not found",
  "path": "/settlements/fiat/unregistered"
}
```

restart the backend. Express only loads new routes when the server process starts:

```bash
lsof -i :5000
kill <PID>
cd dk-backend
npm start
```

The landing page should list `FIAT Unregistered Settlement` after restart:

```bash
curl http://localhost:5000/
```

The older generic settlement endpoint still works when you already have the receiver name:

```bash
curl -X POST http://localhost:5000/settlements \
  -H "Content-Type: application/json" \
  -d '{
    "bankId": "1898cf93-c396-4c93-99d4-de7eb7524c8d",
    "senderWallet": "BK1NqMpcHRqQ8YGBiG2MAFo2pt4D7zM1ojwhogBo6UpK",
    "recipientWallet": "4ogBmQPDQEZhgE9u4etM8kAgppDWZwCLFtEYNyMDfJrj",
    "recipientRegistered": false,
    "settlementType": "FIAT",
    "amount": 1,
    "receiverName": "Test Receiver",
    "receiverAccount": "100100312011"
  }'
```

The backend flow for this request is:

```text
POST /settlements
-> validate bank and sender wallet
-> call DK beneficiary account inquiry
-> call DK fund transfer
-> save Settlement row in PostgreSQL
-> save bankInquiryId and bankTransactionId
-> decrement bank fiat reserve
```

Copy the returned `id`, then refresh bank status:

```bash
curl -X POST http://localhost:5000/settlements/<FIAT_SETTLEMENT_ID>/status
```

This calls:

```text
POST /v1/transaction/status
```

and updates:

```text
bankApiStatus
bankApiMessage
bankStatusCheckedAt
```

### Database Note

After adding the new fields, PostgreSQL needed these columns:

```text
bankInquiryId
bankTransactionId
bankStatusCheckedAt
```

If Prisma reports a missing column, run:

```bash
cd dk-backend
npm run prisma:generate
npm run prisma:push
```

If `prisma:push` fails with the generic schema engine error in a restricted environment, add the nullable columns manually in local PostgreSQL:

```sql
ALTER TABLE "Settlement"
ADD COLUMN IF NOT EXISTS "bankInquiryId" TEXT,
ADD COLUMN IF NOT EXISTS "bankTransactionId" TEXT,
ADD COLUMN IF NOT EXISTS "bankStatusCheckedAt" TIMESTAMP(3);
```

## Problem

The backend could run:

```bash
npx prisma generate
npx prisma db push
```

but failed when starting the server:

```bash
node src/server.js
```

Error:

```text
PrismaClientInitializationError:
`PrismaClient` needs to be constructed with a non-empty, valid `PrismaClientOptions`
```

## Cause

This project uses Prisma `7.8.0`. In Prisma 7, `new PrismaClient()` requires either:

- a database driver adapter, or
- a Prisma Accelerate URL.

Because this backend connects directly to a local PostgreSQL database, the correct fix is to use the PostgreSQL driver adapter.

## Changes Made

### 1. Installed PostgreSQL adapter packages

```bash
npm install @prisma/adapter-pg pg
```

This added:

- `@prisma/adapter-pg`
- `pg`

### 2. Updated Prisma client setup

File:

```text
src/prisma.js
```

Updated from:

```js
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

to:

```js
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
```

### 3. Added missing `User` model

The existing controller uses:

```js
prisma.user.create(...)
prisma.user.findMany()
```

but `schema.prisma` only had `MintRequest`.

Added this model:

```prisma
model User {
  id        String   @id @default(uuid())
  wallet    String   @unique
  role      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

`@@map("users")` keeps the Prisma API as `prisma.user` while creating the database table as `users`.

### 4. Added bank extension models and routes

For the banking extension, the backend now stores registered banks and links bank mint requests to their fiat reserve.

Added `Bank` model:

```prisma
model Bank {
  id          String   @id @default(uuid())
  name        String
  wallet      String   @unique
  currency    String   @default("BTN")
  fiatReserve Float
  status      String   @default("Active")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  mintRequests MintRequest[]
}
```

Updated `MintRequest` with:

```prisma
bankId          String?
reserveSnapshot Float?
bank            Bank? @relation(fields: [bankId], references: [id])
```

Added API routes:

```text
POST  /banks
GET   /banks
GET   /banks/wallet/:wallet
PATCH /banks/:id/reserve
```

Bank mint request rule:

```text
If a request has a bankId, the backend checks the bank exists,
the maker wallet matches the bank wallet, and the requested DKT
amount is not greater than the recorded fiat reserve.
```

### 5. Added settlement extension

For bank-to-user value movement, the backend now records settlements.

Added `Settlement` model:

```prisma
model Settlement {
  id                  String   @id @default(uuid())
  bankId              String
  senderWallet        String
  recipientWallet     String
  recipientRegistered Boolean
  settlementType      String
  amount              Float
  currency            String   @default("BTN")
  status              String   @default("Completed")
  txSignature         String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  bank                Bank     @relation(fields: [bankId], references: [id])
}
```

Added API routes:

```text
POST /settlements
GET  /settlements
GET  /settlements?bankId=:bankId
```

Settlement rule:

```text
Registered receiver -> TOKEN settlement after DKT transfer.
Unregistered receiver -> FIAT settlement after DKT burn.
FIAT settlement decrements the bank fiat reserve.
```

### 6. Added mock bank API service

File:

```text
src/services/bankApi.service.js
```

For FIAT settlements, backend now simulates a bank payout and stores:

```text
receiverName
receiverAccount
bankReference
bankApiStatus
bankApiMessage
```

Example mock reference:

```text
MOCK-BANK-20260430-123456
```

In a real bank integration, replace this service with the actual bank API client while keeping the settlement controller flow the same.

## Required Environment Variable

Create or update:

```text
.env
```

with:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME"
```

Use your own PostgreSQL username, password, and database name.

## Commands to Run

From the backend folder:

```bash
cd dk-backend
```

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npx prisma generate
```

Push schema to the database:

```bash
npx prisma db push
```

Start the backend:

```bash
npm start
```

Expected output:

```text
Server running on port 5000
```

## Verification Used

Generated Prisma Client:

```bash
npx prisma generate
```

Synced the database:

```bash
npx prisma db push
```

Started the server:

```bash
node src/server.js
```

Checked Prisma database access:

```bash
node -e 'import { prisma } from "./src/prisma.js"; console.log(await prisma.user.count()); await prisma.$disconnect();'
```

Expected result:

```text
0
```

The number may be different after users are added.

## Thunder Client Testing

After the server was running, the API was tested using Thunder Client.

### 1. Server health check

Use:

```text
GET http://localhost:5000/
```

Expected response:

```json
{
  "message": "DK Backend Running "
}
```

This confirms Express is running.

### 2. Important route fix

The user route is plural:

```text
/users
```

Correct:

```text
POST http://localhost:5000/users
```

Incorrect:

```text
POST http://localhost:5000/user
```

The route is plural because `src/server.js` registers it like this:

```js
app.use("/users", userRoutes);
```

### 3. Create user request

In Thunder Client:

- Method: `POST`
- URL: `http://localhost:5000/users`
- Open the `Body` tab
- Select `JSON`
- Paste the JSON body below

Body:

```json
{
  "wallet": "test-wallet-address-1",
  "role": "user"
}
```

Then click `Send`.

Expected successful response:

```json
{
  "id": "...",
  "wallet": "test-wallet-address-1",
  "role": "user",
  "createdAt": "...",
  "updatedAt": "..."
}
```

This confirmed that:

- Thunder Client can send requests to the backend.
- Express receives JSON body data correctly.
- Prisma can create a `User` row in PostgreSQL.
- The `users` table is working.

### 4. Get all users

Use:

```text
GET http://localhost:5000/users
```

Expected response:

```json
[
  {
    "id": "...",
    "wallet": "test-wallet-address-1",
    "role": "user",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

The response may contain more users depending on how many were created.

### 4.1 Get user by wallet

Use:

```text
GET http://localhost:5000/users/wallet/YOUR_WALLET_ADDRESS
```

Example:

```text
GET http://localhost:5000/users/wallet/test-wallet-address-1
```

Expected response:

```json
{
  "id": "...",
  "wallet": "test-wallet-address-1",
  "role": "User",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 5. Thunder Client body note

The JSON request body is not added from the `Headers` tab.

Use:

```text
Body -> JSON
```

Thunder Client usually adds this header automatically:

```text
Content-Type: application/json
```

If the same wallet is sent twice, the request may fail because `wallet` is unique in the Prisma schema.

Use a new wallet value for each test:

```json
{
  "wallet": "test-wallet-address-2",
  "role": "User"
}
```

Allowed user roles:

```text
Admin
Maker
Checker
User
```

If another role is used, the backend returns:

```json
{
  "error": "role must be Admin, Maker, Checker or User"
}
```

## Successful Result

The backend is now working with:

- PostgreSQL database connection
- Prisma 7 client adapter setup
- `User` model in Prisma schema
- `/users` API routes
- role validation for `Admin`, `Maker`, `Checker`, and `User`
- user lookup by wallet
- Thunder Client POST request with JSON body
- User creation and user fetching

## Mint Request API

The next backend feature added was API support for the existing `MintRequest` Prisma model.

Files added:

```text
src/controllers/mintRequest.controller.js
src/routes/mintRequest.routes.js
```

File updated:

```text
src/server.js
```

The route was registered with:

```js
app.use("/mint-requests", mintRequestRoutes);
```

### Available mint request endpoints

Create mint request:

```text
POST http://localhost:5000/mint-requests
```

Get all mint requests:

```text
GET http://localhost:5000/mint-requests
```

Get one mint request:

```text
GET http://localhost:5000/mint-requests/:id
```

Update status manually:

```text
PATCH http://localhost:5000/mint-requests/:id/status
```

Approve request:

```text
PATCH http://localhost:5000/mint-requests/:id/approve
```

Reject request:

```text
PATCH http://localhost:5000/mint-requests/:id/reject
```

### Create mint request in Thunder Client

Use:

```text
POST http://localhost:5000/mint-requests
```

Body -> JSON:

```json
{
  "requestAddr": "test-request-address-1",
  "maker": "test-maker-wallet",
  "amount": 25
}
```

Expected response:

```json
{
  "id": "...",
  "requestAddr": "test-request-address-1",
  "maker": "test-maker-wallet",
  "amount": 25,
  "status": "Pending",
  "txSignature": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Approve mint request in Thunder Client

Use the `id` returned from the create request:

```text
PATCH http://localhost:5000/mint-requests/YOUR_MINT_REQUEST_ID/approve
```

Body -> JSON:

```json
{
  "txSignature": "test-signature"
}
```

Expected response:

```json
{
  "id": "...",
  "requestAddr": "test-request-address-1",
  "maker": "test-maker-wallet",
  "amount": 25,
  "status": "Approved",
  "txSignature": "test-signature",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Reject mint request in Thunder Client

Use:

```text
PATCH http://localhost:5000/mint-requests/YOUR_MINT_REQUEST_ID/reject
```

Body -> JSON:

```json
{
  "txSignature": "optional-reject-signature"
}
```

Expected response has:

```json
{
  "status": "Rejected"
}
```

### Mint request validation

The backend now checks:

- `requestAddr`, `maker`, and `amount` are required.
- `amount` must be a positive number.
- `requestAddr` must be unique.
- status must be `Pending`, `Approved`, or `Rejected`.

### Mint request verification

The create and approve controller flow was tested against PostgreSQL.

Successful test result:

```text
create 201 { "status": "Pending", ... }
approve 200 { "status": "Approved", "txSignature": "test-signature", ... }
```

## NPM Scripts

The backend now has these scripts:

```bash
npm run dev
npm start
npm run prisma:generate
npm run prisma:push
```

## Route Errors

Unknown routes now return a clear JSON response.

Example:

```text
GET http://localhost:5000/unknown-route
```

Response:

```json
{
  "error": "Route not found",
  "path": "/unknown-route"
}
```

## Latest Successful User Verification

The user flow was tested against PostgreSQL with:

- create user using role `Maker`
- look up the same user by wallet

Successful test result:

```text
create-user 201 { "role": "Maker", ... }
lookup-user 200 { "role": "Maker", ... }
```

## Token Config API

The backend now stores the current on-chain config address and mint address so the frontend can reload them after refresh.

Routes:

```text
GET http://localhost:5000/token-config
PUT http://localhost:5000/token-config
```

Example `PUT` body:

```json
{
  "adminAddr": "ADMIN_PUBLIC_KEY",
  "configAddr": "CONFIG_PUBLIC_KEY",
  "mintAddr": "MINT_PUBLIC_KEY",
  "checkers": ["CHECKER_PUBLIC_KEY"]
}
```

Addresses are validated as Solana public keys.

Successful verification:

```text
update-config 200
get-config 200
```

## Notes

- Do not commit real database passwords from `.env`.
- If `npx prisma db push` gives a generic schema engine error inside a restricted environment, run it from a normal terminal so Prisma can access its local cache/config folders.
- The backend currently listens on port `5000`.
