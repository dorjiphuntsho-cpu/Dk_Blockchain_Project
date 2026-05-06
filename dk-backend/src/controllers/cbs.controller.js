import { inquireCbsAccount } from "../services/cbsApi.service.js";

export const getTestAccounts = (req, res) => {
  const accounts = [
    process.env.CBS_TEST_ACCOUNT_1,
    process.env.CBS_TEST_ACCOUNT_2,
  ].filter(Boolean);

  res.json({
    productType: process.env.CBS_PRODUCT_TYPE || "LCY_ACC",
    accounts,
  });
};

export const inquireAccount = async (req, res) => {
  const { account_no: accountNoFromSnake, accountNo, product_type: productTypeFromSnake, productType } = req.body;
  const normalizedAccountNo = String(accountNoFromSnake || accountNo || "").trim();
  const normalizedProductType = String(productTypeFromSnake || productType || "LCY_ACC").trim();

  if (!/^\d{12}$/.test(normalizedAccountNo)) {
    return res.status(400).json({
      error: "account_no must be a 12 digit account number",
    });
  }

  try {
    const data = await inquireCbsAccount({
      accountNo: normalizedAccountNo,
      productType: normalizedProductType,
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(502).json({
      error: "CBS account inquiry failed",
      message: err.message,
    });
  }
};
