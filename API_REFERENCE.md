# API Reference

Base URL: `/api`

Auth: `Authorization: Bearer <token>`

Note: `GET` endpoints do not require a JSON body. For body-less `POST` actions, use `{}`.

## Public / Shared

### `GET /health`
Request body: none

### `POST /auth/login`
```json
{ "email": "admin@example.com", "password": "StrongPass123" }
```

### `POST /auth/customer-login`
```json
{ "cid": "11122233344", "mpin": "1234" }
```

### `POST /bips/account-inquiry`
```json
{
  "Amount": "1000.00",
  "BeneficiaryAccountNumber": "123456789012",
  "BeneficiaryBankCode": "1010",
  "SourceAccountName": "DK Treasury",
  "SourceAccountNumber": "987654321000",
  "SourceBankCode": "1060",
  "TransferPurpose": "Reserve settlement",
  "request_id": "REQ-20260519-0001"
}
```

### `POST /bips/transfer`
```json
{
  "Amount": "1000.00",
  "BeneficiaryAccountName": "Beneficiary Name",
  "BeneficiaryAccountNumber": "123456789012",
  "BeneficiaryBankCode": "1010",
  "SourceAccountName": "DK Treasury",
  "SourceAccountNumber": "987654321000",
  "SourceBankCode": "1060",
  "TransferPurpose": "Reserve settlement",
  "request_id": "REQ-20260519-0001",
  "reference_number": "BIPS-REF-0001"
}
```

### `GET /bips/transaction-status/:id`
Request body: none

### `GET /bips/bank-codes`
Request body: none

## Authenticated Core

### `GET /auth/me`
Request body: none

### `PATCH /auth/customer-bank-accounts`
```json
{
  "accounts": [
    {
      "bankId": "11111111-1111-1111-1111-111111111111",
      "accountNumber": "123456789012",
      "accountName": "Pema Wangchuk",
      "isPrimary": true
    }
  ]
}
```

### `GET /dashboard`
Request body: none

### `GET /token-requests`
Request body: none

### `GET /settlements`
Request body: none

### `GET /reserves`
Request body: none

### `GET /payments/:paymentReference`
Request body: none

## Token Requests

### `POST /token-requests`
```json
{
  "requestType": "TRANSFER",
  "tokenMintAddress": "So11111111111111111111111111111111111111112",
  "amount": "250.00",
  "sourceWalletId": "22222222-2222-2222-2222-222222222222",
  "destinationWalletId": "33333333-3333-3333-3333-333333333333",
  "remarks": "Treasury distribution"
}
```

### `PATCH /token-requests/:id`
```json
{ "amount": "300.00", "remarks": "Updated amount" }
```

### `POST /token-requests/:id/submit`
```json
{}
```

### `POST /token-requests/:id/cancel`
```json
{}
```

### `POST /token-requests/:id/approve`
```json
{
  "comment": "Approved by checker",
  "txSignature": "5kExampleSignature",
  "explorerUrl": "https://explorer.solana.com/tx/5kExampleSignature"
}
```

### `POST /token-requests/:id/reject`
```json
{
  "rejectionReason": "Insufficient reserve backing",
  "comment": "Mismatch detected",
  "txSignature": "5kExampleSignature",
  "explorerUrl": "https://explorer.solana.com/tx/5kExampleSignature"
}
```

### `POST /token-requests/:id/mark-ready`
```json
{}
```

### `POST /token-requests/:id/record-initiation`
```json
{
  "makerWalletAddress": "7Yk6ExampleMakerWallet1111111111111111111111",
  "onChainRequestAddress": "9AbcExampleRequest11111111111111111111111",
  "initiationTxSignature": "3xInitExampleSignature",
  "initiationExplorerUrl": "https://explorer.solana.com/tx/3xInitExampleSignature",
  "sourceTokenAccountAddress": "SrcToken1111111111111111111111111111111111",
  "destinationTokenAccountAddress": "DstToken1111111111111111111111111111111111"
}
```

