<!-- Step A — Create Backend -->
✅ Express + PostgreSQL + Prisma + Solana Web3
This is production-grade architecture.

Inside your workspace:

mkdir dk-backend
cd dk-backend
npm init -y
npm install express cors dotenv @solana/web3.js

Optional but recommended:

npm install prisma @prisma/client

npm install express cors dotenv
npm install @prisma/client
npm install prisma --save-dev
npm install pg
npm install @solana/web3.js


<!-- Install PostgreSQL (Inside WSL) -->
Run this inside Ubuntu terminal:

sudo apt update
sudo apt install postgresql postgresql-contrib

Then start it:
sudo service postgresql start

Check status:
sudo service postgresql status

<!-- Create Database & User -->
Switch to postgres user:
sudo -i -u postgres

Open PostgreSQL:
psql

Create DB:
CREATE DATABASE dk_token_db;
CREATE USER dk_user WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE dk_token_db TO dk_user;
\q

Fix Database Owner
Run:
ALTER DATABASE dk_token_db OWNER TO postgres;
Exit postgres user:
exit

connect to the database:
\c dk_token_db

Fix Schema Permission
Run:
ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;

<!-- Test Connection -->

Try connecting as your new user:
psql -U dk_user -d dk_token_db -h localhost

If it connects successfully 🎉 you're good.
If it asks for password → enter the one you set.

To exit:
\q

<!-- etup backend project structure + Prisma -->

<!-- Initialize Node Project -->
npm init -y
This creates:
package.json

<!-- Install Dependencies Core dependencies -->
npm install express cors dotenv

Dev dependencies
npm install -D nodemon

Prisma
npm install prisma --save-dev
npm install @prisma/client

<!-- Initialize Prisma -->

Run:
npx prisma init

This creates:
prisma/
  schema.prisma
.env


<!-- Configure Prisma Schema -->

Open:
prisma/schema.prisma
nano prisma/schema.prisma


Replace everything with:

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model MintRequest {
  id            String   @id @default(uuid())
  requestAddr   String   @unique
  maker         String
  amount        Float
  status        String   @default("Pending")
  txSignature   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

Then run: npx prisma db push

This table will store:

On-chain request address
Maker wallet
Amount
Status (Pending / Approved / Rejected)
Transaction signature
Audit timestamps

<!-- Add Server in pgAdmin -->
STEP 1 — Make Sure PostgreSQL is Running in WSL

Inside WSL terminal run:

sudo service postgresql status

If not running:

sudo service postgresql start
✅ STEP 2 — Allow Password Login (Very Important)

Inside WSL:

sudo -u postgres psql

Then set a password for postgres user:

ALTER USER postgres WITH PASSWORD 'yourpassword';

Replace yourpassword with something simple for now.

Then exit:

\q
✅ STEP 3 — Find Your WSL IP Address

Inside WSL run:

hostname -I

You will see something like:

172.22.xx.xx

Copy that IP.

✅ STEP 4 — Add Server in pgAdmin

Now go back to pgAdmin.

Right click Servers
Click Register → Server
General Tab

Name:

WSL PostgreSQL
Connection Tab

Fill this:

Field	                  Value
Host name/address	  (WSL IP you copied)
Port	               5432
Maintenance DB	       postgres
Username	           postgres
Password	           yourpassword

Click Save.

<!-- after db success -->
0 — Create First API Server

Install:
npm install express cors dotenv

Create:

src/
  server.js

Basic server:

run: node src/server.js


STEP 1 — Create src/prisma.js
Inside:
dk-backend/src/prisma.js

Add:
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();

STEP 2 — Update server.js
Open:
src/server.js
Replace Prisma initialization with this:
code ........

STEP 3 — Create First Real API: POST /users
Now create folders:
src/routes/
src/controllers/
Create Controller

Create Controller
Create:
src/controllers/user.controller.js

Create Route
Create:
src/routes/user.routes.js

Connect Route to Server
Update server.js:

STEP 4 — Test It
Start server:

node src/server.js
Test using:
Create user

POST → http://localhost:5000/users

Body (JSON):
{
  "wallet": "2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP",
  "role": "MAKER"
}
Get users
GET → http://localhost:5000/users