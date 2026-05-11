<!-- get details for one account -->
POST http://localhost:5000/cbs/account-inquiry

<!-- Body -> raw -> JSON: -->
{
  "account_no": "100100312011",
  "product_type": "LCY_ACC"
}