### `POST /token-requests/:id/record-cancellation`
```json
{
  "makerWalletAddress": "7Yk6ExampleMakerWallet1111111111111111111111",
  "txSignature": "4xCancelExampleSignature",
  "explorerUrl": "https://explorer.solana.com/tx/4xCancelExampleSignature"
}
```

### `POST /token-requests/:id/execute`
```json
{}
```

### `POST /token-requests/:id/record-execution`
```json
{
  "status": "EXECUTED",
  "txSignature": "6xExecExampleSignature",
  "explorerUrl": "https://explorer.solana.com/tx/6xExecExampleSignature",
  "executionError": ""
}
```

## Settlements

### `POST /settlements/reconcile-pending`
```json
{ "limit": 20, "includeManualReview": false }
```

### `POST /settlements/reserve-mint`
```json
{
  "sourceBankId": "44444444-4444-4444-4444-444444444444",
  "reserveLedgerId": "55555555-5555-5555-5555-555555555555",
  "tokenMintAddress": "So11111111111111111111111111111111111111112",
  "amount": "10000.00",
  "transferPurpose": "Reserve mint funding"
}
```

### `POST /settlements/replenishment-mint`
```json
{
  "sourceBankId": "44444444-4444-4444-4444-444444444444",
  "reserveLedgerId": "55555555-5555-5555-5555-555555555555",
  "tokenMintAddress": "So11111111111111111111111111111111111111112",
  "amount": "5000.00",
  "transferPurpose": "Liquidity top-up"
}
```

### `POST /settlements/interbank-transfer`
```json
{
  "sourceBankId": "44444444-4444-4444-4444-444444444444",
  "destinationBankId": "66666666-6666-6666-6666-666666666666",
  "tokenMintAddress": "So11111111111111111111111111111111111111112",
  "amount": "2500.00",
  "transferPurpose": "Interbank settlement",
  "beneficiaryAccountName": "BOB Settlement Account",
  "beneficiaryAccountNumber": "123456789012",
  "beneficiaryBankCode": "1010",
  "sourceAccountName": "DK Settlement Account",
  "sourceAccountNumber": "987654321000",
  "requestId": "REQ-20260519-1001"
}
```

### `POST /settlements/redemptions`
```json
{
  "sourceBankId": "44444444-4444-4444-4444-444444444444",
  "destinationBankId": "66666666-6666-6666-6666-666666666666",
  "tokenMintAddress": "So11111111111111111111111111111111111111112",
  "amount": "1500.00",
  "transferPurpose": "Customer redemption",
  "beneficiaryAccountName": "Customer Name",
  "beneficiaryAccountNumber": "123456789012",
  "beneficiaryBankCode": "1010",
  "sourceAccountName": "DK Settlement Account",
  "sourceAccountNumber": "987654321000",
  "requestId": "REQ-20260519-1002"
}
```

### `POST /settlements/:id/record-initiation`
### `POST /settlements/:id/record-transfer-initiation`
### `POST /settlements/:id/record-burn-initiation`
```json
{
  "makerWalletAddress": "7Yk6ExampleMakerWallet1111111111111111111111",
  "onChainRequestAddress": "9AbcExampleRequest11111111111111111111111",
  "initiationTxSignature": "3xInitExampleSignature",
  "initiationExplorerUrl": "https://explorer.solana.com/tx/3xInitExampleSignature",
  "sourceTokenAccountAddress": "SrcToken1111111111111111111111111111111111",
  "destinationTokenAccountAddress": "DstToken1111111111111111111111111111111111"
}
```

### `POST /settlements/:id/record-execution`
### `POST /settlements/:id/record-transfer-execution`
### `POST /settlements/:id/record-burn-execution`
```json
{
  "status": "SETTLED",
  "txSignature": "6xExecExampleSignature",
  "explorerUrl": "https://explorer.solana.com/tx/6xExecExampleSignature",
  "executionError": ""
}
```

