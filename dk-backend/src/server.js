import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bankGatewayRoutes from "./routes/bankGateway.routes.js";
import bankRoutes from "./routes/bank.routes.js";
import cbsRoutes from "./routes/cbs.routes.js";
import mintRequestRoutes from "./routes/mintRequest.routes.js";
import mockBankRoutes from "./routes/mockBank.routes.js";
import settlementRoutes from "./routes/settlement.routes.js";
import tokenConfigRoutes from "./routes/tokenConfig.routes.js";
import userRoutes from "./routes/user.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  const endpoints = [
    { label: "Banks", path: "/banks", method: "GET" },
    { label: "Users", path: "/users", method: "GET" },
    { label: "Mint Requests", path: "/mint-requests", method: "GET" },
    { label: "Settlements", path: "/settlements", method: "GET" },
    { label: "Token Config", path: "/token-config", method: "GET" },
    { label: "Mock Bank Payout", path: "/mock-bank/payout", method: "POST" },
    { label: "Bank Sign Key", path: "/v1/sign/key", method: "POST" },
    { label: "CBS Account Inquiry", path: "/cbs/account-inquiry", method: "POST" },
    { label: "FIAT Unregistered Settlement", path: "/settlements/fiat/unregistered", method: "POST" },
  ];

  const endpointRows = endpoints
    .map(
      (endpoint) => `
        <a class="endpoint" href="${endpoint.path}">
          <span class="method">${endpoint.method}</span>
          <span>
            <strong>${endpoint.label}</strong>
            <small>${endpoint.path}</small>
          </span>
        </a>
      `
    )
    .join("");

  res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DK Backend</title>
        <style>
          :root {
            color-scheme: dark;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #101418;
            color: #eef3f8;
          }

          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 32px 16px;
            box-sizing: border-box;
          }

          main {
            width: min(760px, 100%);
          }

          .panel {
            border: 1px solid #2b3641;
            border-radius: 8px;
            background: #151b21;
            padding: 28px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
          }

          .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #9ee6b4;
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #39d98a;
            box-shadow: 0 0 0 6px rgba(57, 217, 138, 0.12);
          }

          h1 {
            margin: 14px 0 8px;
            font-size: 34px;
            line-height: 1.1;
          }

          p {
            margin: 0;
            color: #aeb9c5;
            line-height: 1.6;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin-top: 24px;
          }

          .endpoint {
            display: flex;
            gap: 12px;
            align-items: center;
            text-decoration: none;
            color: #eef3f8;
            border: 1px solid #2b3641;
            border-radius: 8px;
            padding: 14px;
            background: #10161c;
          }

          .endpoint:hover {
            border-color: #39d98a;
          }

          .method {
            min-width: 42px;
            border-radius: 6px;
            background: #1f6f46;
            color: #dff8e8;
            padding: 5px 7px;
            font-size: 12px;
            font-weight: 800;
            text-align: center;
          }

          strong,
          small {
            display: block;
          }

          small {
            margin-top: 3px;
            color: #9ca8b5;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="panel">
            <div class="status"><span class="dot"></span>Backend running</div>
            <h1>DK Backend API</h1>
            <p>Express, Prisma, PostgreSQL, banks, mint requests, settlements, users, and saved token config are available on port 5000.</p>
            <div class="grid">${endpointRows}</div>
          </section>
        </main>
      </body>
    </html>
  `);
});

app.use("/banks", bankRoutes);
app.use("/cbs", cbsRoutes);
app.use("/mock-bank", mockBankRoutes);
app.use("/users", userRoutes);
app.use("/mint-requests", mintRequestRoutes);
app.use("/settlements", settlementRoutes);
app.use("/token-config", tokenConfigRoutes);
app.use("/v1", bankGatewayRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

const PORT = 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server };
