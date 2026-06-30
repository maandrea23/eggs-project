import mysql, { type Pool } from "mysql2/promise";
import type { FarmState } from "./types";

let pool: Pool | null = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_DATABASE_URL;
}

function getPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl = getDatabaseUrl();

  if (databaseUrl) {
    pool = mysql.createPool({
      uri: databaseUrl,
      connectionLimit: 4,
      namedPlaceholders: true,
    });
    return pool;
  }

  const host = process.env.MYSQL_HOST || process.env.DB_HOST;
  const user = process.env.MYSQL_USER || process.env.DB_USER;
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME;
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);

  if (!host || !user || !database) {
    throw new Error("Dailey database credentials are not available yet.");
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    connectionLimit: 4,
    namedPlaceholders: true,
  });

  return pool;
}

async function ensureFarmStateTable() {
  await getPool().execute(`
    create table if not exists farm_state (
      id varchar(64) primary key,
      data json not null,
      updated_at timestamp not null default current_timestamp on update current_timestamp
    )
  `);
}

export async function readFarmStateFromDatabase() {
  await ensureFarmStateTable();

  const [rows] = await getPool().execute(
    "select data from farm_state where id = ? limit 1",
    ["primary"],
  );

  const firstRow = Array.isArray(rows) ? rows[0] : undefined;

  if (!firstRow || typeof firstRow !== "object" || !("data" in firstRow)) {
    return null;
  }

  const data = firstRow.data;

  if (typeof data === "string") {
    return JSON.parse(data) as FarmState;
  }

  return data as FarmState;
}

export async function writeFarmStateToDatabase(state: FarmState) {
  await ensureFarmStateTable();

  await getPool().execute(
    `
      insert into farm_state (id, data)
      values (?, cast(? as json))
      on duplicate key update
        data = values(data),
        updated_at = current_timestamp
    `,
    ["primary", JSON.stringify(state)],
  );
}