### `POST /settlements/:id/run-inquiry`
```json
{}
```

### `POST /settlements/:id/reconcile`
```json
{}
```

### `POST /settlements/:id/route`
```json
{}
```

### `POST /settlements/:id/approve`
```json
{ "comment": "Approved for execution" }
```

### `POST /settlements/:id/reject`
```json
{ "rejectionReason": "Bank account details invalid", "comment": "Please correct and resubmit" }
```

### `POST /settlements/:id/mark-ready`
```json
{}
```

### `POST /settlements/:id/execute`
```json
{}
```

## Customer Payments

### `POST /payments/customer/buy-btn`
```json
{ "amount": "1000.00", "debitAccount": "123456789012", "phoneNumber": "17123456" }
```

### `POST /payments/customer/:paymentReference/confirm-buy`
```json
{ "otp": "123456", "orderNo": "ORDER-0001", "requestId": "REQ-20260519-2001" }
```

### `POST /payments/customer/sell-btn`
```json
{ "amount": "500.00", "payoutAccount": "123456789012" }
```

### `POST /payments/customer/transfer-btn`
```json
{ "amount": "250.00", "recipientCid": "11122233344" }
```

### `POST /payments/customer/:paymentReference/verify-status`
```json
{}
```

## Gateway / Payment Ops

### `POST /payments/callback`
```json
{
  "paymentReference": "PAY-0001",
  "transactionReference": "TXN-0001",
  "gatewayTransactionId": "GTX-0001",
  "payerName": "Pema Wangchuk",
  "payerAccount": "123456789012",
  "amount": "1000.00",
  "currency": "BTN",
  "status": "SUCCESS",
  "statusMessage": "Payment completed",
  "confirmedAt": "2026-05-19T10:30:00Z"
}
```

### `POST /payments/gateway/token`
```json
{ "scopes": "payments", "sourceApp": "dk-backoffice", "requestId": "REQ-20260519-3001" }
```

### `POST /payments/gateway/sign-key`
```json
{ "accessToken": "gateway-access-token", "sourceApp": "dk-backoffice", "requestId": "REQ-20260519-3002" }
```

### `POST /payments/gateway/signature`
### `POST /payments/gateway/account-auth/pull-payment`
### `POST /payments/gateway/debit-request/pull-payment`
### `POST /payments/gateway/beneficiary/account-inquiry`
### `POST /payments/gateway/initiate/transaction`
### `POST /payments/gateway/transaction/status`
### `POST /payments/gateway/transactions/status`
```json
{
  "accessToken": "gateway-access-token",
  "privateKeyPem": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----",
  "payload": { "amount": "1000.00", "accountNumber": "123456789012" },
  "sourceApp": "dk-backoffice",
  "timestamp": "2026-05-19T10:30:00Z",
  "nonce": "nonce-001"
}
```

### `POST /payments/pull-payment/authorize`
### `POST /payments/pull-payment/debit`
### `POST /payments/beneficiary/account-inquiry`
### `POST /payments/intra/initiate`
### `POST /payments/status/current`
### `POST /payments/status/history`
```json
{
  "payload": { "amount": "1000.00", "accountNumber": "123456789012" },
  "sourceApp": "dk-backoffice",
  "timestamp": "2026-05-19T10:30:00Z",
  "nonce": "nonce-001"
}
```

### `POST /payments/:paymentReference/verify-status`
```json
{}
```

## Reserves

### `POST /reserves/:id/approve`
```json
{}
```

### `POST /reserves/:id/reject`
```json
{ "rejectionReason": "Supporting documents incomplete" }
```

## CBS

### `POST /cbs/account-inquiry`
```json
{
  "accountNumber": "123456789012",
  "requestId": "REQ-20260519-4001",
  "sourceApp": "dk-backoffice",
  "productType": "LCY_ACC",
  "channel": "WEB"
}
```

## Admin / Operations

### `POST /users`
```json
{
  "fullName": "Pema Wangchuk",
  "email": "pema@example.com",
  "password": "StrongPass123",
  "cid": "11122233344",
  "customerType": "INDIVIDUAL",
  "linkedBankAccountNumber": "123456789012",
  "linkedBankAccountNumbers": ["123456789012"],
  "mpin": "1234",
  "roles": ["MAKER"]
}
```

### `PATCH /users/:id`
```json
{ "fullName": "Pema W.", "mpin": "4321" }
```

### `PATCH /users/:id/status`
```json
{ "isActive": true }
```

### `POST /users/:id/roles`
```json
{ "roles": ["ADMIN", "CHECKER"] }
```

### `POST /wallets`
```json
{
  "userId": "77777777-7777-7777-7777-777777777777",
  "walletAddress": "7Yk6ExampleMakerWallet1111111111111111111111",
  "label": "Primary maker wallet",
  "isPrimary": true
}
```

### `PATCH /wallets/:id`
```json
{ "label": "Updated wallet label", "isPrimary": false }
```

### `PATCH /wallets/:id/status`
```json
{ "isActive": true }
```

### `PATCH /banks/:id`
```json
{
  "name": "Druk Punjab National Bank",
  "binNumber": "502942",
  "panNumber": "94009402",
  "treasuryWalletAddress": "8TrsyExampleWallet11111111111111111111111",
  "supportsBtn": true,
  "supportsBipsSettlement": true,
  "isIssuer": false,
  "isActive": true
}
```

### `POST /banks/:id/accounts`
```json
{
  "accountType": "BIPS_SETTLEMENT",
  "accountName": "DK Settlement Account",
  "accountNumber": "123456789012",
  "currency": "BTN",
  "isPrimary": true,
  "isActive": true,
  "remarks": "Primary settlement account"
}
```

### `PATCH /banks/:id/accounts/:accountId`
```json
{ "accountName": "Updated Account Name", "isPrimary": false, "isActive": true }
```

### `POST /banks/:id/token-accounts`
```json
{
  "mintAddress": "So11111111111111111111111111111111111111112",
  "purpose": "TREASURY",
  "treasuryWalletAddress": "8TrsyExampleWallet11111111111111111111111",
  "tokenAccountAddress": "9ToknExampleWallet11111111111111111111111",
  "isPrimary": true,
  "isActive": true,
  "remarks": "Primary treasury token account"
}
```

### `PATCH /banks/:id/token-accounts/:tokenAccountId`
```json
{ "purpose": "DISTRIBUTION", "isPrimary": false, "isActive": true }
```

### `POST /solana/token-mints`
```json
{
  "decimals": 6,
  "name": "Digital BTN",
  "symbol": "DBTN",
  "uri": "https://example.com/metadata/dbtn.json",
  "adminWalletAddress": "7AdminExampleWallet111111111111111111111"
}
```

### `POST /solana/token-mints/record`
```json
{
  "decimals": 6,
  "name": "Digital BTN",
  "symbol": "DBTN",
  "metadataUri": "https://example.com/metadata/dbtn.json",
  "mintAddress": "Mint1111111111111111111111111111111111111",
  "tokenAuthority": "7AdminExampleWallet111111111111111111111",
  "txSignature": "MintSig111111111111111111111111111111111",
  "explorerUrl": "https://explorer.solana.com/tx/MintSig111111111111111111111111111111111",
  "adminWalletAddress": "7AdminExampleWallet111111111111111111111",
  "metadataAddress": "Meta111111111111111111111111111111111111",
  "metadataUpdateAuthority": "7AdminExampleWallet111111111111111111111"
}
```

### `POST /solana/checkers`
```json
{ "checkerAddress": "Chk1111111111111111111111111111111111111" }
```

### `POST /solana/treasury-accounts`
```json
{ "treasuryAccountAddress": "Trs1111111111111111111111111111111111111" }
```

### `POST /solana/admin`
```json
{ "newAdminAddress": "Adm1111111111111111111111111111111111111" }
```
